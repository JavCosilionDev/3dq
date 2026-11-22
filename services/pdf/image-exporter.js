const fs = require('fs');
const path = require('path');
const { buildDocument } = require('./document');
const { normalizeDocument } = require('./validate');
const { renderImageHtml } = require('./template');
const { renderPng } = require('./renderer');
const { getSettings } = require('./settings');
const { ValidationError } = require('./errors');
const { OUTPUT_FOLIO_PATTERN } = require('./folio');
const { hashPayload } = require('./exporter');
const { documentImages } = require('../images');

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, '..', '..', 'config');
const IMAGE_DIR = path.join(CONFIG_DIR, 'pdf', 'images');
const CURRENT_DIR = path.join(IMAGE_DIR, 'current');
const HISTORY_DIR = path.join(IMAGE_DIR, 'history');
const PNG_PATTERN = /^IMP\d{2}-\d{4}[a-z]?\.png$/;

function ensureDirectories() {
  fs.mkdirSync(CURRENT_DIR, { recursive: true });
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function archiveCurrentFile(filename) {
  const currentPath = path.join(CURRENT_DIR, filename);
  if (!fs.existsSync(currentPath)) return;

  const base = path.basename(filename, '.png');
  fs.renameSync(currentPath, path.join(HISTORY_DIR, `${base}-${timestamp()}.png`));
}

function writeAtomic(filePath, contents) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, contents);
  fs.renameSync(tempPath, filePath);
}

async function exportQuotePng(db, quoteId, inputDocument = null) {
  const settings = getSettings(db);
  const templateVersion = settings.pdf_template_version || 'imprematica-v1';
  const stored = inputDocument || buildDocument(db, quoteId);
  const { document, totals } = normalizeDocument({
    ...stored,
    imagenes: documentImages(db, quoteId),
  });

  if (!OUTPUT_FOLIO_PATTERN.test(document.folio_salida)) {
    throw new ValidationError('El folio de salida no es válido', 'folio_salida', 'invalid_folio');
  }

  ensureDirectories();

  const filename = `${document.folio_salida}.png`;
  const payloadHash = hashPayload(document, `${templateVersion}-png`);
  const currentPath = path.join(CURRENT_DIR, filename);
  const latest = db.prepare(`
    SELECT * FROM quote_image_exports
    WHERE filename = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(filename);

  if (latest && latest.payload_hash === payloadHash && fs.existsSync(currentPath)) {
    return { filename, folio: document.folio_salida, reused: true, path: currentPath };
  }

  const html = renderImageHtml(document, totals, settings);
  const png = await renderPng(html);

  archiveCurrentFile(filename);
  writeAtomic(currentPath, png);

  const audit = {
    document,
    totals,
    template_version: templateVersion,
    payload_hash: payloadHash,
    filename,
    generated_at: new Date().toISOString(),
  };
  writeAtomic(path.join(CURRENT_DIR, `${document.folio_salida}.json`), JSON.stringify(audit, null, 2));

  db.prepare(`
    INSERT INTO quote_image_exports (
      quote_id, folio, filename, payload_hash, template_version
    ) VALUES (?, ?, ?, ?, ?)
  `).run(Number(quoteId), document.folio_salida, filename, payloadHash, templateVersion);

  return { filename, folio: document.folio_salida, reused: false, path: currentPath };
}

function listImageExports(db, quoteId) {
  return db.prepare(`
    SELECT id, quote_id, folio, filename, template_version, payload_hash, created_at
    FROM quote_image_exports
    WHERE quote_id = ?
    ORDER BY id DESC
  `).all(quoteId);
}

function resolveImageExportFile(filename) {
  const base = path.basename(filename);
  if (base !== filename || !PNG_PATTERN.test(base)) {
    throw new ValidationError('Nombre de archivo no válido', 'filename', 'invalid_filename');
  }

  const filePath = path.join(CURRENT_DIR, base);
  if (!fs.existsSync(filePath)) {
    throw new ValidationError('Archivo no encontrado', 'filename', 'not_found');
  }

  return filePath;
}

module.exports = {
  exportQuotePng,
  listImageExports,
  resolveImageExportFile,
};
