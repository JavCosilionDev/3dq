const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ValidationError } = require('./pdf/errors');

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, '..', 'config');
const UPLOAD_DIR = path.join(CONFIG_DIR, 'uploads', 'quotes');
const MAX_BYTES = 12 * 1024 * 1024;
const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function quoteUploadDir(quoteId) {
  return path.join(UPLOAD_DIR, String(quoteId));
}

function imageUrl(row) {
  return `/api/quotes/${row.quote_id}/images/${row.id}/file?v=${row.sha256.slice(0, 10)}`;
}

function mapImage(row) {
  return {
    ...row,
    is_primary: Boolean(row.is_primary),
    url: imageUrl(row),
  };
}

function listQuoteImages(db, quoteId) {
  return db.prepare(`
    SELECT *
    FROM quote_images
    WHERE quote_id = ?
    ORDER BY is_primary DESC, sort_order ASC, id ASC
  `).all(quoteId).map(mapImage);
}

function documentImages(db, quoteId) {
  return listQuoteImages(db, quoteId).map((image) => ({
    id: image.id,
    filename: image.filename,
    archivo: image.stored_path,
    mime_type: image.mime_type,
    sha256: image.sha256,
    alt: image.alt || null,
    primaria: image.is_primary,
  }));
}

function normalizeMimeType(value) {
  const mimeType = String(value || '').toLowerCase();
  if (!MIME_EXTENSIONS[mimeType]) {
    throw new ValidationError('El formato de imagen no es válido', 'mime_type', 'invalid_mime');
  }
  return mimeType;
}

function decodePayload(data) {
  const raw = String(data || '');
  const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length === 0) {
    throw new ValidationError('La imagen está vacía', 'data', 'empty_file');
  }
  if (buffer.length > MAX_BYTES) {
    throw new ValidationError('La imagen supera 12 MB', 'data', 'file_too_large');
  }

  return buffer;
}

function ensureQuote(db, quoteId) {
  const quote = db.prepare('SELECT id FROM quotes WHERE id = ?').get(quoteId);
  if (!quote) {
    throw new ValidationError('Cotización no encontrada', 'quote_id', 'not_found');
  }
  return quote;
}

function saveQuoteImage(db, quoteId, input) {
  ensureQuote(db, quoteId);

  const mimeType = normalizeMimeType(input.mime_type);
  const buffer = decodePayload(input.data);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const extension = MIME_EXTENSIONS[mimeType];
  const directory = quoteUploadDir(quoteId);
  fs.mkdirSync(directory, { recursive: true });

  const filename = `${crypto.randomUUID()}.${extension}`;
  const storedPath = path.join('uploads', 'quotes', String(quoteId), filename);
  const absolutePath = path.join(CONFIG_DIR, storedPath);
  const tempPath = `${absolutePath}.tmp`;
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, absolutePath);

  const existing = db.prepare('SELECT COUNT(*) AS count FROM quote_images WHERE quote_id = ?').get(quoteId);
  const isPrimary = existing.count === 0 || Boolean(input.is_primary);
  const sortOrder = Number(input.sort_order) || existing.count;

  const result = db.transaction(() => {
    if (isPrimary) {
      db.prepare('UPDATE quote_images SET is_primary = 0 WHERE quote_id = ?').run(quoteId);
    }

    const inserted = db.prepare(`
      INSERT INTO quote_images (
        quote_id, filename, stored_path, mime_type, sha256, alt, is_primary, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quoteId,
      String(input.filename || filename).slice(0, 200),
      storedPath,
      mimeType,
      sha256,
      input.alt ? String(input.alt).slice(0, 300) : null,
      isPrimary ? 1 : 0,
      sortOrder
    );

    return db.prepare('SELECT * FROM quote_images WHERE id = ?').get(inserted.lastInsertRowid);
  })();

  return mapImage(result);
}

function updateQuoteImage(db, quoteId, imageId, input) {
  const image = db.prepare('SELECT * FROM quote_images WHERE id = ? AND quote_id = ?').get(imageId, quoteId);
  if (!image) {
    throw new ValidationError('Imagen no encontrada', 'image_id', 'not_found');
  }

  db.transaction(() => {
    if (input.is_primary === true) {
      db.prepare('UPDATE quote_images SET is_primary = 0 WHERE quote_id = ?').run(quoteId);
      db.prepare('UPDATE quote_images SET is_primary = 1 WHERE id = ?').run(imageId);
    }

    if (input.alt !== undefined) {
      db.prepare('UPDATE quote_images SET alt = ? WHERE id = ?').run(
        input.alt ? String(input.alt).slice(0, 300) : null,
        imageId
      );
    }
  })();

  return mapImage(db.prepare('SELECT * FROM quote_images WHERE id = ?').get(imageId));
}

function removeFile(storedPath) {
  if (!storedPath) return;
  const absolutePath = path.join(CONFIG_DIR, storedPath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

function deleteQuoteImage(db, quoteId, imageId) {
  const image = db.prepare('SELECT * FROM quote_images WHERE id = ? AND quote_id = ?').get(imageId, quoteId);
  if (!image) {
    throw new ValidationError('Imagen no encontrada', 'image_id', 'not_found');
  }

  db.prepare('DELETE FROM quote_images WHERE id = ?').run(imageId);

  if (image.is_primary) {
    const next = db.prepare(`
      SELECT id FROM quote_images
      WHERE quote_id = ?
      ORDER BY sort_order ASC, id ASC
      LIMIT 1
    `).get(quoteId);

    if (next) {
      db.prepare('UPDATE quote_images SET is_primary = 1 WHERE id = ?').run(next.id);
    }
  }

  removeFile(image.stored_path);
  return { success: true };
}

function resolveImageFile(db, quoteId, imageId) {
  const image = db.prepare('SELECT * FROM quote_images WHERE id = ? AND quote_id = ?').get(imageId, quoteId);
  if (!image) {
    throw new ValidationError('Imagen no encontrada', 'image_id', 'not_found');
  }

  const absolutePath = path.join(CONFIG_DIR, image.stored_path);
  if (!fs.existsSync(absolutePath)) {
    throw new ValidationError('Archivo de imagen no encontrado', 'image_id', 'file_not_found');
  }

  return { image, absolutePath };
}

function deleteQuoteImageFiles(db, quoteId) {
  const images = db.prepare('SELECT stored_path FROM quote_images WHERE quote_id = ?').all(quoteId);
  for (const image of images) {
    removeFile(image.stored_path);
  }
}

function copyQuoteImages(db, sourceQuoteId, targetQuoteId) {
  const images = db.prepare('SELECT * FROM quote_images WHERE quote_id = ? ORDER BY sort_order ASC, id ASC').all(sourceQuoteId);
  if (images.length === 0) return;

  const directory = quoteUploadDir(targetQuoteId);
  fs.mkdirSync(directory, { recursive: true });

  const insert = db.prepare(`
    INSERT INTO quote_images (
      quote_id, filename, stored_path, mime_type, sha256, alt, is_primary, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  images.forEach((image, index) => {
    const sourcePath = path.join(CONFIG_DIR, image.stored_path);
    if (!fs.existsSync(sourcePath)) return;

    const extension = path.extname(image.stored_path) || '.png';
    const filename = `${crypto.randomUUID()}${extension}`;
    const storedPath = path.join('uploads', 'quotes', String(targetQuoteId), filename);
    fs.copyFileSync(sourcePath, path.join(CONFIG_DIR, storedPath));

    insert.run(
      targetQuoteId,
      image.filename,
      storedPath,
      image.mime_type,
      image.sha256,
      image.alt,
      index === 0 ? 1 : 0,
      image.sort_order
    );
  });
}

module.exports = {
  CONFIG_DIR,
  UPLOAD_DIR,
  listQuoteImages,
  documentImages,
  saveQuoteImage,
  updateQuoteImage,
  deleteQuoteImage,
  deleteQuoteImageFiles,
  copyQuoteImages,
  resolveImageFile,
};
