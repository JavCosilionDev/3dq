import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

function MergeQuotesPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({
    title: '',
    customer_name: '',
    fecha_emision: new Date().toISOString().slice(0, 10),
    total_objetivo: '',
    envio: '',
    nota_entrega: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadQuotes = async () => {
      try {
        const response = await fetch('/api/quotes');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudieron cargar las cotizaciones');
        setQuotes(data);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    loadQuotes();
  }, []);

  const toggleQuote = (id) => {
    setSelected((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleMerge = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/quotes/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_ids: selected,
          title: form.title || undefined,
          customer_name: form.customer_name || undefined,
          fecha_emision: form.fecha_emision,
          total_objetivo: form.total_objetivo === '' ? undefined : Number(form.total_objetivo),
          envio: form.envio === '' ? 0 : Number(form.envio),
          nota_entrega: form.nota_entrega || undefined
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron unir las cotizaciones');
      }

      navigate(`/quote/${data.quote_id}/document`);
    } catch (mergeError) {
      setError(mergeError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Button component={Link} to="/quotes" startIcon={<ArrowBackIcon />}>Volver</Button>
        <Typography variant="h4">Unir cotizaciones</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Selecciona dos o más cotizaciones</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Folio</TableCell>
                <TableCell>Modelo</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id} hover onClick={() => toggleQuote(quote.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selected.includes(quote.id)} />
                  </TableCell>
                  <TableCell>{quote.quote_number}</TableCell>
                  <TableCell>{quote.title}</TableCell>
                  <TableCell>{quote.customer_name}</TableCell>
                  <TableCell align="right">${Number(quote.total_cost).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Datos del documento combinado</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Título"
              fullWidth
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              helperText="Si se deja vacío, se unen los modelos seleccionados"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Cliente"
              fullWidth
              value={form.customer_name}
              onChange={(event) => updateField('customer_name', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Fecha de emisión"
              type="date"
              fullWidth
              value={form.fecha_emision}
              onChange={(event) => updateField('fecha_emision', event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Total objetivo"
              type="number"
              fullWidth
              value={form.total_objetivo}
              onChange={(event) => updateField('total_objetivo', event.target.value)}
              helperText="Vacío = suma de las cotizaciones"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Envío"
              type="number"
              fullWidth
              value={form.envio}
              onChange={(event) => updateField('envio', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Nota de entrega"
              fullWidth
              value={form.nota_entrega}
              onChange={(event) => updateField('nota_entrega', event.target.value)}
            />
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" onClick={handleMerge} disabled={saving || selected.length < 2}>
            {saving ? 'Uniendo...' : `Unir ${selected.length} cotizaciones`}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default MergeQuotesPage;
