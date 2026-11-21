function toCents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
}

function roundHalfUp(value) {
  return Math.floor(value + 0.5);
}

function formatMoney(cents, symbol = '$', decimals = 0) {
  const negative = cents < 0;
  const absolute = Math.abs(cents);

  if (decimals > 0) {
    return `${negative ? '-' : ''}${symbol}${(absolute / 100).toFixed(decimals)}`;
  }

  return `${negative ? '-' : ''}${symbol}${Math.round(absolute / 100)}`;
}

function formatGrams(value) {
  return `${Number(value).toFixed(2)}g`;
}

module.exports = { toCents, roundHalfUp, formatMoney, formatGrams };
