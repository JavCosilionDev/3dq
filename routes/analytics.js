const express = require('express');

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day);
  return result;
}

function shortDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

module.exports = (db) => {
  const router = express.Router();

  router.get('/analytics', (req, res) => {
    try {
      const sales = db.prepare(`
        SELECT sales.*, quotes.quote_number, quotes.title, quotes.customer_name
        FROM sales
        JOIN quotes ON quotes.id = sales.quote_id
        ORDER BY sales.sale_date ASC, sales.id ASC
      `).all();

      const totalQuotes = db.prepare('SELECT COUNT(*) AS count FROM quotes').get().count;
      const soldQuoteIds = new Set(sales.map((sale) => sale.quote_id));

      const filamentRows = db.prepare(`
        SELECT quote_filaments.*
        FROM quote_filaments
        WHERE quote_filaments.quote_id IN (SELECT DISTINCT quote_id FROM sales)
      `).all();

      const printRows = db.prepare(`
        SELECT quote_print_setup.printer_name, quote_print_setup.print_time
        FROM quote_print_setup
        WHERE quote_print_setup.quote_id IN (SELECT DISTINCT quote_id FROM sales)
      `).all();

      const totalFilament = filamentRows.reduce((sum, row) => sum + Number(row.grams_used || 0), 0);
      const totalPurge = filamentRows.reduce((sum, row) => sum + Number(row.purge_grams || 0), 0);
      const revenue = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
      const iva = sales.reduce((sum, sale) => sum + Number(sale.iva_amount || 0), 0);
      const net = sales.reduce((sum, sale) => sum + Number(sale.subtotal || 0), 0);
      const printMinutes = printRows.reduce((sum, row) => sum + Number(row.print_time || 0), 0);

      const weeklyMap = new Map();
      const now = new Date();
      const firstWeek = startOfWeek(now);
      firstWeek.setDate(firstWeek.getDate() - 11 * 7);
      for (let index = 0; index < 12; index += 1) {
        const week = new Date(firstWeek);
        week.setDate(week.getDate() + index * 7);
        weeklyMap.set(week.getTime(), { label: shortDate(week), total: 0, iva: 0, count: 0 });
      }

      const monthlyMap = new Map();
      for (let index = 11; index >= 0; index -= 1) {
        const month = new Date(now.getFullYear(), now.getMonth() - index, 1, 12);
        const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(key, {
          label: `${MONTHS[month.getMonth()]} ${String(month.getFullYear()).slice(2)}`,
          total: 0,
          count: 0,
        });
      }

      const materials = new Map();
      const colors = new Map();
      const payments = new Map();
      const models = new Map();
      const printers = new Map();

      for (const sale of sales) {
        const date = parseDate(sale.sale_date);
        const week = weeklyMap.get(startOfWeek(date).getTime());
        if (week) {
          week.total += Number(sale.amount || 0);
          week.iva += Number(sale.iva_amount || 0);
          week.count += 1;
        }

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const month = monthlyMap.get(monthKey);
        if (month) {
          month.total += Number(sale.amount || 0);
          month.count += 1;
        }

        const payment = sale.payment_method || 'Sin especificar';
        const paymentEntry = payments.get(payment) || { name: payment, total: 0, count: 0 };
        paymentEntry.total += Number(sale.amount || 0);
        paymentEntry.count += 1;
        payments.set(payment, paymentEntry);

        const modelKey = sale.title || sale.quote_number;
        const modelEntry = models.get(modelKey) || {
          name: modelKey,
          quote_number: sale.quote_number,
          total: 0,
          count: 0,
        };
        modelEntry.total += Number(sale.amount || 0);
        modelEntry.count += 1;
        models.set(modelKey, modelEntry);
      }

      for (const row of filamentRows) {
        const material = row.material || row.filament_name || 'Sin material';
        const materialEntry = materials.get(material) || {
          name: material,
          grams: 0,
          purge: 0,
        };
        materialEntry.grams += Number(row.grams_used || 0);
        materialEntry.purge += Number(row.purge_grams || 0);
        materials.set(material, materialEntry);

        const colorName = row.color_name || 'Sin color';
        const colorKey = `${material}|${colorName}|${row.color_hex || ''}`;
        const colorEntry = colors.get(colorKey) || {
          name: colorName,
          material,
          hex: row.color_hex || null,
          grams: 0,
          purge: 0,
        };
        colorEntry.grams += Number(row.grams_used || 0);
        colorEntry.purge += Number(row.purge_grams || 0);
        colors.set(colorKey, colorEntry);
      }

      for (const row of printRows) {
        const name = row.printer_name || 'Sin impresora';
        const entry = printers.get(name) || { name, minutes: 0, jobs: 0 };
        entry.minutes += Number(row.print_time || 0);
        entry.jobs += 1;
        printers.set(name, entry);
      }

      const weekly = Array.from(weeklyMap.values()).map((week) => ({
        ...week,
        total: round(week.total),
        iva: round(week.iva),
      }));

      const monthly = Array.from(monthlyMap.values()).map((month) => ({
        ...month,
        total: round(month.total),
      }));

      res.json({
        summary: {
          revenue: round(revenue),
          iva: round(iva),
          net: round(net),
          saleCount: sales.length,
          averageTicket: sales.length > 0 ? round(revenue / sales.length) : 0,
          soldQuotes: soldQuoteIds.size,
          totalQuotes,
          conversion: totalQuotes > 0 ? round((soldQuoteIds.size / totalQuotes) * 100) : 0,
          filamentGrams: round(totalFilament),
          purgeGrams: round(totalPurge),
          wasteRatio: totalFilament + totalPurge > 0
            ? round((totalPurge / (totalFilament + totalPurge)) * 100)
            : 0,
          printHours: round(printMinutes / 60),
        },
        weekly,
        monthly,
        materials: Array.from(materials.values())
          .map((entry) => ({ ...entry, grams: round(entry.grams), purge: round(entry.purge) }))
          .sort((a, b) => b.grams - a.grams),
        colors: Array.from(colors.values())
          .map((entry) => ({ ...entry, grams: round(entry.grams), purge: round(entry.purge) }))
          .sort((a, b) => b.grams - a.grams),
        payments: Array.from(payments.values())
          .map((entry) => ({ ...entry, total: round(entry.total) }))
          .sort((a, b) => b.total - a.total),
        models: Array.from(models.values())
          .map((entry) => ({ ...entry, total: round(entry.total) }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 8),
        printers: Array.from(printers.values())
          .map((entry) => ({ ...entry, minutes: Math.round(entry.minutes) }))
          .sort((a, b) => b.minutes - a.minutes),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
