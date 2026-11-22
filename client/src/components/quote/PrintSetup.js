import React, { useContext, useEffect } from 'react';
import {
  Grid,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Box
} from '@mui/material';
import SettingsContext from '../../context/SettingsContext';
import TimeInput from '../common/TimeInput';

function PrintSetup({
  printers,
  printSetup,
  setPrintSetup,
  currencySymbol
}) {
  const { settings } = useContext(SettingsContext);

  // Update costs when print time or printer changes
  useEffect(() => {
    if (!printSetup.printer_id || !printSetup.print_time) return;

    const selectedPrinter = printers.find(p => p.id === parseInt(printSetup.printer_id));
    if (!selectedPrinter) return;

    const printTimeMinutes = parseInt(printSetup.print_time) || 0;
    const printTimeHours = printTimeMinutes / 60;
    const powerUsageInKwh = (selectedPrinter.power_usage / 1000) * printTimeHours;
    const electricityCost = powerUsageInKwh * parseFloat(settings.electricity_cost_per_kwh);
    const depreciationCost = printTimeHours * selectedPrinter.depreciation_per_hour;

    setPrintSetup({
      ...printSetup,
      power_cost: electricityCost,
      depreciation_cost: depreciationCost
    });
  }, [printSetup.printer_id, printSetup.print_time, printers, settings.electricity_cost_per_kwh]);

  const handlePrinterChange = (e) => {
    const printerId = e.target.value;
    const selectedPrinter = printers.find(p => p.id === parseInt(printerId));

    if (!selectedPrinter) return;

    setPrintSetup({
      ...printSetup,
      printer_id: printerId,
      printer_name: selectedPrinter.name
    });
  };

  const handlePrintTimeChange = (e) => {
    const { name, value } = e.target;
    setPrintSetup({
      ...printSetup,
      [name]: value
    });
  };

  const noPrintersAvailable = printers.length === 0;
  const totalPrintCost = Number(printSetup.power_cost || 0) + Number(printSetup.depreciation_cost || 0);

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 2 }}>
      <Typography variant="h6">Impresión</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        Tiempo, energía y depreciación de la impresora.
      </Typography>

      {noPrintersAvailable && (
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
          No hay impresoras disponibles. Agrega una en la sección de Impresoras.
        </Typography>
      )}

      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small" disabled={noPrintersAvailable}>
            <InputLabel id="printer-label">Impresora</InputLabel>
            <Select
              labelId="printer-label"
              value={printSetup.printer_id}
              onChange={handlePrinterChange}
              label="Impresora"
            >
              {printers.map((printer) => (
                <MenuItem key={printer.id} value={printer.id}>
                  {printer.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TimeInput
            name="print_time"
            label="Tiempo de impresión"
            value={printSetup.print_time}
            onChange={handlePrintTimeChange}
            fullWidth
            size="small"
            disabled={noPrintersAvailable}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <TextField
            label="Costo de energía"
            size="small"
            value={Number(printSetup.power_cost || 0).toFixed(2)}
            InputProps={{
              readOnly: true,
              startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>
            }}
            fullWidth
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <TextField
            label="Depreciación"
            size="small"
            value={Number(printSetup.depreciation_cost || 0).toFixed(2)}
            InputProps={{
              readOnly: true,
              startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>
            }}
            fullWidth
          />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Typography variant="subtitle1" fontWeight="medium">
          Costo de impresión: {currencySymbol}{totalPrintCost.toFixed(2)}
        </Typography>
      </Box>
    </Paper>
  );
}

export default PrintSetup;
