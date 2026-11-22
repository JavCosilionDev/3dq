import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Menu,
  MenuItem,
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
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  FileCopy as FileCopyIcon,
  Image as ImageIcon,
  MoreVert as MoreVertIcon,
  PictureAsPdf as PictureAsPdfIcon,
  PointOfSale as PointOfSaleIcon
} from '@mui/icons-material';
import SettingsContext from '../context/SettingsContext';

function money(value, symbol = '$') {
  return `${symbol}${(Number(value) || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return `${day}/${month}/${year}`;
}

function formatPrintTime(totalMinutes) {
  if (!totalMinutes) return '0m';
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
  ].filter(Boolean).join(' ') || '0m';
}

function imageSrc(quoteId, image) {
  if (!image || !image.id) return '';
  return `/api/quotes/${quoteId}/images/${image.id}/file?v=${(image.sha256 || '').slice(0, 10)}`;
}

function ViewQuote() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = React.useContext(SettingsContext);
  const currency = settings.currency_symbol || '$';

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingPng, setGeneratingPng] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [saleForm, setSaleForm] = useState({
    sale_date: new Date().toISOString().slice(0, 10),
    amount: '',
    payment_method: 'Transferencia',
    bank_reference: '',
    iva_amount: '',
    notes: ''
  });

  const loadQuote = async () => {
    const response = await fetch(`/api/quotes/${id}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo cargar la cotización');
    }

    setQuote(data);
    return data;
  };

  useEffect(() => {
    loadQuote()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDuplicateQuote = async () => {
    setDuplicating(true);
    setMenuAnchor(null);
    try {
      const response = await fetch(`/api/quotes/${id}/duplicate`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo duplicar');
      navigate(`/quote/${data.id}`);
    } catch (duplicateError) {
      setActionError(duplicateError.message);
    } finally {
      setDuplicating(false);
    }
  };

  const handleDeleteQuote = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('No se pudo eliminar la cotización');
      navigate('/quotes');
    } catch (deleteError) {
      setActionError(deleteError.message);
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const generatePdf = async (download = false) => {
    setGeneratingPdf(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/quotes/${id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo generar el PDF');
      window.open(download ? `${data.url}?download=1` : data.url, '_blank');
    } catch (pdfError) {
      setActionError(pdfError.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const generatePng = async () => {
    setGeneratingPng(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/quotes/${id}/png`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo generar la imagen');
      window.open(`${data.url}?download=1`, '_blank');
    } catch (pngError) {
      setActionError(pngError.message);
    } finally {
      setGeneratingPng(false);
    }
  };

  const openSaleDialog = () => {
    const total = Number(quote?.total_cost) || 0;
    const sold = (quote?.sales || []).reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
    const remaining = Math.max(0, total - sold);

    setSaleForm({
      sale_date: new Date().toISOString().slice(0, 10),
      amount: Number(remaining || total).toFixed(2),
      payment_method: 'Transferencia',
      bank_reference: '',
      iva_amount: '',
      notes: ''
    });
    setSaleDialogOpen(true);
  };

  const updateSaleField = (field, value) => {
    setSaleForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveSale = async () => {
    setSavingSale(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/quotes/${id}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...saleForm,
          iva_amount: saleForm.iva_amount === '' ? undefined : Number(saleForm.iva_amount)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar la venta');
      await loadQuote();
      setSaleDialogOpen(false);
    } catch (saleError) {
      setActionError(saleError.message);
    } finally {
      setSavingSale(false);
    }
  };

  const handleDeleteSale = async (sale) => {
    if (!window.confirm(`¿Eliminar la venta del ${formatDate(sale.sale_date)} por ${money(sale.amount, currency)}?`)) {
      return;
    }

    setActionError(null);
    try {
      const response = await fetch(`/api/sales/${sale.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar la venta');
      await loadQuote();
    } catch (saleError) {
      setActionError(saleError.message);
    }
  };

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

  if (!quote) {
    return <Alert severity="warning">Cotización no encontrada</Alert>;
  }

  const quantity = Number(quote.quantity) || 1;
  const filaments = quote.filaments || [];
  const hardware = quote.hardware || [];
  const sales = quote.sales || [];
  const images = quote.images || [];
  const documentData = quote.document || null;
  const isMerged = Boolean(
    (quote.source_quotes && quote.source_quotes.length > 1)
    || (documentData?.items || []).some((item) => item.tipo === 'producto')
  );
  const hasBreakdown = Boolean(filaments.length || hardware.length || quote.print_setup || quote.labour);
  const primaryImage = images.find((image) => image.is_primary) || images[0] || null;

  const filamentTotal = filaments.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const hardwareTotal = hardware.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const powerCost = Number(quote.print_setup?.power_cost || 0);
  const depreciationCost = Number(quote.print_setup?.depreciation_cost || 0);
  const labourCost = Number(quote.labour?.total_cost || 0);
  const productionCost = (filamentTotal + hardwareTotal + powerCost + depreciationCost + labourCost) * quantity;
  const total = Number(quote.total_cost) || 0;
  const soldTotal = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const ivaTotal = sales.reduce((sum, sale) => sum + Number(sale.iva_amount || 0), 0);
  const netTotal = sales.reduce((sum, sale) => sum + Number(sale.subtotal || 0), 0);
  const balance = total - soldTotal;
  const taxRate = Number(documentData?.iva_pct ?? settings.tax_rate) || 0;
  const estimatedIva = quotedIva(total, taxRate);
  const soldCount = sales.length;
  const statusCode = quote.status || (soldCount > 0 ? 'sold' : 'quoted');
  const statusLabel = statusCode === 'cancelled'
    ? 'Cancelada'
    : statusCode === 'sold' || soldCount > 0
      ? `Vendidos: ${soldCount || 1}`
      : 'Cotizada';
  const statusColor = statusCode === 'cancelled' ? 'default' : (soldCount > 0 || statusCode === 'sold') ? 'success' : 'primary';
  const documentProducts = (documentData?.items || []).filter((item) => item.tipo === 'producto');
  const totalFilamentGrams = filaments.reduce((sum, item) => sum + Number(item.grams_used || 0), 0);
  const totalPurgeGrams = filaments.reduce((sum, item) => sum + Number(item.purge_grams || 0), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <IconButton component={Link} to="/quotes" aria-label="Volver a cotizaciones">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1, minWidth: 220 }}>
          {quote.title}
        </Typography>
        <Chip size="small" label={statusLabel} color={statusColor} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="contained"
            component={Link}
            to={hasBreakdown ? `/quote/edit/${id}` : `/quote/${id}/document`}
            startIcon={<EditIcon />}
          >
            {hasBreakdown ? 'Editar cotización' : 'Editar documento'}
          </Button>
          <Button variant="outlined" component={Link} to={`/quote/${id}/document`} startIcon={<DescriptionIcon />}>
            Documento PDF
          </Button>
          <Button variant="outlined" onClick={() => generatePdf(false)} startIcon={<PictureAsPdfIcon />} disabled={generatingPdf}>
            {generatingPdf ? 'Generando...' : 'Ver PDF'}
          </Button>
          <Button variant="outlined" onClick={() => generatePdf(true)} startIcon={<DownloadIcon />} disabled={generatingPdf}>
            Descargar PDF
          </Button>
          <Button variant="outlined" onClick={generatePng} startIcon={<ImageIcon />} disabled={generatingPng}>
            {generatingPng ? 'Generando...' : 'Descargar PNG'}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>
          <Button variant="contained" color="success" onClick={openSaleDialog} startIcon={<PointOfSaleIcon />}>
            Registrar venta
          </Button>
          <IconButton
            aria-label="Más acciones"
            onClick={(event) => setMenuAnchor(event.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={handleDuplicateQuote} disabled={duplicating}>
            <FileCopyIcon fontSize="small" sx={{ mr: 1 }} />
            {duplicating ? 'Duplicando...' : 'Duplicar cotización'}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDeleteDialogOpen(true);
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Eliminar cotización
          </MenuItem>
        </Menu>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="body2" color="text.secondary">Total cotizado</Typography>
            <Typography variant="h5" fontWeight="bold">{money(total, currency)}</Typography>
            <Typography variant="caption" color="text.secondary">{quote.quote_number}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="body2" color="text.secondary">Vendido</Typography>
            <Typography variant="h5" fontWeight="bold">{money(soldTotal, currency)}</Typography>
            <Typography variant="caption" color="text.secondary">{soldCount} {soldCount === 1 ? 'venta' : 'ventas'}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="body2" color="text.secondary">IVA de ventas</Typography>
            <Typography variant="h5" fontWeight="bold">{money(ivaTotal, currency)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {sales.length > 0 ? `Neto ${money(netTotal, currency)}` : `Estimado ${money(estimatedIva, currency)}`}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="body2" color="text.secondary">Saldo</Typography>
            <Typography variant="h5" fontWeight="bold" color={balance > 0 ? 'warning.main' : 'success.main'}>
              {money(balance, currency)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {balance > 0 ? 'Pendiente de cobro' : 'Cobrado'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Datos del cliente</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Cliente</Typography>
                <Typography>{quote.customer_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Fecha</Typography>
                <Typography>{formatDate(quote.date)}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Cantidad</Typography>
                <Typography>{quantity}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Ventas</Typography>
                <Typography>{soldCount}</Typography>
              </Grid>
              {quote.notes && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Notas</Typography>
                  <Typography variant="body2">{quote.notes}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>

          {isMerged && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Productos del documento</Typography>
              {documentProducts.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Precio</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {documentProducts.map((item, index) => (
                      <TableRow key={`${item.texto}-${index}`}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">{item.texto}</Typography>
                          {(item.detalle || []).map((line) => (
                            <Typography key={line} variant="caption" color="text.secondary" display="block">
                              {line}
                            </Typography>
                          ))}
                        </TableCell>
                        <TableCell align="right">{money(item.precio, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Esta cotización combina varios productos. El detalle está en el documento.
                </Typography>
              )}
              {(quote.source_quotes || []).length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    Cotizaciones origen:
                  </Typography>
                  {quote.source_quotes.map((source) => (
                    <Chip
                      key={source.id}
                      size="small"
                      label={source.quote_number}
                      component={Link}
                      to={`/quote/${source.id}`}
                      clickable
                    />
                  ))}
                </Box>
              )}
            </Paper>
          )}

          {hasBreakdown && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Materiales y producción</Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Costo de producción</Typography>
                  <Typography fontWeight="bold">{money(productionCost, currency)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Filamento</Typography>
                  <Typography fontWeight="bold">{totalFilamentGrams.toFixed(2)} g</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Purga</Typography>
                  <Typography fontWeight="bold">{totalPurgeGrams.toFixed(2)} g</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Margen</Typography>
                  <Typography fontWeight="bold">{Number(quote.markup_percent || 0)}%</Typography>
                </Grid>
              </Grid>

              {filaments.length > 0 && (
                <TableContainer sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Material / color</TableCell>
                        <TableCell align="right">Usado</TableCell>
                        <TableCell align="right">Purga</TableCell>
                        <TableCell align="right">Costo</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filaments.map((filament) => (
                        <TableRow key={filament.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  backgroundColor: filament.color_hex || '#95BCFC',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  flex: '0 0 auto'
                                }}
                              />
                              <span>
                                {filament.material || filament.filament_name}
                                {filament.color_name ? ` · ${filament.color_name}` : ''}
                              </span>
                            </Box>
                          </TableCell>
                          <TableCell align="right">{Number(filament.grams_used || 0).toFixed(2)} g</TableCell>
                          <TableCell align="right">{Number(filament.purge_grams || 0).toFixed(2)} g</TableCell>
                          <TableCell align="right">{money(filament.total_cost, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {quote.print_setup && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {quote.print_setup.printer_name} · {formatPrintTime(quote.print_setup.print_time)} · Energía {money(powerCost, currency)} · Depreciación {money(depreciationCost, currency)}
                </Typography>
              )}

              {hardware.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Hardware: {hardware.map((item) => `${item.hardware_name} ×${item.quantity}`).join(', ')}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                  <Typography>{money(total - estimatedIva, currency)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">IVA ({taxRate}%)</Typography>
                  <Typography>{money(estimatedIva, currency)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Descuento</Typography>
                  <Typography>{Number(quote.discount_percent || 0)}%</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                  <Typography fontWeight="bold">{money(total, currency)}</Typography>
                </Grid>
              </Grid>
            </Paper>
          )}

          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6">Ventas</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={openSaleDialog}>Registrar venta</Button>
            </Box>
            {sales.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aún no hay ventas registradas. Puedes registrar varias ventas para esta cotización.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Forma de pago</TableCell>
                      <TableCell>Referencia bancaria</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                      <TableCell align="right">IVA</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Quitar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{formatDate(sale.sale_date)}</TableCell>
                        <TableCell>{sale.payment_method || '-'}</TableCell>
                        <TableCell>{sale.bank_reference || '-'}</TableCell>
                        <TableCell align="right">{money(sale.subtotal, currency)}</TableCell>
                        <TableCell align="right">{money(sale.iva_amount, currency)}</TableCell>
                        <TableCell align="right"><strong>{money(sale.amount, currency)}</strong></TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => handleDeleteSale(sale)} aria-label="Eliminar venta">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} align="right"><strong>Total</strong></TableCell>
                      <TableCell align="right"><strong>{money(netTotal, currency)}</strong></TableCell>
                      <TableCell align="right"><strong>{money(ivaTotal, currency)}</strong></TableCell>
                      <TableCell align="right"><strong>{money(soldTotal, currency)}</strong></TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Imagen del producto</Typography>
              <Button size="small" component={Link} to={`/quote/${id}/document`}>Gestionar</Button>
            </Box>
            {primaryImage ? (
              <Box
                component="img"
                src={imageSrc(id, primaryImage)}
                alt={primaryImage.alt || quote.title}
                sx={{
                  width: '100%',
                  maxHeight: 300,
                  objectFit: 'contain',
                  backgroundColor: 'background.default',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 1
                }}
              />
            ) : (
              <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <ImageIcon sx={{ fontSize: 36, mb: 1 }} />
                <Typography variant="body2">Sin imagen principal</Typography>
              </Box>
            )}
            {images.length > 1 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(54px, 1fr))', gap: 1, mt: 2 }}>
                {images.map((image) => (
                  <Box
                    key={image.id}
                    component="img"
                    src={imageSrc(id, image)}
                    alt={image.alt || image.filename}
                    sx={{
                      width: '100%',
                      height: 54,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: image.is_primary ? '2px solid' : '1px solid',
                      borderColor: image.is_primary ? 'primary.main' : 'divider'
                    }}
                  />
                ))}
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Resumen de cuenta</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Total cotizado</Typography>
              <Typography variant="body2">{money(total, currency)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Subtotal vendido</Typography>
              <Typography variant="body2">{money(netTotal, currency)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">IVA vendido</Typography>
              <Typography variant="body2">{money(ivaTotal, currency)}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" fontWeight="bold">Saldo</Typography>
              <Typography variant="body2" fontWeight="bold">{money(balance, currency)}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              El IVA de cada venta se guarda por separado para contabilidad.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={saleDialogOpen} onClose={() => setSaleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Registrar venta</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fecha de venta"
                type="date"
                fullWidth
                value={saleForm.sale_date}
                onChange={(event) => updateSaleField('sale_date', event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Importe total"
                type="number"
                fullWidth
                value={saleForm.amount}
                onChange={(event) => updateSaleField('amount', event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Forma de pago"
                fullWidth
                value={saleForm.payment_method}
                onChange={(event) => updateSaleField('payment_method', event.target.value)}
              >
                <MenuItem value="Transferencia">Transferencia</MenuItem>
                <MenuItem value="Efectivo">Efectivo</MenuItem>
                <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                <MenuItem value="Otro">Otro</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Referencia bancaria"
                fullWidth
                value={saleForm.bank_reference}
                onChange={(event) => updateSaleField('bank_reference', event.target.value)}
                helperText="Para conciliar con el movimiento del banco"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="IVA (opcional)"
                type="number"
                fullWidth
                value={saleForm.iva_amount}
                onChange={(event) => updateSaleField('iva_amount', event.target.value)}
                helperText={`Vacío = ${taxRate}% incluido en el importe`}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Notas"
                fullWidth
                value={saleForm.notes}
                onChange={(event) => updateSaleField('notes', event.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaleDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveSale} disabled={savingSale}>
            {savingSale ? 'Guardando...' : 'Guardar venta'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Eliminar cotización</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar la cotización "{quote.title}"? Se eliminarán también sus ventas, imágenes y documentos. Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleDeleteQuote} color="error" disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function quotedIva(total, taxRate) {
  if (!(taxRate > 0) || !(total > 0)) return 0;
  return total - total / (1 + taxRate / 100);
}

export default ViewQuote;
