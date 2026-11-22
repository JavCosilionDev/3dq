const { getSettings } = require('./settings');
const { deriveOutputFolio } = require('./folio');
const { sanitizeMaterial } = require('./labels');
const { roundHalfUp } = require('./money');
const { ValidationError } = require('./errors');
const { documentImages } = require('../images');

function resolveMaterial(db, filament) {
  if (filament.material) {
    return sanitizeMaterial(filament.material);
  }

  const catalogEntry = db.prepare('SELECT type FROM filaments WHERE id = ?').get(filament.filament_id);
  return sanitizeMaterial(catalogEntry?.type || filament.filament_name);
}

function buildDocument(db, quoteId) {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
  if (!quote) {
    throw new ValidationError('Cotización no encontrada', 'quote_id', 'not_found');
  }

  const settings = getSettings(db);
  const filaments = db.prepare('SELECT * FROM quote_filaments WHERE quote_id = ?').all(quoteId);
  const hardware = db.prepare('SELECT * FROM quote_hardware WHERE quote_id = ?').all(quoteId);
  const printSetup = db.prepare('SELECT * FROM quote_print_setup WHERE quote_id = ?').get(quoteId);
  const labour = db.prepare('SELECT * FROM quote_labour WHERE quote_id = ?').get(quoteId);

  const filamentCost = filaments.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const hardwareCost = hardware.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const printCost = printSetup
    ? Number(printSetup.power_cost || 0) + Number(printSetup.depreciation_cost || 0)
    : 0;
  const labourCost = Number(labour?.total_cost || 0);
  const productionCost = filamentCost + hardwareCost + printCost + labourCost;
  const quantity = Math.max(1, Number(quote.quantity) || 1);
  const markup = Number(quote.markup_percent) || 0;
  const subtotalLista = roundHalfUp(productionCost * (1 + markup / 100) * quantity);
  const totalObjetivo = roundHalfUp(Number(quote.total_cost) || 0);
  const taxPercent = Number(settings.tax_rate || 0);
  const discountPercent = Number(quote.discount_percent || 0);
  const discount = roundHalfUp(subtotalLista * discountPercent / 100);
  const realNet = subtotalLista - discount;
  const realTotal = realNet + roundHalfUp(realNet * taxPercent / 100);
  const mode = discountPercent > 0
    ? (Math.abs(realTotal - totalObjetivo) <= 1 ? 'real' : 'referencial')
    : 'sin_descuento';

  const items = filaments.map((filament) => ({
    tipo: 'filamento',
    material: resolveMaterial(db, filament),
    gramos: Number(filament.grams_used) || 0,
    color: filament.color_name || null,
    color_hex: filament.color_hex || null,
    purge_grams: Number(filament.purge_grams) || 0,
    visible: true,
  }));

  for (const item of hardware) {
    items.push({
      tipo: 'hardware',
      texto: item.hardware_name,
      visible: true,
    });
  }

  const labourMinutes = labour
    ? Number(labour.design_minutes || 0)
      + Number(labour.preparation_minutes || 0)
      + Number(labour.post_processing_minutes || 0)
      + Number(labour.other_minutes || 0)
    : 0;

  if (labourMinutes > 0) {
    items.push({
      tipo: 'mano_obra',
      texto: 'Preparación',
      visible: true,
    });
  }

  return {
    folio_origen: quote.quote_number,
    folio_salida: deriveOutputFolio(quote.quote_number, quote.date),
    fecha_emision: quote.date,
    cliente: quote.customer_name,
    modelo_base: quote.title,
    regalo: false,
    cantidad: quantity,
    moneda: settings.pdf_currency_code || 'MXN',
    iva_pct: Number(settings.tax_rate || 0),
    descuento_pct: Number(quote.discount_percent || 0),
    modo_descuento: mode,
    precios_incluyen_iva: false,
    descuento_monto: null,
    subtotal_lista: subtotalLista,
    total_objetivo: totalObjetivo,
    envio: {
      monto: 0,
      lleva_iva: false,
      nota_entrega: null,
    },
    duracion_minutos: Number(printSetup?.print_time || 0),
    items,
    mostrar_precios_por_item: false,
    notas: [],
    imagenes: documentImages(db, quoteId),
    source_quote_ids: [quote.id],
  };
}

module.exports = { buildDocument, resolveMaterial };
