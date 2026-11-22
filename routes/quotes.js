const express = require('express');
const { getNextQuoteNumber } = require('../utils/quote-number');
const { listQuoteImages, copyQuoteImages, deleteQuoteImageFiles } = require('../services/images');

// Export a function that accepts a database instance
module.exports = (db) => {
  const router = express.Router();

// Get all quotes
router.get('/', (req, res) => {
  try {
    const quotes = db.prepare('SELECT * FROM quotes ORDER BY created_at DESC').all();
    res.json(quotes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single quote with all related data
router.get('/:id', (req, res) => {
  try {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Get filaments used in this quote
    const filaments = db.prepare('SELECT * FROM quote_filaments WHERE quote_id = ?').all(req.params.id);
    
    // Get hardware used in this quote
    const hardware = db.prepare('SELECT * FROM quote_hardware WHERE quote_id = ?').all(req.params.id);
    
    // Get print setup for this quote
    const printSetup = db.prepare('SELECT * FROM quote_print_setup WHERE quote_id = ?').get(req.params.id);
    
    // Get labour for this quote
    const labour = db.prepare('SELECT * FROM quote_labour WHERE quote_id = ?').get(req.params.id);
    
    const images = listQuoteImages(db, req.params.id);
    const sales = db.prepare(`
      SELECT * FROM sales
      WHERE quote_id = ?
      ORDER BY sale_date DESC, id DESC
    `).all(req.params.id);

    const documentRow = db.prepare(`
      SELECT payload_json, source_quote_ids, template_version
      FROM quote_documents
      WHERE quote_id = ?
    `).get(req.params.id);

    let document = null;
    let sourceQuoteIds = [];
    if (documentRow) {
      try {
        document = JSON.parse(documentRow.payload_json);
      } catch (parseError) {
        document = null;
      }
      try {
        sourceQuoteIds = JSON.parse(documentRow.source_quote_ids || '[]');
      } catch (parseError) {
        sourceQuoteIds = [];
      }
    }

    const sourceQuotes = sourceQuoteIds.length > 0
      ? db.prepare(`
          SELECT id, quote_number, title, customer_name
          FROM quotes
          WHERE id IN (${sourceQuoteIds.map(() => '?').join(',')})
        `).all(...sourceQuoteIds)
      : [];

    const quoteData = {
      ...quote,
      filaments,
      hardware,
      print_setup: printSetup,
      labour,
      images,
      sales,
      document,
      source_quotes: sourceQuotes,
      template_version: documentRow?.template_version || null
    };
    
    res.json(quoteData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new quote
router.post('/', (req, res) => {
  try {
    const {
      quote_number,
      title,
      customer_name,
      date,
      notes,
      markup_percent,
      discount_percent,
      total_cost,
      quantity,
      filaments,
      hardware,
      print_setup,
      labour
    } = req.body;
    
    // Validate required fields
    if (!quote_number || !customer_name) {
      return res.status(400).json({ error: 'Quote number and customer name are required' });
    }
    
    // Start a transaction
    db.transaction(() => {
      // Insert quote
      const quoteStmt = db.prepare(`
        INSERT INTO quotes (
          quote_number, title, customer_name, date, notes, 
          markup_percent, discount_percent, total_cost, quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const quoteInfo = quoteStmt.run(
        quote_number,
        title || `${quote_number} - ${customer_name}`,
        customer_name,
        date,
        notes || null,
        markup_percent,
        discount_percent || 0,
        total_cost,
        quantity || 1
      );
      
      const quoteId = quoteInfo.lastInsertRowid;
      
      // Insert filaments
      if (filaments && filaments.length > 0) {
        const filamentStmt = db.prepare(`
          INSERT INTO quote_filaments (
            quote_id, filament_id, filament_name, filament_price_per_gram,
            grams_used, total_cost, material, color_name, color_hex, purge_grams
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        filaments.forEach(filament => {
          filamentStmt.run(
            quoteId,
            filament.filament_id,
            filament.filament_name,
            filament.filament_price_per_gram,
            filament.grams_used,
            filament.total_cost,
            filament.material || null,
            filament.color_name || null,
            filament.color_hex || null,
            Number(filament.purge_grams) || 0
          );
        });
      }
      
      // Insert hardware
      if (hardware && hardware.length > 0) {
        const hardwareStmt = db.prepare(`
          INSERT INTO quote_hardware (
            quote_id, hardware_id, hardware_name, quantity,
            unit_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        hardware.forEach(item => {
          hardwareStmt.run(
            quoteId,
            item.hardware_id,
            item.hardware_name,
            item.quantity,
            item.unit_price,
            item.total_cost
          );
        });
      }
      
      // Insert print setup
      if (print_setup) {
        const printSetupStmt = db.prepare(`
          INSERT INTO quote_print_setup (
            quote_id, printer_id, printer_name, print_time,
            power_cost, depreciation_cost
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        printSetupStmt.run(
          quoteId,
          print_setup.printer_id,
          print_setup.printer_name,
          print_setup.print_time,
          print_setup.power_cost,
          print_setup.depreciation_cost
        );
      }
      
      // Insert labour
      if (labour) {
        const labourStmt = db.prepare(`
          INSERT INTO quote_labour (
            quote_id, design_minutes, preparation_minutes,
            post_processing_minutes, other_minutes,
            labour_rate_per_hour, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        labourStmt.run(
          quoteId,
          labour.design_minutes,
          labour.preparation_minutes,
          labour.post_processing_minutes,
          labour.other_minutes,
          labour.labour_rate_per_hour,
          labour.total_cost
        );
      }
      
      // Return the new quote ID
      res.status(201).json({ id: quoteId });
    })();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Duplicate an existing quote
router.post('/:id/duplicate', (req, res) => {
  try {
    const sourceQuote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);

    if (!sourceQuote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const duplicatedQuote = db.transaction(() => {
      // Create the new quote with the next available quote number
      const quoteInfo = db.prepare(`
        INSERT INTO quotes (
          quote_number, title, customer_name, date, notes,
          markup_percent, discount_percent, total_cost, quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        getNextQuoteNumber(db),
        sourceQuote.title,
        sourceQuote.customer_name,
        sourceQuote.date,
        sourceQuote.notes,
        sourceQuote.markup_percent,
        sourceQuote.discount_percent,
        sourceQuote.total_cost,
        sourceQuote.quantity || 1
      );

      const newQuoteId = quoteInfo.lastInsertRowid;

      // Copy all related quote data
      db.prepare(`
        INSERT INTO quote_filaments (
          quote_id, filament_id, filament_name, filament_price_per_gram,
          grams_used, total_cost, material, color_name, color_hex, purge_grams
        )
        SELECT ?, filament_id, filament_name, filament_price_per_gram,
               grams_used, total_cost, material, color_name, color_hex, purge_grams
        FROM quote_filaments
        WHERE quote_id = ?
      `).run(newQuoteId, sourceQuote.id);

      db.prepare(`
        INSERT INTO quote_hardware (
          quote_id, hardware_id, hardware_name, quantity, unit_price, total_cost
        )
        SELECT ?, hardware_id, hardware_name, quantity, unit_price, total_cost
        FROM quote_hardware
        WHERE quote_id = ?
      `).run(newQuoteId, sourceQuote.id);

      db.prepare(`
        INSERT INTO quote_print_setup (
          quote_id, printer_id, printer_name, print_time,
          power_cost, depreciation_cost
        )
        SELECT ?, printer_id, printer_name, print_time,
               power_cost, depreciation_cost
        FROM quote_print_setup
        WHERE quote_id = ?
      `).run(newQuoteId, sourceQuote.id);

      db.prepare(`
        INSERT INTO quote_labour (
          quote_id, design_minutes, preparation_minutes,
          post_processing_minutes, other_minutes,
          labour_rate_per_hour, total_cost
        )
        SELECT ?, design_minutes, preparation_minutes,
               post_processing_minutes, other_minutes,
               labour_rate_per_hour, total_cost
        FROM quote_labour
        WHERE quote_id = ?
      `).run(newQuoteId, sourceQuote.id);

      copyQuoteImages(db, sourceQuote.id, newQuoteId);

      const createdQuote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(newQuoteId);

      return {
        ...createdQuote,
        filaments: db.prepare('SELECT * FROM quote_filaments WHERE quote_id = ?').all(newQuoteId),
        hardware: db.prepare('SELECT * FROM quote_hardware WHERE quote_id = ?').all(newQuoteId),
        print_setup: db.prepare('SELECT * FROM quote_print_setup WHERE quote_id = ?').get(newQuoteId) || null,
        labour: db.prepare('SELECT * FROM quote_labour WHERE quote_id = ?').get(newQuoteId) || null,
        images: listQuoteImages(db, newQuoteId)
      };
    })();

    res.status(201).json(duplicatedQuote);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update an existing quote
router.put('/:id', (req, res) => {
  try {
    const {
      title,
      customer_name,
      date,
      notes,
      markup_percent,
      discount_percent,
      total_cost,
      filaments,
      hardware,
      print_setup,
      labour,
      quantity
    } = req.body;
    
    // Validate required fields
    if (!customer_name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    
    // Check if quote exists
    const existingQuote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!existingQuote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Start a transaction
    db.transaction(() => {
      // Update quote
      const quoteStmt = db.prepare(`
        UPDATE quotes SET 
          quote_number = ?, 
          title = ?, 
          customer_name = ?, 
          date = ?, 
          notes = ?, 
          markup_percent = ?,
          discount_percent = ?,
          total_cost = ?,
          quantity = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      quoteStmt.run(
        existingQuote.quote_number,
        title || existingQuote.title,
        customer_name,
        date || existingQuote.date,
        notes,
        markup_percent,
        discount_percent || 0,
        total_cost,
        quantity || 1,
        req.params.id
      );
      
      // Delete existing filaments
      db.prepare('DELETE FROM quote_filaments WHERE quote_id = ?').run(req.params.id);
      
      // Insert new filaments
      if (filaments && filaments.length > 0) {
        const filamentStmt = db.prepare(`
          INSERT INTO quote_filaments (
            quote_id, filament_id, filament_name, filament_price_per_gram,
            grams_used, total_cost, material, color_name, color_hex, purge_grams
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        filaments.forEach(filament => {
          filamentStmt.run(
            req.params.id,
            filament.filament_id,
            filament.filament_name,
            filament.filament_price_per_gram,
            filament.grams_used,
            filament.total_cost,
            filament.material || null,
            filament.color_name || null,
            filament.color_hex || null,
            Number(filament.purge_grams) || 0
          );
        });
      }
      
      // Delete existing hardware
      db.prepare('DELETE FROM quote_hardware WHERE quote_id = ?').run(req.params.id);
      
      // Insert new hardware
      if (hardware && hardware.length > 0) {
        const hardwareStmt = db.prepare(`
          INSERT INTO quote_hardware (
            quote_id, hardware_id, hardware_name, quantity,
            unit_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        hardware.forEach(item => {
          hardwareStmt.run(
            req.params.id,
            item.hardware_id,
            item.hardware_name,
            item.quantity,
            item.unit_price,
            item.total_cost
          );
        });
      }
      
      // Delete existing print setup
      db.prepare('DELETE FROM quote_print_setup WHERE quote_id = ?').run(req.params.id);
      
      // Insert new print setup
      if (print_setup) {
        const printSetupStmt = db.prepare(`
          INSERT INTO quote_print_setup (
            quote_id, printer_id, printer_name, print_time,
            power_cost, depreciation_cost
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        printSetupStmt.run(
          req.params.id,
          print_setup.printer_id,
          print_setup.printer_name,
          print_setup.print_time,
          print_setup.power_cost,
          print_setup.depreciation_cost
        );
      }
      
      // Delete existing labour
      db.prepare('DELETE FROM quote_labour WHERE quote_id = ?').run(req.params.id);
      
      // Insert new labour
      if (labour) {
        const labourStmt = db.prepare(`
          INSERT INTO quote_labour (
            quote_id, design_minutes, preparation_minutes,
            post_processing_minutes, other_minutes,
            labour_rate_per_hour, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        labourStmt.run(
          req.params.id,
          labour.design_minutes,
          labour.preparation_minutes,
          labour.post_processing_minutes,
          labour.other_minutes,
          labour.labour_rate_per_hour,
          labour.total_cost
        );
      }
      
      res.json({ success: true });
    })();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a quote
router.delete('/:id', (req, res) => {
  try {
    // Check if quote exists
    const existingQuote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!existingQuote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Start a transaction
    db.transaction(() => {
      // Delete related data
      deleteQuoteImageFiles(db, req.params.id);
      db.prepare('DELETE FROM quote_filaments WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quote_hardware WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quote_print_setup WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quote_labour WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM sales WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quote_images WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quote_documents WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quote_pdf_exports WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quote_image_exports WHERE quote_id = ?').run(req.params.id);
      
      // Delete quote
      db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
      
      res.json({ success: true });
    })();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a quick quote
router.post('/quick', (req, res) => {
  try {
    const {
      quote_number,
      title,
      customer_name,
      date,
      notes,
      markup_percent,
      discount_percent,
      total_cost
    } = req.body;
    
    // Validate required fields
    if (!quote_number || !customer_name || !total_cost) {
      return res.status(400).json({ error: 'Quote number, customer name, and total cost are required' });
    }
    
    // Insert quote
    const quoteStmt = db.prepare(`
      INSERT INTO quotes (
        quote_number, title, customer_name, date, notes, 
        markup_percent, discount_percent, total_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const quoteInfo = quoteStmt.run(
      quote_number,
      title || `${quote_number} - ${customer_name}`,
      customer_name,
      date,
      notes || null,
      markup_percent || 0,
      discount_percent || 0,
      total_cost
    );
    
    const quoteId = quoteInfo.lastInsertRowid;
    
    // Return the new quote ID
    res.status(201).json({ id: quoteId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});




  return router;
};
