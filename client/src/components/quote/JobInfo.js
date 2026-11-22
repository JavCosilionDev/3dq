import React, { useState, useEffect, useContext } from 'react';
import {
  Grid,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import SettingsContext from '../../context/SettingsContext';

function JobInfo({ formData, handleInputChange, isEditMode }) {
  const { settings } = useContext(SettingsContext);
  const [nextQuoteNumber, setNextQuoteNumber] = useState('');
  const [loading, setLoading] = useState(!isEditMode);

  // Fetch next quote number when component mounts (only for new quotes)
  useEffect(() => {
    if (!isEditMode) {
      const fetchNextQuoteNumber = async () => {
        try {
          const response = await fetch('/api/settings/quote/next-number');
          if (!response.ok) {
            throw new Error('Failed to fetch next quote number');
          }
          const data = await response.json();
          setNextQuoteNumber(data.quote_number);
          // Initialize the quote_number field in formData if it's not already set
          if (!formData.quote_number) {
            handleInputChange({
              target: {
                name: 'quote_number',
                value: data.quote_number
              }
            });
          }
          setLoading(false);
        } catch (error) {
          console.error('Error fetching next quote number:', error);
          setLoading(false);
        }
      };

      fetchNextQuoteNumber();
    }
  }, [isEditMode, handleInputChange, formData.quote_number]);

  // Initialize markup from settings only for new quotes
  useEffect(() => {
    if (!isEditMode && settings?.default_markup_percent && !formData.markup) {
      handleInputChange({
        target: {
          name: 'markup',
          value: parseFloat(settings.default_markup_percent)
        }
      });
    }

    // Initialize quantity to 1 if not set
    if (!formData.quantity) {
      handleInputChange({
        target: {
          name: 'quantity',
          value: 1
        }
      });
    }
  }, [isEditMode, settings, formData.markup, formData.quantity, handleInputChange]);

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 2 }}>
      <Typography variant="h6">Datos del trabajo</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        Cliente, modelo y condiciones comerciales.
      </Typography>

      {loading ? (
        <CircularProgress sx={{ my: 4, mx: 'auto', display: 'block' }} />
      ) : (
        <Grid container spacing={{ xs: 1.5, sm: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="quote_number"
              label="Folio"
              value={formData.quote_number || nextQuoteNumber}
              onChange={handleInputChange}
              fullWidth
              size="small"
              required
              disabled={isEditMode}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="customer_name"
              label="Cliente"
              value={formData.customer_name}
              onChange={handleInputChange}
              fullWidth
              size="small"
              required
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="title"
              label="Modelo"
              value={formData.title}
              onChange={handleInputChange}
              fullWidth
              size="small"
              required
              placeholder="Nombre del modelo 3D"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="date"
              label="Fecha"
              type="date"
              value={formData.date}
              onChange={handleInputChange}
              fullWidth
              size="small"
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={6} sm={4} md={3}>
            <TextField
              name="markup"
              label="Margen"
              type="number"
              value={formData.markup ?? 0}
              onChange={handleInputChange}
              fullWidth
              size="small"
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
                inputProps: { min: 0 }
              }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <TextField
              name="discount"
              label="Descuento"
              type="number"
              value={formData.discount || 0}
              onChange={handleInputChange}
              fullWidth
              size="small"
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
                inputProps: { min: 0, max: 100 }
              }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <TextField
              name="quantity"
              label="Cantidad"
              type="number"
              value={formData.quantity || 1}
              onChange={handleInputChange}
              fullWidth
              size="small"
              required
              InputProps={{ inputProps: { min: 1 } }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              name="notes"
              label="Notas (opcional)"
              value={formData.notes}
              onChange={handleInputChange}
              fullWidth
              size="small"
              multiline
              minRows={2}
              maxRows={4}
            />
          </Grid>
        </Grid>
      )}
    </Paper>
  );
}

export default JobInfo;
