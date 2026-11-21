const { roundHalfUp } = require('./money');
const { ValidationError } = require('./errors');

function numberField(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new ValidationError(`El campo ${field} debe ser numérico`, field, 'invalid_number');
  }
  return number;
}

function toPesoCents(value, field) {
  return roundHalfUp(numberField(value, field)) * 100;
}

function calculateTotals(document) {
  const subtotal = toPesoCents(document.subtotal_lista, 'subtotal_lista');
  const shipping = toPesoCents(document.envio?.monto || 0, 'envio.monto');
  const taxPercent = numberField(document.iva_pct, 'iva_pct');
  const discountPercent = numberField(document.descuento_pct, 'descuento_pct');
  const mode = document.modo_descuento || 'sin_descuento';
  const includesTax = Boolean(document.precios_incluyen_iva);
  const target = document.total_objetivo === null || document.total_objetivo === undefined || document.total_objetivo === ''
    ? null
    : toPesoCents(document.total_objetivo, 'total_objetivo');

  let net;
  let tax;
  let discount;
  let total;

  if (includesTax) {
    tax = 0;

    if (target !== null) {
      total = target;
      net = total - shipping;
      discount = subtotal - net;
    } else {
      discount = document.descuento_monto === null || document.descuento_monto === undefined
        ? roundHalfUp((subtotal / 100) * discountPercent / 100) * 100
        : toPesoCents(document.descuento_monto, 'descuento_monto');
      net = subtotal - discount;
      total = net + shipping;
    }
  } else if (mode === 'referencial') {
    if (target !== null) {
      const taxable = target - shipping;
      net = roundHalfUp((taxable / 100) / (1 + taxPercent / 100)) * 100;
      tax = taxable - net;
      discount = subtotal - net;
      total = target;
    } else {
      discount = roundHalfUp((subtotal / 100) * discountPercent / 100) * 100;
      net = subtotal - discount;
      tax = roundHalfUp((net / 100) * taxPercent / 100) * 100;
      total = net + tax + shipping;
    }
  } else if (mode === 'real') {
    discount = document.descuento_monto === null || document.descuento_monto === undefined
      ? roundHalfUp((subtotal / 100) * discountPercent / 100) * 100
      : toPesoCents(document.descuento_monto, 'descuento_monto');
    net = subtotal - discount;
    tax = roundHalfUp((net / 100) * taxPercent / 100) * 100;
    total = net + tax + shipping;

    if (target !== null && target !== total) {
      throw new ValidationError(
        'El total objetivo no coincide con el cálculo del descuento real',
        'total_objetivo',
        'total_mismatch'
      );
    }
  } else {
    discount = 0;
    net = subtotal;
    total = target !== null
      ? target
      : net + roundHalfUp((net / 100) * taxPercent / 100) * 100 + shipping;
    tax = total - shipping - net;
  }

  if (subtotal < 0) {
    throw new ValidationError('El subtotal no puede ser negativo', 'subtotal_lista', 'negative_amount');
  }
  if (shipping < 0) {
    throw new ValidationError('El envío no puede ser negativo', 'envio.monto', 'negative_amount');
  }
  if (discount < 0) {
    throw new ValidationError('El descuento no puede ser negativo', 'descuento_pct', 'negative_discount');
  }
  if (net < 0) {
    throw new ValidationError('El subtotal con descuento no puede ser negativo', 'total_objetivo', 'negative_amount');
  }
  if (tax < 0) {
    throw new ValidationError('El IVA no puede ser negativo', 'total_objetivo', 'negative_tax');
  }
  if (total < 0) {
    throw new ValidationError('El total no puede ser negativo', 'total_objetivo', 'negative_amount');
  }
  if (target !== null && target < shipping) {
    throw new ValidationError('El total objetivo no puede ser menor que el envío', 'total_objetivo', 'total_below_shipping');
  }

  const equation = subtotal - discount + tax + shipping;
  if (equation !== total) {
    throw new ValidationError(
      'La suma de totales no cierra al peso',
      'total_objetivo',
      'total_equation'
    );
  }

  const showDiscount = discount > 0;
  const showTax = !includesTax && tax > 0;
  const showShipping = shipping > 0;

  return {
    subtotal,
    shipping,
    net,
    tax,
    discount,
    total,
    taxPercent,
    discountPercent,
    mode,
    includesTax,
    showDiscount,
    showTax,
    showShipping,
    showNet: showDiscount && !includesTax,
    subtotalLabel: includesTax ? 'Subtotal (con IVA)' : 'Subtotal',
  };
}

module.exports = { calculateTotals };
