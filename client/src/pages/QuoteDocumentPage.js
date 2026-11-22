import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
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
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  AddPhotoAlternate as AddPhotoAlternateIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Save as SaveIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';

function numberValue(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function imageSrc(quoteId, image) {
  if (!image || !image.id) return '';
  return `/api/quotes/${quoteId}/images/${image.id}/file?v=${(image.sha256 || '').slice(0, 10)}`;
}

function QuoteDocumentPage() {
  const { id } = useParams();
  const fileInputRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [images, setImages] = useState([]);
  const [notasText, setNotasText] = useState('');
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingPng, setGeneratingPng] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadDocument = async () => {
    const response = await fetch(`/api/quotes/${id}/document`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo cargar el documento');
    }

    setDocument(data.document);
    setImages(data.document.imagenes || []);
    setTotals(data.totals);
    setNotasText((data.document.notas || []).join('\n'));
  };

  useEffect(() => {
    loadDocument()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          ? {
              tipo,
              material: 'PLA',
              gramos: 0,
              color: '',
              color_hex: '#95BCFC',
              purge_grams: 0,
              visible: true
            }
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
        return {
          ...item,
          gramos: numberValue(item.gramos),
          purge_grams: numberValue(item.purge_grams),
          color: item.color || null,
          color_hex: item.color_hex || null
        };
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
    setImages(data.document.imagenes || []);
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

  const handleGeneratePng = async () => {
    setGeneratingPng(true);
    setError(null);
    setSuccess(null);

    try {
      await save();
      const response = await fetch(`/api/quotes/${id}/png`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: payload() })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar la imagen');
      }

      setSuccess(`Imagen generada: ${data.filename}`);
      window.open(`${data.url}?download=1`, '_blank');
    } catch (generateError) {
      setError(generateError.message);
    } finally {
      setGeneratingPng(false);
    }
  };

  const refreshImages = async () => {
    const response = await fetch(`/api/quotes/${id}/images`);
    const data = await response.json();
    if (response.ok) {
      setImages(data.images || []);
    }
  };

  const handleUpload = (file) => {
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      setError('La imagen supera 12 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setUploading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(`/api/quotes/${id}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type || 'image/png',
            data: reader.result
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo subir la imagen');
        }
        await refreshImages();
        setSuccess('Imagen agregada');
      } catch (uploadError) {
        setError(uploadError.message);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  const markPrimary = async (imageId) => {
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${id}/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_primary: true })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo marcar la imagen');
      await refreshImages();
    } catch (imageError) {
      setError(imageError.message);
    }
  };

  const removeImage = async (imageId) => {
    if (!window.confirm('¿Eliminar esta imagen?')) return;

    setError(null);
    try {
      const response = await fetch(`/api/quotes/${id}/images/${imageId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar la imagen');
      await refreshImages();
    } catch (imageError) {
      setError(imageError.message);
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

  const primaryImage = images.find((image) => image.is_primary) || images[0] || null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 3, flexWrap: 'wrap' }}>
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
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || generating || generatingPng}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleGeneratePng} disabled={saving || generating || generatingPng}>
            {generatingPng ? 'Generando...' : 'Descargar PNG'}
          </Button>
          <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={handleGenerate} disabled={saving || generating || generatingPng}>
            {generating ? 'Generando...' : 'Guardar y generar PDF'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6">Líneas del documento</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('descripcion')}>Descripción</Button>
                <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('filamento')}>Filamento</Button>
                <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('hardware')}>Hardware</Button>
                <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('mano_obra')}>Mano de obra</Button>
                <Button size="small" startIcon={<AddIcon />} onClick={() => addItem('producto')}>Producto</Button>
              </Box>
            </Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ '& .MuiTableCell-root': { px: 1, py: 0.75 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Texto / material</TableCell>
                  <TableCell>Color y purga</TableCell>
                  <TableCell>Gramos / precio</TableCell>
                  <TableCell>Detalle</TableCell>
                  <TableCell>Visible</TableCell>
                  <TableCell align="right">Quitar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {document.items.map((item, index) => (
                  <TableRow key={`${item.tipo}-${index}`}>
                    <TableCell sx={{ minWidth: 100 }}>{item.tipo}</TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
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
                    <TableCell sx={{ minWidth: 190 }}>
                      {item.tipo === 'filamento' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TextField
                            size="small"
                            label="Color"
                            value={item.color || ''}
                            onChange={(event) => updateItem(index, 'color', event.target.value)}
                            sx={{ width: 110 }}
                          />
                          <TextField
                            size="small"
                            type="color"
                            value={item.color_hex || '#95BCFC'}
                            onChange={(event) => updateItem(index, 'color_hex', event.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 58 }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label="Purga"
                            value={item.purge_grams || 0}
                            onChange={(event) => updateItem(index, 'purge_grams', event.target.value)}
                            sx={{ width: 86 }}
                          />
                        </Box>
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
                    <TableCell sx={{ minWidth: 180 }}>
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
            </TableContainer>
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
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Imágenes</Typography>
              <Chip size="small" label={`${images.length} ${images.length === 1 ? 'imagen' : 'imágenes'}`} />
            </Box>

            {primaryImage ? (
              <Box
                component="img"
                src={imageSrc(id, primaryImage)}
                alt={primaryImage.alt || document.modelo_base}
                sx={{
                  width: '100%',
                  maxHeight: 260,
                  objectFit: 'contain',
                  backgroundColor: 'background.default',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 1,
                  mb: 2
                }}
              />
            ) : (
              <Box
                sx={{
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  mb: 2,
                  color: 'text.secondary'
                }}
              >
                <ImageIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="body2">Agrega una imagen del producto</Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddPhotoAlternateIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Subiendo...' : 'Agregar imagen'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 1 }}>
              {images.map((image) => (
                <Box key={image.id} sx={{ position: 'relative' }}>
                  <Box
                    component="img"
                    src={imageSrc(id, image)}
                    alt={image.alt || image.filename}
                    sx={{
                      width: '100%',
                      height: 78,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: image.is_primary ? '2px solid' : '1px solid',
                      borderColor: image.is_primary ? 'primary.main' : 'divider'
                    }}
                  />
                  <Box sx={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 0.25 }}>
                    <IconButton
                      size="small"
                      onClick={() => markPrimary(image.id)}
                      aria-label="Marcar como principal"
                      sx={{ backgroundColor: 'rgba(0,0,0,0.55)', color: image.is_primary ? '#FFD54F' : '#fff' }}
                    >
                      {image.is_primary ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeImage(image.id)}
                      aria-label="Eliminar imagen"
                      sx={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              La imagen principal aparece en el PDF y en la imagen PNG para el cliente.
            </Typography>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Vista previa</Typography>
            <Typography variant="body2" color="text.secondary">
              El PDF usa la plantilla Impremática. La imagen PNG se genera sin espacios extra y en alta resolución.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default QuoteDocumentPage;
