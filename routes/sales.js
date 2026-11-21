const express = require('express');
const { ValidationError } = require('../services/pdf/errors');

function sendError(res, error) {
  if (error.name === 'ValidationError') {
    return res.status(422).json({ error: error.message, field: error.field, code: error.code });
  }
  console.error(error);
  return res.status(500).json({ error: 'Server error' });
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/sales', (req, res) => {
    try {
      const sales = db.prepare(`
        SELECT
          sales.id,
          sales.quote_id,
          sales.sale_date,
          sales.amount,
          sales.payment_method,
          sales.notes,
          quotes.quote_number,
          quotes.title,
          quotes.customer_name
        FROM sales
        JOIN quotes ON quotes.id = sales.quote_id
        ORDER BY sales.sale_date DESC, sales.id DESC
      `).all();

      const total = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
      res.json({ sales, total });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.patch('/quotes/:id/status', (req, res) => {
    try {
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      if (!quote) {
        throw new ValidationError('Cotización no encontrada', 'quote_id', 'not_found');
      }

      const status = req.body.status;
      if (!['quoted', 'sold', 'cancelled'].includes(status)) {
        throw new ValidationError('Estado no válido', 'status', 'invalid_status');
      }

      const saleDate = req.body.sale_date || new Date().toISOString().slice(0, 10);
      const amount = req.body.amount === undefined || req.body.amount === ''
        ? Number(quote.total_cost)
        : Number(req.body.amount);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new ValidationError('El importe de venta no es válido', 'amount', 'invalid_amount');
      }

      db.transaction(() => {
        db.prepare(`
          UPDATE quotes
          SET status = ?, sold_at = ?, sale_price = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          status,
          status === 'sold' ? saleDate : null,
          status === 'sold' ? amount : null,
          quote.id
        );

        db.prepare('DELETE FROM sales WHERE quote_id = ?').run(quote.id);

        if (status === 'sold') {
          db.prepare(`
            INSERT INTO sales (quote_id, sale_date, amount, payment_method, notes)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            quote.id,
            saleDate,
            amount,
            req.body.payment_method || null,
            req.body.notes || null
          );
        }
      })();

      const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote.id);
      res.json(updated);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
};
