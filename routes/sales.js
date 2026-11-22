const express = require('express');
const { ValidationError } = require('../services/pdf/errors');

function sendError(res, error) {
  if (error.name === 'ValidationError') {
    return res.status(422).json({ error: error.message, field: error.field, code: error.code });
  }
  console.error(error);
  return res.status(500).json({ error: 'Server error' });
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function taxRateForQuote(db, quoteId) {
  const documentRow = db.prepare('SELECT payload_json FROM quote_documents WHERE quote_id = ?').get(quoteId);
  if (documentRow) {
    try {
      const payload = JSON.parse(documentRow.payload_json);
      if (Number(payload.iva_pct) > 0) {
        return Number(payload.iva_pct);
      }
    } catch (error) {
      // Use the settings tax rate below.
    }
  }

  const setting = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
  return Number(setting?.value || 0);
}

function saleAmounts(amount, taxRate, providedIva) {
  const total = roundMoney(amount);
  if (!Number.isFinite(total) || total < 0) {
    throw new ValidationError('El importe de venta no es válido', 'amount', 'invalid_amount');
  }

  let iva;
  if (providedIva !== undefined && providedIva !== null && providedIva !== '') {
    iva = roundMoney(providedIva);
  } else {
    iva = taxRate > 0 ? roundMoney(total * taxRate / (100 + taxRate)) : 0;
  }

  if (!Number.isFinite(iva) || iva < 0) {
    throw new ValidationError('El IVA no es válido', 'iva_amount', 'invalid_iva');
  }
  if (iva > total) {
    throw new ValidationError('El IVA no puede superar el importe', 'iva_amount', 'iva_over_total');
  }

  return {
    amount: total,
    tax_rate: roundMoney(taxRate),
    iva_amount: iva,
    subtotal: roundMoney(total - iva),
  };
}

function getQuote(db, quoteId) {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
  if (!quote) {
    throw new ValidationError('Cotización no encontrada', 'quote_id', 'not_found');
  }
  return quote;
}

function recalculateQuoteSaleState(db, quoteId) {
  const stats = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount, MAX(sale_date) AS last_date
    FROM sales
    WHERE quote_id = ?
  `).get(quoteId);
  const quote = db.prepare('SELECT status FROM quotes WHERE id = ?').get(quoteId);
  const status = stats.count > 0
    ? 'sold'
    : (quote?.status === 'cancelled' ? 'cancelled' : 'quoted');

  db.prepare(`
    UPDATE quotes
    SET status = ?, sold_at = ?, sale_price = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status,
    stats.count > 0 ? stats.last_date : null,
    stats.count > 0 ? roundMoney(stats.amount) : null,
    quoteId
  );
}

function normalizeDate(value) {
  const date = String(value || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('La fecha de venta no es válida', 'sale_date', 'invalid_date');
  }
  return date;
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/sales', (req, res) => {
    try {
      const sales = db.prepare(`
        SELECT
          sales.id,
          sales.quote_id,
          sales.sale_date,
          sales.amount,
          sales.subtotal,
          sales.iva_amount,
          sales.tax_rate,
          sales.payment_method,
          sales.bank_reference,
          sales.notes,
          quotes.quote_number,
          quotes.title,
          quotes.customer_name
        FROM sales
        JOIN quotes ON quotes.id = sales.quote_id
        ORDER BY sales.sale_date DESC, sales.id DESC
      `).all();

      const totals = sales.reduce((acc, sale) => ({
        total: acc.total + Number(sale.amount || 0),
        iva: acc.iva + Number(sale.iva_amount || 0),
        subtotal: acc.subtotal + Number(sale.subtotal || 0),
      }), { total: 0, iva: 0, subtotal: 0 });

      res.json({
        sales,
        total: roundMoney(totals.total),
        iva: roundMoney(totals.iva),
        subtotal: roundMoney(totals.subtotal),
        count: sales.length,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/quotes/:id/sales', (req, res) => {
    try {
      getQuote(db, req.params.id);
      const sales = db.prepare(`
        SELECT * FROM sales
        WHERE quote_id = ?
        ORDER BY sale_date DESC, id DESC
      `).all(req.params.id);
      res.json({ sales });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/quotes/:id/sales', (req, res) => {
    try {
      const quote = getQuote(db, req.params.id);
      const taxRate = taxRateForQuote(db, req.params.id);
      const amount = req.body.amount === undefined || req.body.amount === ''
        ? Number(quote.total_cost)
        : Number(req.body.amount);
      const amounts = saleAmounts(amount, taxRate, req.body.iva_amount);

      const inserted = db.prepare(`
        INSERT INTO sales (
          quote_id, sale_date, amount, subtotal, iva_amount, tax_rate,
          payment_method, bank_reference, notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        quote.id,
        normalizeDate(req.body.sale_date),
        amounts.amount,
        amounts.subtotal,
        amounts.iva_amount,
        amounts.tax_rate,
        req.body.payment_method || null,
        req.body.bank_reference ? String(req.body.bank_reference).trim() : null,
        req.body.notes || null
      );

      recalculateQuoteSaleState(db, quote.id);

      res.status(201).json({
        sale: db.prepare('SELECT * FROM sales WHERE id = ?').get(inserted.lastInsertRowid),
        quote: db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote.id),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.patch('/sales/:id', (req, res) => {
    try {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
      if (!sale) {
        throw new ValidationError('Venta no encontrada', 'sale_id', 'not_found');
      }

      const taxRate = req.body.tax_rate !== undefined
        ? Number(req.body.tax_rate)
        : Number(sale.tax_rate || taxRateForQuote(db, sale.quote_id));
      const amount = req.body.amount !== undefined ? Number(req.body.amount) : Number(sale.amount);
      const providedIva = req.body.iva_amount !== undefined
        ? req.body.iva_amount
        : (req.body.amount !== undefined ? undefined : sale.iva_amount);
      const amounts = saleAmounts(amount, taxRate, providedIva);

      db.prepare(`
        UPDATE sales SET
          sale_date = ?,
          amount = ?,
          subtotal = ?,
          iva_amount = ?,
          tax_rate = ?,
          payment_method = ?,
          bank_reference = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        req.body.sale_date !== undefined ? normalizeDate(req.body.sale_date) : sale.sale_date,
        amounts.amount,
        amounts.subtotal,
        amounts.iva_amount,
        amounts.tax_rate,
        req.body.payment_method !== undefined ? req.body.payment_method : sale.payment_method,
        req.body.bank_reference !== undefined
          ? (req.body.bank_reference ? String(req.body.bank_reference).trim() : null)
          : sale.bank_reference,
        req.body.notes !== undefined ? req.body.notes : sale.notes,
        sale.id
      );

      recalculateQuoteSaleState(db, sale.quote_id);

      res.json({
        sale: db.prepare('SELECT * FROM sales WHERE id = ?').get(sale.id),
        quote: db.prepare('SELECT * FROM quotes WHERE id = ?').get(sale.quote_id),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete('/sales/:id', (req, res) => {
    try {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
      if (!sale) {
        throw new ValidationError('Venta no encontrada', 'sale_id', 'not_found');
      }

      db.prepare('DELETE FROM sales WHERE id = ?').run(sale.id);
      recalculateQuoteSaleState(db, sale.quote_id);

      res.json({
        success: true,
        quote: db.prepare('SELECT * FROM quotes WHERE id = ?').get(sale.quote_id),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.patch('/quotes/:id/status', (req, res) => {
    try {
      const quote = getQuote(db, req.params.id);
      const status = req.body.status;
      if (!['quoted', 'sold', 'cancelled'].includes(status)) {
        throw new ValidationError('Estado no válido', 'status', 'invalid_status');
      }

      if (status === 'quoted') {
        const count = db.prepare('SELECT COUNT(*) AS count FROM sales WHERE quote_id = ?').get(quote.id);
        if (count.count > 0) {
          throw new ValidationError(
            'La cotización tiene ventas registradas. Elimina las ventas para volver a cotizada.',
            'status',
            'quote_has_sales'
          );
        }
        db.prepare(`
          UPDATE quotes
          SET status = 'quoted', sold_at = NULL, sale_price = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(quote.id);
      } else if (status === 'cancelled') {
        db.prepare(`
          UPDATE quotes
          SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(quote.id);
      } else {
        const taxRate = taxRateForQuote(db, quote.id);
        const amount = req.body.amount === undefined || req.body.amount === ''
          ? Number(quote.total_cost)
          : Number(req.body.amount);
        const amounts = saleAmounts(amount, taxRate, req.body.iva_amount);

        db.prepare(`
          INSERT INTO sales (
            quote_id, sale_date, amount, subtotal, iva_amount, tax_rate,
            payment_method, bank_reference, notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          quote.id,
          normalizeDate(req.body.sale_date),
          amounts.amount,
          amounts.subtotal,
          amounts.iva_amount,
          amounts.tax_rate,
          req.body.payment_method || null,
          req.body.bank_reference ? String(req.body.bank_reference).trim() : null,
          req.body.notes || null
        );

        recalculateQuoteSaleState(db, quote.id);
      }

      res.json(db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote.id));
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
};
