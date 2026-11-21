const DEFAULTS = {
  company_name: 'Impremática',
  currency_symbol: '$',
  tax_rate: '16',
  accent_color: '#0060FA',
  pdf_brand_name: 'Impremática',
  pdf_brand_url: 'imprematica.com',
  pdf_logo_path: 'assets/images/imprematica-logo.png',
  pdf_template_version: 'imprematica-v1',
  pdf_currency_code: 'MXN',
  pdf_shipping_note: 'Entrega estimada: 2 días hábiles en promedio.',
};

function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = { ...DEFAULTS };

  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return settings;
}

module.exports = { DEFAULTS, getSettings };
