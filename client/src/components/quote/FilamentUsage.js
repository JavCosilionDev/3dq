import React from 'react';
import {
  Grid,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Box,
  Button
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

const DEFAULT_COLOR = '#95BCFC';

function FilamentUsage({
  filaments,
  quoteFilaments,
  setQuoteFilaments,
  currencySymbol,
  isEditMode = false
}) {
  const addFilament = () => {
    if (filaments.length === 0) return;

    const firstFilament = filaments[0];
    const newFilament = {
      id: Date.now(),
      filament_id: firstFilament.id,
      filament_name: firstFilament.name,
      material: firstFilament.type || firstFilament.name,
      filament_price_per_gram: firstFilament.price_per_kg / 1000,
      color_name: '',
      color_hex: DEFAULT_COLOR,
      grams_used: 0,
      purge_grams: 0,
      total_cost: 0
    };

    setQuoteFilaments([...quoteFilaments, newFilament]);
  };

  const removeFilament = (id) => {
    setQuoteFilaments(quoteFilaments.filter((filament) => filament.id !== id));
  };

  const handleFilamentChange = (id, filamentId) => {
    const selectedFilament = filaments.find((filament) => filament.id === parseInt(filamentId));
    if (!selectedFilament) return;

    setQuoteFilaments(quoteFilaments.map((filament) => {
      if (filament.id !== id) return filament;
      const pricePerGram = selectedFilament.price_per_kg / 1000;
      return {
        ...filament,
        filament_id: selectedFilament.id,
        filament_name: selectedFilament.name,
        material: selectedFilament.type || selectedFilament.name,
        filament_price_per_gram: pricePerGram,
        total_cost: filament.grams_used * pricePerGram
      };
    }));
  };

  const updateFilament = (id, field, value) => {
    setQuoteFilaments(quoteFilaments.map((filament) => {
      if (filament.id !== id) return filament;

      const next = { ...filament, [field]: value };
      if (field === 'grams_used' || field === 'filament_price_per_gram') {
        next.total_cost = (parseFloat(next.grams_used) || 0) * (parseFloat(next.filament_price_per_gram) || 0);
      }
      return next;
    }));
  };

  const totalFilamentCost = quoteFilaments.reduce((sum, filament) => sum + Number(filament.total_cost || 0), 0);

  // New quotes start with one filament, but editing never adds rows by itself.
  React.useEffect(() => {
    if (isEditMode || quoteFilaments.length > 0 || filaments.length === 0) {
      return;
    }

    const firstFilament = filaments[0];
    setQuoteFilaments([{
      id: Date.now(),
      filament_id: firstFilament.id,
      filament_name: firstFilament.name,
      material: firstFilament.type || firstFilament.name,
      filament_price_per_gram: firstFilament.price_per_kg / 1000,
      color_name: '',
      color_hex: DEFAULT_COLOR,
      grams_used: 0,
      purge_grams: 0,
      total_cost: 0
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, quoteFilaments.length, filaments.length]);

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="h6">Filamento, color y purga</Typography>
          <Typography variant="caption" color="text.secondary">
            Cada color usado se muestra en el ticket del cliente. La purga se registra por separado.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addFilament}
          disabled={filaments.length === 0}
        >
          Agregar filamento
        </Button>
      </Box>

      {quoteFilaments.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          Esta cotización no tiene filamentos registrados.
        </Typography>
      )}

      {quoteFilaments.map((filament) => (
        <Box
          key={filament.id}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 1.5,
            mb: 1.5
          }}
        >
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id={`filament-label-${filament.id}`}>Filamento</InputLabel>
                <Select
                  labelId={`filament-label-${filament.id}`}
                  value={filament.filament_id}
                  onChange={(event) => handleFilamentChange(filament.id, event.target.value)}
                  label="Filamento"
                >
                  {filaments.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <TextField
                label="Color"
                size="small"
                fullWidth
                value={filament.color_name || ''}
                onChange={(event) => updateFilament(filament.id, 'color_name', event.target.value)}
                placeholder="Negro"
              />
            </Grid>

            <Grid item xs={6} sm={3} md={1}>
              <TextField
                label="Tono"
                type="color"
                size="small"
                fullWidth
                value={filament.color_hex || DEFAULT_COLOR}
                onChange={(event) => updateFilament(filament.id, 'color_hex', event.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ 'aria-label': 'Color del filamento' }}
              />
            </Grid>

            <Grid item xs={6} sm={3} md={1.5}>
              <TextField
                label="Usado"
                type="number"
                size="small"
                fullWidth
                value={filament.grams_used}
                onChange={(event) => updateFilament(filament.id, 'grams_used', event.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">g</InputAdornment> }}
              />
            </Grid>

            <Grid item xs={6} sm={3} md={1.5}>
              <TextField
                label="Purga"
                type="number"
                size="small"
                fullWidth
                value={filament.purge_grams || 0}
                onChange={(event) => updateFilament(filament.id, 'purge_grams', event.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">g</InputAdornment> }}
              />
            </Grid>

            <Grid item xs={8} sm={6} md={2}>
              <TextField
                label="Costo"
                size="small"
                fullWidth
                value={`${currencySymbol}${Number(filament.total_cost || 0).toFixed(2)}`}
                InputProps={{ readOnly: true }}
              />
            </Grid>

            <Grid item xs={4} sm={6} md={1} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <IconButton
                color="error"
                onClick={() => removeFilament(filament.id)}
                aria-label="Quitar filamento"
              >
                <DeleteIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Box>
      ))}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {quoteFilaments.length} {quoteFilaments.length === 1 ? 'filamento' : 'filamentos'}
        </Typography>
        <Typography variant="subtitle1" fontWeight="medium">
          Total filamento: {currencySymbol}{totalFilamentCost.toFixed(2)}
        </Typography>
      </Box>
    </Paper>
  );
}

export default FilamentUsage;
