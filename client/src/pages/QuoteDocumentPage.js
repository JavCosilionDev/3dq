import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Save as SaveIcon
} from '@mui/icons-material';

function numberValue(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function QuoteDocumentPage() {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [notasText, setNotasText] = useState('');
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        const response = await fetch(`/api/quotes/${id}/document`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo cargar el documento');
        }

        setDocument(data.document);
        setTotals(data.totals);
        setNotasText((data.document.notas || []).join('\n'));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [id]);

  const updateField = (field, value) => {
    setDocument((current) => ({ ...current, [field]: value }));
  };

  const updateEnvio = (field, value) => {
    setDocument((current) => ({
      ...current,
      envio: { ...current.envio, [field]: value }
    }));
  };

  const updateItem = (index, field, value) => {
    setDocument((current) => {
      const items = [...current.items];
      items[index] = { ...items[index], [field]: value };
      return { ...current, items };
    });
  };

  const updateDetail = (index, value) => {
    setDocument((current) => {
      const items = [...current.items];
      items[index] = { ...items[index], detalle: value.split('\n').filter(Boolean) };
      return { ...current, items };
    });
  };

  const addItem = (tipo) => {
    setDocument((current) => ({
      ...current,
      items: [
        ...current.items,
        tipo === 'filamento'
          ? { tipo, material: 'PLA', gramos: 0, visible: true }
          : tipo === 'producto'
            ? { tipo, texto: '', precio: 0, cantidad: 1, detalle: [], visible: true }
            : { tipo, texto: '', visible: true }
      ]
    }));
  };

  const removeItem = (index) => {
    setDocument((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const payload = () => ({
    ...document,
    notas: notasText.split('\n').map((note) => note.trim()).filter(Boolean),
    items: document.items.map((item) => {
      if (item.tipo === 'filamento') {
        return { ...item, gramos: numberValue(item.gramos) };
      }
      if (item.tipo === 'producto') {
        return {
          ...item,
          precio: numberValue(item.precio),
          cantidad: Math.max(1, Math.round(numberValue(item.cantidad)))
        };
      }
      return item;
    })
  });

  const save = async () => {
    const response = await fetch(`/api/quotes/${id}/document`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: payload() })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo guardar el documento');
    }

    setDocument(data.document);
    setTotals(data.totals);
    setNotasText((data.document.notas || []).join('\n'));
    return data;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await save();
      setSuccess('Documento guardado');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      await save();
      const response = await fetch(`/api/quotes/${id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: payload() })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar el PDF');
      }

      setSuccess(`PDF generado: ${data.filename}`);
      window.open(data.url, '_blank');
    } catch (generateError) {
      setError(generateError.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!document) {
    return <Alert severity="error">{error || 'Documento no encontrado'}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton component={Link} to={`/quote/${id}`}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4">Documento PDF</Typography>
            <Typography variant="body2" color="text.secondary">
              {document.folio_origen} → {document.folio_salida}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || generating}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={handleGenerate} disabled={saving || generating}>
            {generating ? 'Generando...' : 'Guardar y generar PDF'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Datos del documento</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Fecha de emisión"
              type="date"
              fullWidth
              value={document.fecha_emision}
              onChange={(event) => updateField('fecha_emision', event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Cliente"
              fullWidth
              value={document.cliente}
              onChange={(event) => updateField('cliente', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Cantidad"
              type="number"
              fullWidth
              value={document.cantidad}
              onChange={(event) => updateField('cantidad', numberValue(event.target.value))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={<Switch checked={document.regalo} onChange={(event) => updateField('regalo', event.target.checked)} />}
              label="Regalo"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Modelo"
              fullWidth
              value={document.modelo_base}
              onChange={(event) => updateField('modelo_base', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Subtotal de lista"
              type="number"
              fullWidth
              value={document.subtotal_lista}
              onChange={(event) => updateField('subtotal_lista', numberValue(event.target.value))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Total objetivo"
              type="number"
              fullWidth
              value={document.total_objetivo ?? ''}
              onChange={(event) => updateField('total_objetivo', event.target.value === '' ? null : numberValue(event.target.value))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="IVA %"
              type="number"
              fullWidth
              value={document.iva_pct}
              onChange={(event) => updateField('iva_pct', numberValue(event.target.value))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Descuento %"
              type="number"
              fullWidth
              value={document.descuento_pct}
              onChange={(event) => updateField('descuento_pct', numberValue(event.target.value))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Modo de descuento</InputLabel>
              <Select
                label="Modo de descuento"
                value={document.modo_descuento}
                onChange={(event) => updateField('modo_descuento', event.target.value)}
              >
                <MenuItem value="referencial">Referencial</MenuItem>
                <MenuItem value="real">Real</MenuItem>
                <MenuItem value="sin_descuento">Sin descuento</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Descuento en pesos"
              type="number"
              fullWidth
              value={document.descuento_monto ?? ''}
              onChange={(event) => updateField('descuento_monto', event.target.value === '' ? null : numberValue(event.target.value))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={<Switch checked={document.precios_incluyen_iva} onChange={(event) => updateField('precios_incluyen_iva', event.target.checked)} />}
              label="Precios incluyen IVA"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={<Switch checked={document.mostrar_precios_por_item} onChange={(event) => updateField('mostrar_precios_por_item', event.target.checked)} />}
              label="Mostrar precio por ítem"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Duración en minutos"
              type="number"
              fullWidth
              value={document.duracion_minutos}
              onChange={(event) => updateField('duracion_minutos', numberValue(event.target.value))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Envío"
              type="number"
              fullWidth
              value={document.envio.monto}
              onChange={(event) => updateEnvio('monto', numberValue(event.target.value))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={<Switch checked={document.envio.lleva_iva} onChange={(event) => updateEnvio('lleva_iva', event.target.checked)} />}
              label="Envío lleva IVA"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={6}>
            <TextField
              label="Nota de entrega"
              fullWidth
              value={document.envio.nota_entrega || ''}
              onChange={(event) => updateEnvio('nota_entrega', event.target.value || null)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notas del documento"
              fullWidth
              multiline
              minRows={2}
              value={notasText}
              onChange={(event) => setNotasText(event.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Líneas del documento</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('descripcion')}>Descripción</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('filamento')}>Filamento</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('hardware')}>Hardware</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('mano_obra')}>Mano de obra</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('producto')}>Producto</Button>
          </Box>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tipo</TableCell>
              <TableCell>Texto / material</TableCell>
              <TableCell>Gramos / precio</TableCell>
              <TableCell>Detalle</TableCell>
              <TableCell>Visible</TableCell>
              <TableCell align="right">Quitar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {document.items.map((item, index) => (
              <TableRow key={`${item.tipo}-${index}`}>
                <TableCell sx={{ minWidth: 110 }}>{item.tipo}</TableCell>
                <TableCell>
                  {item.tipo === 'filamento' ? (
                    <TextField
                      size="small"
                      value={item.material}
                      onChange={(event) => updateItem(index, 'material', event.target.value)}
                    />
                  ) : (
                    <TextField
                      size="small"
                      fullWidth
                      value={item.texto || ''}
                      onChange={(event) => updateItem(index, 'texto', event.target.value)}
                    />
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 130 }}>
                  {item.tipo === 'filamento' && (
                    <TextField
                      size="small"
                      type="number"
                      value={item.gramos}
                      onChange={(event) => updateItem(index, 'gramos', event.target.value)}
                    />
                  )}
                  {item.tipo === 'producto' && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small"
                        type="number"
                        label="Precio"
                        value={item.precio}
                        onChange={(event) => updateItem(index, 'precio', event.target.value)}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Cant."
                        value={item.cantidad ?? 1}
                        onChange={(event) => updateItem(index, 'cantidad', event.target.value)}
                        sx={{ width: 80 }}
                      />
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  {item.tipo === 'producto' && (
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      value={(item.detalle || []).join('\n')}
                      onChange={(event) => updateDetail(index, event.target.value)}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={item.visible !== false}
                    onChange={(event) => updateItem(index, 'visible', event.target.checked)}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton color="error" onClick={() => removeItem(index)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {totals && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Totales calculados</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}><Typography variant="body2">Subtotal</Typography><Typography>${totals.subtotal / 100}</Typography></Grid>
            <Grid item xs={6} sm={3}><Typography variant="body2">Descuento</Typography><Typography>${totals.discount / 100}</Typography></Grid>
            <Grid item xs={6} sm={3}><Typography variant="body2">IVA</Typography><Typography>${totals.tax / 100}</Typography></Grid>
            <Grid item xs={6} sm={3}><Typography variant="body2">Total</Typography><Typography fontWeight="bold">${totals.total / 100}</Typography></Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
}

export default QuoteDocumentPage;
