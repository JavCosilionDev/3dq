exports.up = function(db) {
  const quoteColumns = db.prepare('PRAGMA table_info(quotes)').all();
  const quoteColumnNames = new Set(quoteColumns.map((column) => column.name));

  if (!quoteColumnNames.has('status')) {
    db.exec("ALTER TABLE quotes ADD COLUMN status TEXT NOT NULL DEFAULT 'quoted'");
  }
  if (!quoteColumnNames.has('sold_at')) {
    db.exec('ALTER TABLE quotes ADD COLUMN sold_at TEXT');
  }
  if (!quoteColumnNames.has('sale_price')) {
    db.exec('ALTER TABLE quotes ADD COLUMN sale_price REAL');
  }

  const filamentColumns = db.prepare('PRAGMA table_info(quote_filaments)').all();
  if (!filamentColumns.some((column) => column.name === 'material')) {
    db.exec('ALTER TABLE quote_filaments ADD COLUMN material TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_key TEXT NOT NULL UNIQUE,
      quote_id INTEGER,
      source_quote_ids TEXT,
      payload_json TEXT NOT NULL,
      template_version TEXT NOT NULL DEFAULT 'imprematica-v1',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quote_pdf_exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER,
      quote_id INTEGER,
      source_quote_ids TEXT,
      folio_origen TEXT NOT NULL,
      folio_salida TEXT NOT NULL,
      filename TEXT NOT NULL,
      template_version TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES quote_documents(id) ON DELETE SET NULL,
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      sale_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quote_pdf_exports_quote_id
      ON quote_pdf_exports(quote_id);

    CREATE INDEX IF NOT EXISTS idx_quote_pdf_exports_filename
      ON quote_pdf_exports(filename);

    CREATE INDEX IF NOT EXISTS idx_sales_quote_id
      ON sales(quote_id);
  `);

  db.prepare(`
    UPDATE quote_filaments
    SET material = (
      SELECT filaments.type
      FROM filaments
      WHERE filaments.id = quote_filaments.filament_id
    )
    WHERE material IS NULL
  `).run();

  const defaults = {
    company_name: 'Impremática',
    accent_color: '#0060FA',
    pdf_brand_name: 'Impremática',
    pdf_brand_url: 'imprematica.com',
    pdf_logo_path: 'assets/images/imprematica-logo.png',
    pdf_template_version: 'imprematica-v1',
    pdf_currency_code: 'MXN',
    pdf_shipping_note: 'Entrega estimada: 2 días hábiles en promedio.',
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run(key, value);
  }

  db.prepare("UPDATE settings SET value = 'Impremática' WHERE key = 'company_name'").run();
  db.prepare("UPDATE settings SET value = '#0060FA' WHERE key = 'accent_color'").run();
};

exports.down = function() {
  console.log('La migración 002 no se revierte automáticamente');
};
