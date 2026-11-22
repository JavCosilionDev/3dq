import React, { useContext, useEffect, useMemo, useState } from 'react';
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
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { PointOfSale as PointOfSaleIcon } from '@mui/icons-material';
import SettingsContext from '../context/SettingsContext';

const PALETTE = ['#0060FA', '#95BCFC', '#DAE7FE', '#2E7D32', '#F9A825', '#7B1FA2', '#D32F2F', '#00838F'];

function money(value, symbol) {
  return `${symbol}${(Number(value) || 0).toFixed(2)}`;
}

function grams(value) {
  const amount = Number(value) || 0;
  return amount >= 1000 ? `${(amount / 1000).toFixed(2)} kg` : `${amount.toFixed(0)} g`;
}

function ChartCard({ title, subtitle, children, height = 280 }) {
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="h6">{title}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          {subtitle}
        </Typography>
      )}
      <Box sx={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}

function Metric({ label, value, hint, color }) {
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight="bold" color={color || 'text.primary'}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  );
}

function AnalyticsPage() {
  const { settings } = useContext(SettingsContext);
  const currency = settings.currency_symbol || '$';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/analytics');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'No se pudieron cargar los análisis');
        }

        setData(result);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = data?.summary || {};
  const weekly = data?.weekly || [];
  const monthly = data?.monthly || [];
  const materials = data?.materials || [];
  const colors = data?.colors || [];
  const payments = data?.payments || [];
  const models = data?.models || [];
  const printers = data?.printers || [];

  const purgeByColor = useMemo(
    () => (data?.colors || []).filter((color) => color.purge > 0).slice(0, 8),
    [data]
  );

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box>
          <Typography variant="h4">Análisis</Typography>
          <Typography variant="body2" color="text.secondary">
            Ventas, filamento, purga y conversión de cotizaciones.
          </Typography>
        </Box>
        <Button variant="outlined" component={Link} to="/sales" startIcon={<PointOfSaleIcon />}>
          Ver ventas
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Metric
            label="Ingresos"
            value={money(summary.revenue, currency)}
            hint={`${summary.saleCount || 0} ventas`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Metric
            label="IVA acumulado"
            value={money(summary.iva, currency)}
            hint={`Neto ${money(summary.net, currency)}`}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Metric
            label="Ticket promedio"
            value={money(summary.averageTicket, currency)}
            hint={`${summary.soldQuotes || 0} cotizaciones vendidas`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Metric
            label="Conversión"
            value={`${summary.conversion || 0}%`}
            hint={`${summary.soldQuotes || 0} de ${summary.totalQuotes || 0} cotizaciones`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <ChartCard title="Ventas por semana" subtitle="Últimas 12 semanas">
            <AreaChart data={weekly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0060FA" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#0060FA" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9aa4b2" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9aa4b2" />
              <Tooltip
                formatter={(value) => money(value, currency)}
                contentStyle={{ background: '#1e1e1e', border: '1px solid #333' }}
              />
              <Area type="monotone" dataKey="total" name="Ventas" stroke="#0060FA" fill="url(#weeklyFill)" strokeWidth={2} />
            </AreaChart>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <ChartCard title="Formas de pago" subtitle="Participación por importe">
            <PieChart>
              <Pie data={payments} dataKey="total" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                {payments.map((entry, index) => (
                  <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => money(value, currency)} contentStyle={{ background: '#1e1e1e', border: '1px solid #333' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ChartCard>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <ChartCard title="Ingresos por mes" subtitle="Últimos 12 meses">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9aa4b2" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9aa4b2" />
              <Tooltip formatter={(value) => money(value, currency)} contentStyle={{ background: '#1e1e1e', border: '1px solid #333' }} />
              <Bar dataKey="total" name="Ingresos" fill="#95BCFC" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <ChartCard title="Filamento por material" subtitle="Gramos consumidos en ventas">
            <PieChart>
              <Pie data={materials} dataKey="grams" nameKey="name" outerRadius={92}>
                {materials.map((entry, index) => (
                  <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => grams(value)} contentStyle={{ background: '#1e1e1e', border: '1px solid #333' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ChartCard>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Metric label="Filamento consumido" value={grams(summary.filamentGrams)} hint="En cotizaciones vendidas" />
        </Grid>
        <Grid item xs={12} md={4}>
          <Metric label="Purga generada" value={grams(summary.purgeGrams)} hint={`${summary.wasteRatio || 0}% del filamento`} color="warning.main" />
        </Grid>
        <Grid item xs={12} md={4}>
          <Metric label="Tiempo de impresión" value={`${summary.printHours || 0} h`} hint="Suma de configuraciones vendidas" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Purga por color" subtitle="Gramos desperdiciados por color y material" height={300}>
            {purgeByColor.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  Registra purga en los filamentos para ver este gráfico.
                </Typography>
              </Box>
            ) : (
              <BarChart data={purgeByColor} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9aa4b2" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 12 }}
                  stroke="#9aa4b2"
                />
                <Tooltip formatter={(value) => grams(value)} contentStyle={{ background: '#1e1e1e', border: '1px solid #333' }} />
                <Bar dataKey="purge" name="Purga" radius={[0, 6, 6, 0]}>
                  {purgeByColor.map((entry) => (
                    <Cell key={`${entry.material}-${entry.name}`} fill={entry.hex || '#F9A825'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Colores usados" subtitle="Gramos por material y color" height={300}>
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Color</TableCell>
                    <TableCell>Material</TableCell>
                    <TableCell align="right">Usado</TableCell>
                    <TableCell align="right">Purga</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {colors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">Sin datos</TableCell>
                    </TableRow>
                  ) : colors.map((color) => (
                    <TableRow key={`${color.material}-${color.name}`}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: color.hex || '#95BCFC',
                              border: '1px solid',
                              borderColor: 'divider'
                            }}
                          />
                          {color.name}
                        </Box>
                      </TableCell>
                      <TableCell>{color.material}</TableCell>
                      <TableCell align="right">{grams(color.grams)}</TableCell>
                      <TableCell align="right">{grams(color.purge)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </ChartCard>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Modelos más vendidos</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Modelo</TableCell>
                  <TableCell>Folio</TableCell>
                  <TableCell align="right">Ventas</TableCell>
                  <TableCell align="right">Ingresos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {models.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">Sin ventas registradas</TableCell>
                  </TableRow>
                ) : models.map((model) => (
                  <TableRow key={`${model.quote_number}-${model.name}`}>
                    <TableCell>{model.name}</TableCell>
                    <TableCell>{model.quote_number}</TableCell>
                    <TableCell align="right">{model.count}</TableCell>
                    <TableCell align="right">{money(model.total, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Impresoras</Typography>
            {printers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Sin datos de impresión.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {printers.map((printer) => (
                  <Box key={printer.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">{printer.name}</Typography>
                    <Chip size="small" label={`${printer.jobs} trabajos · ${(printer.minutes / 60).toFixed(1)} h`} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default AnalyticsPage;
