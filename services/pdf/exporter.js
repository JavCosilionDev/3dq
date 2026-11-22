const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildDocument } = require('./document');
const { normalizeDocument } = require('./validate');
const { renderHtml } = require('./template');
const { renderPdf } = require('./renderer');
const { getSettings } = require('./settings');
const { ValidationError } = require('./errors');
const { OUTPUT_FOLIO_PATTERN } = require('./folio');
const { documentImages } = require('../images');

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, '..', '..', 'config');
const PDF_DIR = path.join(CONFIG_DIR, 'pdf');
const CURRENT_DIR = path.join(PDF_DIR, 'current');
const HISTORY_DIR = path.join(PDF_DIR, 'history');

function ensureDirectories() {
  fs.mkdirSync(CURRENT_DIR, { recursive: true });
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(document, templateVersion) {
  return crypto.createHash('sha256').update(stableStringify({ document, templateVersion })).digest('hex');
}

function documentKey(quoteId) {
  return `quote:${quoteId}`;
}

function getStoredDocument(db, quoteId) {
  const row = db.prepare('SELECT * FROM quote_documents WHERE quote_id = ?').get(quoteId);
  return row ? JSON.parse(row.payload_json) : null;
}

function saveDocument(db, quoteId, input) {
  const { document, totals } = normalizeDocument({
    ...input,
    imagenes: documentImages(db, quoteId),
    source_quote_ids: input.source_quote_ids?.length ? input.source_quote_ids : [Number(quoteId)],
  });
  const settings = getSettings(db);
  const templateVersion = settings.pdf_template_version || 'imprematica-v1';
  const key = documentKey(quoteId);

  db.prepare(`
    INSERT INTO quote_documents (
      document_key, quote_id, source_quote_ids, payload_json, template_version
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(document_key) DO UPDATE SET
      source_quote_ids = excluded.source_quote_ids,
      payload_json = excluded.payload_json,
      template_version = excluded.template_version,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    key,
    Number(quoteId),
    JSON.stringify(document.source_quote_ids),
    JSON.stringify(document),
    templateVersion
  );

  return { document, totals };
}

function getDocument(db, quoteId) {
  const stored = getStoredDocument(db, quoteId);
  const input = stored || buildDocument(db, quoteId);
  return normalizeDocument({ ...input, imagenes: documentImages(db, quoteId) });
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function archiveCurrentFile(filename) {
  const currentPath = path.join(CURRENT_DIR, filename);
  if (!fs.existsSync(currentPath)) {
    return;
  }

  const base = path.basename(filename, '.pdf');
  const archivePath = path.join(HISTORY_DIR, `${base}-${timestamp()}.pdf`);
  fs.renameSync(currentPath, archivePath);
}

function writeAtomic(filePath, contents) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, contents);
  fs.renameSync(tempPath, filePath);
}

async function exportQuotePdf(db, quoteId, inputDocument = null) {
  const settings = getSettings(db);
  const templateVersion = settings.pdf_template_version || 'imprematica-v1';
  const stored = inputDocument || getStoredDocument(db, quoteId) || buildDocument(db, quoteId);
  const { document, totals } = normalizeDocument({
    ...stored,
    imagenes: documentImages(db, quoteId),
  });
  const filename = `${document.folio_salida}.pdf`;

  if (!OUTPUT_FOLIO_PATTERN.test(document.folio_salida)) {
    throw new ValidationError('El folio de salida no es válido', 'folio_salida', 'invalid_folio');
  }

  ensureDirectories();

  const payloadHash = hashPayload(document, templateVersion);
  const currentPath = path.join(CURRENT_DIR, filename);
  const latest = db.prepare(`
    SELECT * FROM quote_pdf_exports
    WHERE filename = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(filename);

  if (latest && latest.payload_hash === payloadHash && fs.existsSync(currentPath)) {
    return {
      filename,
      folio: document.folio_salida,
      reused: true,
      path: currentPath,
    };
  }

  const html = renderHtml(document, totals, settings);
  const pdf = await renderPdf(html);

  archiveCurrentFile(filename);
  writeAtomic(currentPath, pdf);

  const audit = {
    document,
    totals,
    template_version: templateVersion,
    payload_hash: payloadHash,
    filename,
    generated_at: new Date().toISOString(),
  };
  writeAtomic(path.join(CURRENT_DIR, `${document.folio_salida}.json`), JSON.stringify(audit, null, 2));

  const saved = saveDocument(db, quoteId, document);
  const documentRow = db.prepare('SELECT id FROM quote_documents WHERE quote_id = ?').get(quoteId);

  db.prepare(`
    INSERT INTO quote_pdf_exports (
      document_id, quote_id, source_quote_ids, folio_origen, folio_salida,
      filename, template_version, payload_hash, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    documentRow?.id || null,
    Number(quoteId),
    JSON.stringify(saved.document.source_quote_ids),
    saved.document.folio_origen,
    saved.document.folio_salida,
    filename,
    templateVersion,
    payloadHash,
    JSON.stringify(saved.document)
  );

  return {
    filename,
    folio: saved.document.folio_salida,
    reused: false,
    path: currentPath,
  };
}

function listExports(db, quoteId) {
  return db.prepare(`
    SELECT id, quote_id, folio_origen, folio_salida, filename, template_version, payload_hash, created_at
    FROM quote_pdf_exports
    WHERE quote_id = ?
    ORDER BY id DESC
  `).all(quoteId);
}

function resolveExportFile(filename) {
  const base = path.basename(filename);
  if (base !== filename || !/^IMP\d{2}-\d{4}[a-z]?\.pdf$/.test(base)) {
    throw new ValidationError('Nombre de archivo no válido', 'filename', 'invalid_filename');
  }

  const filePath = path.join(CURRENT_DIR, base);
  if (!fs.existsSync(filePath)) {
    throw new ValidationError('Archivo no encontrado', 'filename', 'not_found');
  }

  return filePath;
}

module.exports = {
  CONFIG_DIR,
  PDF_DIR,
  getDocument,
  saveDocument,
  exportQuotePdf,
  listExports,
  resolveExportFile,
  hashPayload,
};
