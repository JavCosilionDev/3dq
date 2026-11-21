function getNextQuoteNumber(db) {
  const prefixSetting = db.prepare("SELECT value FROM settings WHERE key = 'quote_prefix'").get();
  const prefix = prefixSetting?.value || '3DQ';
  const quotes = db.prepare('SELECT quote_number FROM quotes').all();

  let maxNumber = 0;
  for (const quote of quotes) {
    if (!quote.quote_number || !quote.quote_number.startsWith(prefix)) continue;

    const numericPart = quote.quote_number.slice(prefix.length);
    if (/^\d+$/.test(numericPart)) {
      maxNumber = Math.max(maxNumber, parseInt(numericPart, 10));
    }
  }

  return `${prefix}${String(maxNumber + 1).padStart(4, '0')}`;
}

module.exports = { getNextQuoteNumber };
