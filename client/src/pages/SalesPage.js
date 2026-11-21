import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert
} from '@mui/material';
import SettingsContext from '../context/SettingsContext';

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function SalesPage() {
  const { settings } = useContext(SettingsContext);
  const [data, setData] = useState({ sales: [], total: 0 });
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Ventas</Typography>
        <Paper sx={{ px: 3, py: 2 }}>
          <Typography variant="body2" color="text.secondary">Total vendido</Typography>
          <Typography variant="h5" fontWeight="bold">
            {settings.currency_symbol}{Number(data.total).toFixed(2)}
          </Typography>
        </Paper>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Folio</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Modelo</TableCell>
              <TableCell>Forma de pago</TableCell>
              <TableCell align="right">Importe</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">No hay ventas registradas</TableCell>
              </TableRow>
            ) : data.sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>{formatDate(sale.sale_date)}</TableCell>
                <TableCell>
                  <Link to={`/quote/${sale.quote_id}`}>{sale.quote_number}</Link>
                </TableCell>
                <TableCell>{sale.customer_name}</TableCell>
                <TableCell>{sale.title}</TableCell>
                <TableCell>{sale.payment_method || '-'}</TableCell>
                <TableCell align="right">
                  {settings.currency_symbol}{Number(sale.amount).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default SalesPage;
