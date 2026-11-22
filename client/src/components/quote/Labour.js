import React, { useContext, useEffect } from 'react';
import {
  Grid,
  TextField,
  Typography,
  Paper,
  InputAdornment
} from '@mui/material';
import SettingsContext from '../../context/SettingsContext';
import TimeInput from '../common/TimeInput';

function Labour({
  labour,
  setLabour,
  currencySymbol
}) {
  const { settings } = useContext(SettingsContext);

  // Update total labour cost when any time or rate changes
  useEffect(() => {
    const designMinutes = parseInt(labour.design_minutes) || 0;
    const preparationMinutes = parseInt(labour.preparation_minutes) || 0;
    const postProcessingMinutes = parseInt(labour.post_processing_minutes) || 0;
    const otherMinutes = parseInt(labour.other_minutes) || 0;

    const totalMinutes = designMinutes + preparationMinutes + postProcessingMinutes + otherMinutes;
    const labourRatePerHour = parseFloat(labour.labour_rate_per_hour) || 0;
    const totalCost = (totalMinutes / 60) * labourRatePerHour;

    setLabour({
      ...labour,
      total_cost: totalCost
    });
  }, [
    labour.design_minutes,
    labour.preparation_minutes,
    labour.post_processing_minutes,
    labour.other_minutes,
    labour.labour_rate_per_hour
  ]);

  // Initialize labour rate from settings
  useEffect(() => {
    if (settings.labour_rate_per_hour && !labour.labour_rate_per_hour) {
      setLabour({
        ...labour,
        labour_rate_per_hour: parseFloat(settings.labour_rate_per_hour)
      });
    }
  }, [settings.labour_rate_per_hour]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLabour({
      ...labour,
      [name]: value
    });
  };

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 2 }}>
      <Typography variant="h6">Mano de obra</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        Tiempo de diseño, preparación y acabados.
      </Typography>

      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        <Grid item xs={6} sm={6} md={3}>
          <TimeInput
            name="design_minutes"
            label="Diseño"
            value={labour.design_minutes}
            onChange={handleInputChange}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <TimeInput
            name="preparation_minutes"
            label="Preparación"
            value={labour.preparation_minutes}
            onChange={handleInputChange}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <TimeInput
            name="post_processing_minutes"
            label="Postprocesado"
            value={labour.post_processing_minutes}
            onChange={handleInputChange}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <TimeInput
            name="other_minutes"
            label="Otros"
            value={labour.other_minutes}
            onChange={handleInputChange}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            name="labour_rate_per_hour"
            label="Tarifa por hora"
            type="number"
            size="small"
            value={labour.labour_rate_per_hour}
            onChange={handleInputChange}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
              endAdornment: <InputAdornment position="end">/ h</InputAdornment>
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Costo de mano de obra"
            size="small"
            value={Number(labour.total_cost || 0).toFixed(2)}
            InputProps={{
              readOnly: true,
              startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>
            }}
            fullWidth
          />
        </Grid>
      </Grid>
    </Paper>
  );
}

export default Labour;
