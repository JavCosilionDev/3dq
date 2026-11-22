const express = require('express');
const { getNextQuoteNumber } = require('../utils/quote-number');
const { resolveMaterial } = require('../services/pdf/document');
const { saveDocument } = require('../services/pdf/exporter');
const { formatDuration } = require('../services/pdf/duration');
const { ValidationError } = require('../services/pdf/errors');

function sendError(res, error) {
  if (error.name === 'ValidationError') {
    return res.status(422).json({ error: error.message, field: error.field, code: error.code });
  }
  console.error(error);
  return res.status(500).json({ error: 'Server error' });
}

function productDetail(db, quote) {
  const filaments = db.prepare('SELECT * FROM quote_filaments WHERE quote_id = ?').all(quote.id);
  const hardware = db.prepare('SELECT * FROM quote_hardware WHERE quote_id = ?').all(quote.id);
  const printSetup = db.prepare('SELECT * FROM quote_print_setup WHERE quote_id = ?').get(quote.id);
  const labour = db.prepare('SELECT * FROM quote_labour WHERE quote_id = ?').get(quote.id);
  const lines = [];

  if (printSetup?.print_time) {
    lines.push(`Duración de impresión: ${formatDuration(printSetup.print_time)}`);
  }

  for (const filament of filaments) {
    const color = filament.color_name ? ` · ${filament.color_name}` : '';
    const purge = Number(filament.purge_grams) > 0
      ? ` (purga ${Number(filament.purge_grams).toFixed(2)}g)`
      : '';
    lines.push(`${resolveMaterial(db, filament)}${color}: ${Number(filament.grams_used).toFixed(2)}g${purge}`);
  }

  for (const item of hardware) {
    lines.push(item.hardware_name);
  }

  const labourMinutes = labour
    ? Number(labour.design_minutes || 0)
      + Number(labour.preparation_minutes || 0)
      + Number(labour.post_processing_minutes || 0)
      + Number(labour.other_minutes || 0)
    : 0;

  if (labourMinutes > 0) {
    lines.push('Preparación');
  }

  return lines;
}

module.exports = (db) => {
  const router = express.Router();

  router.post('/quotes/merge', (req, res) => {
    try {
      const ids = Array.isArray(req.body.quote_ids)
        ? [...new Set(req.body.quote_ids.map(Number).filter(Number.isInteger))]
        : [];

      if (ids.length < 2) {
        throw new ValidationError('Selecciona al menos dos cotizaciones', 'quote_ids', 'invalid_quotes');
      }

      const quotes = ids.map((id) => db.prepare('SELECT * FROM quotes WHERE id = ?').get(id));
      if (quotes.some((quote) => !quote)) {
        throw new ValidationError('Una de las cotizaciones no existe', 'quote_ids', 'not_found');
      }

      const products = quotes.map((quote) => ({
        tipo: 'producto',
        texto: quote.title,
        precio: Math.round(Number(quote.total_cost) || 0),
        cantidad: 1,
        detalle: productDetail(db, quote),
        visible: true,
      }));

      const subtotal = products.reduce((sum, product) => sum + product.precio, 0);
      const shipping = Number(req.body.envio || 0);
      const total = req.body.total_objetivo === undefined || req.body.total_objetivo === ''
        ? subtotal + shipping
        : Number(req.body.total_objetivo);

      const quoteNumber = getNextQuoteNumber(db);
      const title = req.body.title || products.map((product) => product.texto).join(' / ');
      const customer = req.body.customer_name || quotes[0].customer_name || 'General';
      const date = req.body.fecha_emision || new Date().toISOString().slice(0, 10);
      const discount = subtotal - (total - shipping);

      const quoteInfo = db.prepare(`
        INSERT INTO quotes (
          quote_number, title, customer_name, date, notes,
          markup_percent, discount_percent, total_cost, quantity, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteNumber,
        title,
        customer,
        date,
        req.body.notes || null,
        0,
        0,
        total,
        1,
        'quoted'
      );

      const quoteId = quoteInfo.lastInsertRowid;
      const document = saveDocument(db, quoteId, {
        folio_origen: quoteNumber,
        fecha_emision: date,
        cliente: customer,
        modelo_base: title,
        regalo: false,
        cantidad: 1,
        moneda: 'MXN',
        iva_pct: 16,
        descuento_pct: 0,
        modo_descuento: discount > 0 ? 'real' : 'sin_descuento',
        precios_incluyen_iva: true,
        descuento_monto: discount,
        subtotal_lista: subtotal,
        total_objetivo: total,
        envio: {
          monto: shipping,
          lleva_iva: false,
          nota_entrega: req.body.nota_entrega || null,
        },
        duracion_minutos: 0,
        items: products,
        mostrar_precios_por_item: true,
        notas: [],
        source_quote_ids: ids,
      });

      res.status(201).json({ quote_id: quoteId, document: document.document, totals: document.totals });
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
};
