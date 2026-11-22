import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { Analytics as AnalyticsIcon } from '@mui/icons-material';
import SettingsContext from '../context/SettingsContext';

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function money(value, symbol) {
  return `${symbol}${(Number(value) || 0).toFixed(2)}`;
}

function SalesPage() {
  const { settings } = useContext(SettingsContext);
  const currency = settings.currency_symbol || '$';
  const [data, setData] = useState({ sales: [], total: 0, iva: 0, subtotal: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSales = async () => {
      try {
        const response = await fetch('/api/sales');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'No se pudieron cargar las ventas');
        }

        setData(result);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    loadSales();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">Ventas</Typography>
          <Typography variant="body2" color="text.secondary">
            Una cotización puede tener varias ventas. El IVA se guarda por separado para contabilidad.
          </Typography>
        </Box>
        <Button variant="outlined" component={Link} to="/analytics" startIcon={<AnalyticsIcon />}>
          Ver análisis
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">Total vendido</Typography>
            <Typography variant="h5" fontWeight="bold">{money(data.total, currency)}</Typography>
            <Typography variant="caption" color="text.secondary">{data.count} ventas</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
            <Typography variant="h5" fontWeight="bold">{money(data.subtotal, currency)}</Typography>
            <Typography variant="caption" color="text.secondary">Sin IVA</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">IVA</Typography>
            <Typography variant="h5" fontWeight="bold">{money(data.iva, currency)}</Typography>
            <Typography variant="caption" color="text.secondary">Para contabilidad</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">Ticket promedio</Typography>
            <Typography variant="h5" fontWeight="bold">
              {money(data.count > 0 ? data.total / data.count : 0, currency)}
            </Typography>
            <Typography variant="caption" color="text.secondary">Por venta</Typography>
          </Paper>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Folio</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Modelo</TableCell>
              <TableCell>Pago</TableCell>
              <TableCell>Referencia bancaria</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">IVA</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">No hay ventas registradas</TableCell>
              </TableRow>
            ) : data.sales.map((sale) => (
              <TableRow key={sale.id} hover>
                <TableCell>{formatDate(sale.sale_date)}</TableCell>
                <TableCell>
                  <Link to={`/quote/${sale.quote_id}`}>{sale.quote_number}</Link>
                </TableCell>
                <TableCell>{sale.customer_name}</TableCell>
                <TableCell>{sale.title}</TableCell>
                <TableCell>
                  <Chip size="small" label={sale.payment_method || 'Sin especificar'} />
                </TableCell>
                <TableCell>{sale.bank_reference || '-'}</TableCell>
                <TableCell align="right">{money(sale.subtotal, currency)}</TableCell>
                <TableCell align="right">{money(sale.iva_amount, currency)}</TableCell>
                <TableCell align="right"><strong>{money(sale.amount, currency)}</strong></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default SalesPage;
