const FORBIDDEN_TEXT = [
  'Jayo',
  'Labour',
  'Invoice',
  'Quote #',
  'Tax',
  'localhost',
  '1/1',
];

const LABELS = {
  brand: 'Impremática',
  printNumber: 'Impresión #',
  client: 'Cliente',
  date: 'Fecha',
  model: 'Modelo',
  quantity: 'Cantidad',
  description: 'Descripción',
  price: 'Precio',
  duration: 'Duración de impresión',
  preparation: 'Preparación',
  postProcessing: 'Procesamiento posterior',
  subtotal: 'Subtotal',
  discount: 'Descuento',
  subtotalAfterDiscount: 'Subtotal con descuento',
  subtotalWithTax: 'Subtotal (con IVA)',
  tax: 'IVA',
  shipping: 'Envío',
  total: 'Total',
  shippingNote: 'Entrega estimada: 2 días hábiles en promedio.',
};

function sanitizeMaterial(value, fallback = 'PLA') {
  const cleaned = String(value || '')
    .replace(/jayo/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
}

function findForbiddenText(value, path = 'document') {
  if (typeof value === 'string') {
    const found = FORBIDDEN_TEXT.find((entry) => value.toLowerCase().includes(entry.toLowerCase()));
    return found ? { entry: found, path } : null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenText(value[index], `${path}[${index}]`);
      if (found) return found;
    }
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const found = findForbiddenText(entry, `${path}.${key}`);
      if (found) return found;
    }
  }

  return null;
}

module.exports = { FORBIDDEN_TEXT, LABELS, sanitizeMaterial, findForbiddenText };
