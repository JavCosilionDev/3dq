const express = require('express');
const {
  listQuoteImages,
  saveQuoteImage,
  updateQuoteImage,
  deleteQuoteImage,
  resolveImageFile,
} = require('../services/images');

function sendError(res, error) {
  if (error.name === 'ValidationError') {
    return res.status(422).json({ error: error.message, field: error.field, code: error.code });
  }

  console.error(error);
  return res.status(500).json({ error: 'Server error' });
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/quotes/:id/images', (req, res) => {
    try {
      res.json({ images: listQuoteImages(db, req.params.id) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/quotes/:id/images', (req, res) => {
    try {
      const image = saveQuoteImage(db, req.params.id, req.body);
      res.status(201).json({ image });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.patch('/quotes/:id/images/:imageId', (req, res) => {
    try {
      const image = updateQuoteImage(db, req.params.id, req.params.imageId, req.body);
      res.json({ image });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete('/quotes/:id/images/:imageId', (req, res) => {
    try {
      res.json(deleteQuoteImage(db, req.params.id, req.params.imageId));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/quotes/:id/images/:imageId/file', (req, res) => {
    try {
      const { image, absolutePath } = resolveImageFile(db, req.params.id, req.params.imageId);
      res.setHeader('Content-Type', image.mime_type);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(absolutePath);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
};
