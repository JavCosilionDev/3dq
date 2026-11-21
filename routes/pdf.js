const express = require('express');
const {
  getDocument,
  saveDocument,
  exportQuotePdf,
  listExports,
  resolveExportFile,
} = require('../services/pdf/exporter');

function sendError(res, error) {
  if (error.name === 'ValidationError') {
    return res.status(422).json({
      error: error.message,
      field: error.field,
      code: error.code,
    });
  }

  console.error(error);
  return res.status(500).json({ error: 'Server error' });
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/quotes/:id/document', (req, res) => {
    try {
      const result = getDocument(db, req.params.id);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.put('/quotes/:id/document', (req, res) => {
    try {
      const input = req.body.document || req.body;
      const result = saveDocument(db, req.params.id, input);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/quotes/:id/pdf', async (req, res) => {
    try {
      const input = req.body.document || null;
      const result = await exportQuotePdf(db, req.params.id, input);
      res.status(result.reused ? 200 : 201).json({
        filename: result.filename,
        folio: result.folio,
        reused: result.reused,
        url: `/api/pdf/exports/${encodeURIComponent(result.filename)}`,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/quotes/:id/exports', (req, res) => {
    try {
      res.json(listExports(db, req.params.id));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/pdf/exports/:filename', (req, res) => {
    try {
      const filePath = resolveExportFile(req.params.filename);
      const disposition = req.query.download === '1' ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${req.params.filename}"`);
      res.sendFile(filePath);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
};
