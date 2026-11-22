import React, { useContext, useEffect } from 'react';
import {
  Grid,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  Box,
  Button
} from '@mui/material';
import SettingsContext from '../../context/SettingsContext';

function SummaryRow({ label, value, strong = false, color }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.6 }}>
      <Typography variant="body2" color={color || 'text.secondary'}>{label}</Typography>
      <Typography variant="body2" fontWeight={strong ? 700 : 500} color={color}>
        {value}
      </Typography>
    </Box>
  );
}

function SummaryCard({ title, children }) {
  return (
    <Box
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2
      }}
    >
      <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function CostSummary({
  quoteFilaments,
  quoteHardware,
  printSetup,
  labour,
  markup,
  totalCost,
  setTotalCost,
  currencySymbol,
  discount = 0,
  quantity = 1,
  manualTotal = false,
  setManualTotal,
  onUseCalculated
}) {
  const { settings } = useContext(SettingsContext);
  const tax_rate = parseFloat(settings.tax_rate) || 0;

  const filamentTotal = quoteFilaments.reduce((sum, f) => sum + Number(f.total_cost || 0), 0);
  const hardwareTotal = quoteHardware.reduce((sum, h) => sum + Number(h.total_cost || 0), 0);
  const powerCost = Number(printSetup.power_cost || 0);
  const depreciationCost = Number(printSetup.depreciation_cost || 0);
  const labourCost = Number(labour.total_cost || 0);

  const materialCostsTotal = filamentTotal + hardwareTotal + powerCost + depreciationCost;
  const serviceCostsTotal = labourCost;
  const perUnitSubtotal = materialCostsTotal + serviceCostsTotal;
  const subtotal = perUnitSubtotal * quantity;

  const markupAmount = subtotal * (markup / 100);
  const afterMarkup = subtotal + markupAmount;
  const discountAmount = afterMarkup * (discount / 100);
  const afterDiscount = afterMarkup - discountAmount;
  const taxAmount = tax_rate > 0 ? afterDiscount * (tax_rate / 100) : 0;
  const calculatedTotal = afterDiscount + taxAmount;

  // Update total cost when any component changes, except when a manual total is preserved.
  useEffect(() => {
    if (!manualTotal) {
      setTotalCost(calculatedTotal);
    }
  }, [calculatedTotal, manualTotal, setTotalCost]);

  const money = (value) => `${currencySymbol}${Number(value || 0).toFixed(2)}`;

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 2 }}>
      <Typography variant="h6">Resumen de costos</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        Costos, margen, descuento e IVA de la cotización.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <SummaryCard title="Materiales">
            <SummaryRow label="Filamento" value={money(filamentTotal)} />
            <SummaryRow label="Hardware" value={money(hardwareTotal)} />
            <SummaryRow label="Energía" value={money(powerCost)} />
            <SummaryRow label="Depreciación" value={money(depreciationCost)} />
            <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 0.5 }}>
              <SummaryRow label="Subtotal materiales" value={money(materialCostsTotal)} strong />
            </Box>
          </SummaryCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <SummaryCard title="Mano de obra">
            <SummaryRow label="Diseño" value={`${labour.design_minutes || 0} min`} />
            <SummaryRow label="Preparación" value={`${labour.preparation_minutes || 0} min`} />
            <SummaryRow label="Postprocesado" value={`${labour.post_processing_minutes || 0} min`} />
            <SummaryRow label="Otros" value={`${labour.other_minutes || 0} min`} />
            <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5, pt: 0.5 }}>
              <SummaryRow label="Subtotal mano de obra" value={money(serviceCostsTotal)} strong />
            </Box>
          </SummaryCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <SummaryCard title="Desglose de precio">
            {quantity > 1 && (
              <>
                <SummaryRow label="Subtotal por pieza" value={money(perUnitSubtotal)} />
                <SummaryRow label="Cantidad" value={`× ${quantity}`} />
              </>
            )}
            <SummaryRow
              label={quantity > 1 ? 'Subtotal total' : 'Subtotal'}
              value={money(subtotal)}
              strong
            />
            <SummaryRow label={`Margen (${markup}%)`} value={`+${money(markupAmount)}`} />
            <Box sx={{ borderTop: 1, borderColor: 'divider', my: 0.5 }} />
            <SummaryRow label="Después del margen" value={money(afterMarkup)} strong />
            {discount > 0 && (
              <>
                <SummaryRow label={`Descuento (${discount}%)`} value={`-${money(discountAmount)}`} color="error.main" />
                <SummaryRow label="Después del descuento" value={money(afterDiscount)} strong />
              </>
            )}
            {tax_rate > 0 && (
              <SummaryRow label={`IVA (${tax_rate}%)`} value={`+${money(taxAmount)}`} />
            )}
          </SummaryCard>
        </Grid>
      </Grid>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          mt: 2,
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.default'
        }}
      >
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Total final</Typography>
          <Typography variant="caption" color="text.secondary">
            {manualTotal
              ? 'Total manual: se conserva el precio negociado o combinado.'
              : 'Calculado con costos, margen, descuento e IVA.'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {manualTotal ? (
            <TextField
              label="Total"
              type="number"
              size="small"
              value={totalCost}
              onChange={(event) => setTotalCost(parseFloat(event.target.value) || 0)}
              InputProps={{ startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment> }}
              sx={{ width: 160 }}
            />
          ) : (
            <Typography variant="h5" fontWeight="bold" color="primary">
              {money(totalCost)}
            </Typography>
          )}
          <Button
            size="small"
            variant={manualTotal ? 'outlined' : 'text'}
            onClick={() => {
              if (manualTotal) {
                if (onUseCalculated) onUseCalculated();
                setTotalCost(calculatedTotal);
              } else if (setManualTotal) {
                setManualTotal(true);
              }
            }}
          >
            {manualTotal ? 'Usar cálculo' : 'Fijar total'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

export default CostSummary;
