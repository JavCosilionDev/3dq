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
  Delete as DeleteIcon,
  Link as LinkIcon
} from '@mui/icons-material';

function HardwareUsage({
  hardwareItems,
  quoteHardware,
  setQuoteHardware,
  currencySymbol
}) {
  const addHardwareItem = () => {
    if (hardwareItems.length === 0) return;

    const newItem = {
      id: Date.now(),
      hardware_id: hardwareItems[0].id,
      hardware_name: hardwareItems[0].name,
      quantity: 1,
      unit_price: hardwareItems[0].unit_price,
      total_cost: hardwareItems[0].unit_price
    };

    setQuoteHardware([...quoteHardware, newItem]);
  };

  const removeHardwareItem = (id) => {
    setQuoteHardware(quoteHardware.filter(item => item.id !== id));
  };

  const handleHardwareChange = (id, hardwareId) => {
    const selectedHardware = hardwareItems.find(h => h.id === parseInt(hardwareId));
    if (!selectedHardware) return;

    setQuoteHardware(quoteHardware.map(item => {
      if (item.id === id) {
        return {
          ...item,
          hardware_id: selectedHardware.id,
          hardware_name: selectedHardware.name,
          unit_price: selectedHardware.unit_price,
          total_cost: item.quantity * selectedHardware.unit_price
        };
      }
      return item;
    }));
  };

  const handleQuantityChange = (id, quantity) => {
    const quantityValue = parseInt(quantity) || 0;

    setQuoteHardware(quoteHardware.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantity: quantityValue,
          total_cost: quantityValue * item.unit_price
        };
      }
      return item;
    }));
  };

  const handlePriceChange = (id, price) => {
    const priceValue = parseFloat(price) || 0;

    setQuoteHardware(quoteHardware.map(item => {
      if (item.id === id) {
        return {
          ...item,
          unit_price: priceValue,
          total_cost: item.quantity * priceValue
        };
      }
      return item;
    }));
  };

  const openHardwareLink = (hardwareId) => {
    const hardware = hardwareItems.find(h => h.id === hardwareId);
    if (hardware && hardware.link) {
      window.open(hardware.link, '_blank', 'noopener,noreferrer');
    }
  };

  const totalHardwareCost = quoteHardware.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const noHardwareAvailable = hardwareItems.length === 0;

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="h6">Hardware</Typography>
          <Typography variant="caption" color="text.secondary">
            Piezas adicionales, cantidad y costo unitario.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addHardwareItem}
          disabled={noHardwareAvailable}
        >
          Agregar hardware
        </Button>
      </Box>

      {noHardwareAvailable && (
        <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
          No hay hardware disponible. Agrega piezas en la sección de Hardware.
        </Typography>
      )}

      {!noHardwareAvailable && quoteHardware.length === 0 && (
        <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
          Esta cotización no tiene hardware agregado.
        </Typography>
      )}

      {quoteHardware.map((item) => (
        <Box
          key={item.id}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 1.5,
            mb: 1.5
          }}
        >
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel id={`hardware-label-${item.id}`}>Hardware</InputLabel>
                <Select
                  labelId={`hardware-label-${item.id}`}
                  value={item.hardware_id}
                  onChange={(e) => handleHardwareChange(item.id, e.target.value)}
                  label="Hardware"
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => openHardwareLink(item.hardware_id)}
                        edge="end"
                        disabled={!hardwareItems.find(h => h.id === item.hardware_id)?.link}
                        aria-label="Abrir enlace del hardware"
                      >
                        <LinkIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  }
                >
                  {hardwareItems.map((h) => (
                    <MenuItem key={h.id} value={h.id}>
                      {h.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={4} sm={2} md={1}>
              <TextField
                label="Cantidad"
                type="number"
                size="small"
                value={item.quantity}
                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                fullWidth
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>

            <Grid item xs={8} sm={2} md={2}>
              <TextField
                label="Precio unitario"
                type="number"
                size="small"
                value={item.unit_price}
                onChange={(e) => handlePriceChange(item.id, e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={8} sm={1} md={2} sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" fontWeight="medium" sx={{ flexGrow: 1 }}>
                {currencySymbol}{Number(item.total_cost || 0).toFixed(2)}
              </Typography>
            </Grid>

            <Grid item xs={4} sm={1} md={1} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <IconButton
                color="error"
                onClick={() => removeHardwareItem(item.id)}
                aria-label="Quitar hardware"
              >
                <DeleteIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Box>
      ))}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {quoteHardware.length} {quoteHardware.length === 1 ? 'pieza' : 'piezas'}
        </Typography>
        <Typography variant="subtitle1" fontWeight="medium">
          Total hardware: {currencySymbol}{totalHardwareCost.toFixed(2)}
        </Typography>
      </Box>
    </Paper>
  );
}

export default HardwareUsage;
