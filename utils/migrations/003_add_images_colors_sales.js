exports.up = function(db) {
  const filamentColumns = new Set(
    db.prepare('PRAGMA table_info(quote_filaments)').all().map((column) => column.name)
  );

  if (!filamentColumns.has('color_name')) {
    db.exec('ALTER TABLE quote_filaments ADD COLUMN color_name TEXT');
  }
  if (!filamentColumns.has('color_hex')) {
    db.exec('ALTER TABLE quote_filaments ADD COLUMN color_hex TEXT');
  }
  if (!filamentColumns.has('purge_grams')) {
    db.exec('ALTER TABLE quote_filaments ADD COLUMN purge_grams REAL NOT NULL DEFAULT 0');
  }

  const salesColumns = new Set(
    db.prepare('PRAGMA table_info(sales)').all().map((column) => column.name)
  );

  if (!salesColumns.has('bank_reference')) {
    db.exec('ALTER TABLE sales ADD COLUMN bank_reference TEXT');
  }
  if (!salesColumns.has('tax_rate')) {
    db.exec('ALTER TABLE sales ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0');
  }
  if (!salesColumns.has('iva_amount')) {
    db.exec('ALTER TABLE sales ADD COLUMN iva_amount REAL NOT NULL DEFAULT 0');
  }
  if (!salesColumns.has('subtotal')) {
    db.exec('ALTER TABLE sales ADD COLUMN subtotal REAL');
  }
  if (!salesColumns.has('updated_at')) {
    db.exec('ALTER TABLE sales ADD COLUMN updated_at TIMESTAMP');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      alt TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quote_images_quote_id
      ON quote_images(quote_id);

    CREATE TABLE IF NOT EXISTS quote_image_exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER,
      folio TEXT NOT NULL,
      filename TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      template_version TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quote_image_exports_quote_id
      ON quote_image_exports(quote_id);
  `);

  const settings = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map((row) => [row.key, row.value])
  );
  const defaultTaxRate = Number(settings.tax_rate || 16);

  const sales = db.prepare('SELECT id, quote_id, amount FROM sales').all();
  const updateSale = db.prepare(`
    UPDATE sales
    SET tax_rate = ?, iva_amount = ?, subtotal = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  for (const sale of sales) {
    const documentRow = db.prepare('SELECT payload_json FROM quote_documents WHERE quote_id = ?').get(sale.quote_id);
    let taxRate = defaultTaxRate;

    if (documentRow) {
      try {
        const payload = JSON.parse(documentRow.payload_json);
        if (Number(payload.iva_pct) > 0) {
          taxRate = Number(payload.iva_pct);
        }
      } catch (error) {
        taxRate = defaultTaxRate;
      }
    }

    const amount = Number(sale.amount) || 0;
    const iva = taxRate > 0
      ? Math.round((amount * taxRate / (100 + taxRate)) * 100) / 100
      : 0;

    updateSale.run(taxRate, iva, Math.round((amount - iva) * 100) / 100, sale.id);
  }

  db.prepare(`
    UPDATE quotes
    SET status = 'sold',
        sold_at = COALESCE(sold_at, (SELECT MAX(sale_date) FROM sales WHERE sales.quote_id = quotes.id)),
        sale_price = (SELECT SUM(amount) FROM sales WHERE sales.quote_id = quotes.id)
    WHERE id IN (SELECT DISTINCT quote_id FROM sales)
  `).run();
};

exports.down = function() {
  console.log('La migración 003 no se revierte automáticamente');
};
