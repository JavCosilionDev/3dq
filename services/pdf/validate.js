const { ValidationError } = require('./errors');
const { isValidDate } = require('./dates');
const { deriveOutputFolio, validateOutputFolio } = require('./folio');
const { sanitizeMaterial, findForbiddenText } = require('./labels');
const { calculateTotals } = require('./totals');

const ITEM_TYPES = new Set(['filamento', 'descripcion', 'hardware', 'mano_obra', 'producto']);
const DISCOUNT_MODES = new Set(['referencial', 'real', 'sin_descuento']);

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`El campo ${field} es obligatorio`, field, 'required');
  }
  return value.trim();
}

function optionalText(value, field) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`El campo ${field} debe ser texto`, field, 'invalid_text');
  }
  return value.trim();
}

function requireNumber(value, field, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new ValidationError(`El campo ${field} debe ser numérico`, field, 'invalid_number');
  }
  if (number < min) {
    throw new ValidationError(`El campo ${field} no puede ser menor que ${min}`, field, 'invalid_number');
  }
  return number;
}

function normalizeItem(item, index) {
  if (!item || typeof item !== 'object') {
    throw new ValidationError(`El ítem ${index} no es válido`, `items[${index}]`, 'invalid_item');
  }

  const tipo = requireText(item.tipo, `items[${index}].tipo`);
  if (!ITEM_TYPES.has(tipo)) {
    throw new ValidationError(`El tipo de ítem ${tipo} no es válido`, `items[${index}].tipo`, 'invalid_item_type');
  }

  const normalized = {
    tipo,
    visible: item.visible !== false,
  };

  if (tipo === 'filamento') {
    normalized.material = sanitizeMaterial(requireText(item.material, `items[${index}].material`));
    normalized.gramos = requireNumber(item.gramos, `items[${index}].gramos`, { min: 0.01 });
  } else if (tipo === 'producto') {
    normalized.texto = requireText(item.texto, `items[${index}].texto`);
    normalized.precio = requireNumber(item.precio, `items[${index}].precio`);
    normalized.cantidad = Math.max(1, Math.round(requireNumber(item.cantidad ?? 1, `items[${index}].cantidad`, { min: 1 })));
    normalized.detalle = Array.isArray(item.detalle)
      ? item.detalle.map((line) => String(line).trim()).filter(Boolean)
      : [];
  } else {
    normalized.texto = requireText(item.texto, `items[${index}].texto`);
  }

  return normalized;
}

function normalizeDocument(input) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('El documento no es válido', 'document', 'invalid_document');
  }

  const document = {
    folio_origen: requireText(input.folio_origen, 'folio_origen'),
    folio_salida: input.folio_salida
      ? validateOutputFolio(input.folio_salida)
      : deriveOutputFolio(input.folio_origen, input.fecha_emision),
    fecha_emision: requireText(input.fecha_emision, 'fecha_emision'),
    cliente: requireText(input.cliente, 'cliente'),
    modelo_base: requireText(input.modelo_base, 'modelo_base'),
    regalo: Boolean(input.regalo),
    cantidad: Math.max(1, Math.round(requireNumber(input.cantidad ?? 1, 'cantidad', { min: 1 }))),
    moneda: input.moneda || 'MXN',
    iva_pct: requireNumber(input.iva_pct ?? 16, 'iva_pct'),
    descuento_pct: requireNumber(input.descuento_pct ?? 0, 'descuento_pct'),
    modo_descuento: input.modo_descuento || 'sin_descuento',
    precios_incluyen_iva: Boolean(input.precios_incluyen_iva),
    descuento_monto: input.descuento_monto === null || input.descuento_monto === undefined
      ? null
      : requireNumber(input.descuento_monto, 'descuento_monto'),
    subtotal_lista: requireNumber(input.subtotal_lista, 'subtotal_lista'),
    total_objetivo: input.total_objetivo === null || input.total_objetivo === undefined || input.total_objetivo === ''
      ? null
      : requireNumber(input.total_objetivo, 'total_objetivo'),
    envio: {
      monto: requireNumber(input.envio?.monto ?? 0, 'envio.monto'),
      lleva_iva: Boolean(input.envio?.lleva_iva),
      nota_entrega: optionalText(input.envio?.nota_entrega, 'envio.nota_entrega'),
    },
    duracion_minutos: requireNumber(input.duracion_minutos ?? 0, 'duracion_minutos'),
    items: Array.isArray(input.items) ? input.items.map(normalizeItem) : [],
    mostrar_precios_por_item: Boolean(input.mostrar_precios_por_item),
    notas: Array.isArray(input.notas)
      ? input.notas.map((note) => String(note).trim()).filter(Boolean)
      : [],
    source_quote_ids: Array.isArray(input.source_quote_ids) ? input.source_quote_ids : [],
  };

  if (!isValidDate(document.fecha_emision)) {
    throw new ValidationError('La fecha de emisión no es válida', 'fecha_emision', 'invalid_date');
  }
  if (!DISCOUNT_MODES.has(document.modo_descuento)) {
    throw new ValidationError('El modo de descuento no es válido', 'modo_descuento', 'invalid_discount_mode');
  }
  if (document.iva_pct > 100 || document.descuento_pct > 100) {
    throw new ValidationError('Los porcentajes no pueden superar 100', 'descuento_pct', 'invalid_percent');
  }
  if (document.mostrar_precios_por_item === false && document.items.some((item) => item.tipo === 'producto')) {
    document.mostrar_precios_por_item = true;
  }

  const forbidden = findForbiddenText(document);
  if (forbidden) {
    throw new ValidationError(
      `El texto prohibido "${forbidden.entry}" aparece en ${forbidden.path}`,
      forbidden.path,
      'forbidden_text'
    );
  }

  const totals = calculateTotals(document);

  return { document, totals };
}

module.exports = { normalizeDocument, ITEM_TYPES, DISCOUNT_MODES };
