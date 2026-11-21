const fs = require('fs');
const path = require('path');
const { LABELS } = require('./labels');
const { formatDate } = require('./dates');
const { formatDuration } = require('./duration');
const { formatMoney, formatGrams } = require('./money');

const ROOT = path.join(__dirname, '..', '..');
const assetCache = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readAsset(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  if (!assetCache.has(filePath)) {
    assetCache.set(filePath, fs.readFileSync(filePath));
  }
  return assetCache.get(filePath);
}

function dataUri(filePath, mimeType) {
  const contents = readAsset(filePath);
  return contents ? `data:${mimeType};base64,${contents.toString('base64')}` : null;
}

function resolveAssetPath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function renderProductRows(products, currencySymbol, decimals) {
  return products.map((product) => {
    const detail = product.detalle.length > 0
      ? [product.texto, ...product.detalle]
      : [product.texto];

    return `
      <tr>
        <td class="description-cell" data-fit>
          ${detail.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        </td>
        <td class="price-cell">${formatMoney(Math.round(product.precio * 100), currencySymbol, decimals)}</td>
      </tr>
    `;
  }).join('');
}

function renderConceptRows(document, items) {
  const rows = [];

  if (document.duracion_minutos > 0) {
    rows.push(`<tr><td class="description-cell" data-fit>${LABELS.duration}: ${formatDuration(document.duracion_minutos)}</td></tr>`);
  }

  for (const item of items) {
    if (item.tipo === 'filamento') {
      rows.push(`<tr><td class="description-cell" data-fit>${escapeHtml(item.material)}: ${formatGrams(item.gramos)}</td></tr>`);
    } else if (item.tipo === 'descripcion' || item.tipo === 'hardware' || item.tipo === 'mano_obra') {
      rows.push(`<tr><td class="description-cell" data-fit>${escapeHtml(item.texto)}</td></tr>`);
    }
  }

  return rows.join('');
}

function renderTotals(totalData, document, currencySymbol, decimals) {
  const rows = [];
  const discountLabel = totalData.discountPercent > 0
    ? `${LABELS.discount} (${totalData.discountPercent}%)`
    : LABELS.discount;

  rows.push([totalData.subtotalLabel, formatMoney(totalData.subtotal, currencySymbol, decimals)]);

  if (totalData.showDiscount) {
    rows.push([discountLabel, `-${formatMoney(totalData.discount, currencySymbol, decimals)}`]);
  }
  if (totalData.showNet) {
    rows.push([LABELS.subtotalAfterDiscount, formatMoney(totalData.net, currencySymbol, decimals)]);
  }
  if (totalData.showTax) {
    rows.push([`${LABELS.tax} (${totalData.taxPercent}%)`, formatMoney(totalData.tax, currencySymbol, decimals)]);
  }
  if (totalData.showShipping) {
    rows.push([LABELS.shipping, formatMoney(totalData.shipping, currencySymbol, decimals)]);
  }

  const body = rows.map(([label, value]) => `
    <div class="total-row">
      <span class="total-label">${escapeHtml(label)}:</span>
      <span class="total-value">${escapeHtml(value)}</span>
    </div>
  `).join('');

  return `
    <div class="totals">
      ${body}
      <div class="total-row total-final">
        <span class="total-label">${LABELS.total}:</span>
        <span class="total-value">${formatMoney(totalData.total, currencySymbol, decimals)}</span>
      </div>
    </div>
  `;
}

function renderHtml(document, totalData, settings) {
  const brandName = settings.pdf_brand_name || settings.company_name || LABELS.brand;
  const brandUrl = settings.pdf_brand_url || 'imprematica.com';
  const currencySymbol = settings.currency_symbol || '$';
  const decimals = document.precios_incluyen_iva ? 2 : 0;
  const logoPath = resolveAssetPath(settings.pdf_logo_path || 'assets/images/imprematica-logo.png');
  const logo = dataUri(logoPath, 'image/png');
  const regularFont = dataUri(path.join(ROOT, 'assets/fonts/LiberationSans-Regular.ttf'), 'font/ttf');
  const boldFont = dataUri(path.join(ROOT, 'assets/fonts/LiberationSans-Bold.ttf'), 'font/ttf');
  const visibleItems = document.items.filter((item) => item.visible !== false);
  const products = visibleItems.filter((item) => item.tipo === 'producto');
  const hasProducts = products.length > 0;
  const model = document.regalo && !document.modelo_base.toLowerCase().includes('regalo')
    ? `${document.modelo_base} + regalo`
    : document.modelo_base;
  const tableHeader = hasProducts
    ? `<thead><tr><th>${LABELS.description}</th><th class="price-cell">${LABELS.price}</th></tr></thead>`
    : `<thead><tr><th>${LABELS.description}</th></tr></thead>`;
  const tableBody = hasProducts
    ? renderProductRows(products, currencySymbol, decimals)
    : renderConceptRows(document, visibleItems);
  const shippingNote = document.envio?.monto > 0
    ? (document.envio.nota_entrega || settings.pdf_shipping_note || LABELS.shippingNote)
    : null;
  const notes = document.notas.length > 0
    ? `<div class="notes">${document.notas.map((note) => `<div>${escapeHtml(note)}</div>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(brandName)} - ${escapeHtml(document.folio_salida)}</title>
  <style>
    @font-face {
      font-family: 'Liberation Sans';
      src: url('${regularFont}') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Liberation Sans';
      src: url('${boldFont}') format('truetype');
      font-weight: 700;
      font-style: normal;
    }
    @page {
      size: 612pt 792pt;
      margin: 43.5pt 43.2pt 43.5pt 43.5pt;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #333333;
      font-family: 'Liberation Sans', Arial, sans-serif;
      font-size: 11pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { width: 100%; }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      min-height: 45pt;
    }
    .logo { width: 45pt; height: 45pt; object-fit: contain; }
    .site { font-weight: 700; font-size: 11pt; padding-top: 10pt; }
    .brand {
      margin: 18pt 0 0 0;
      font-size: 24pt;
      line-height: 1.1;
      font-weight: 700;
      color: #333333;
    }
    .print-number {
      margin-top: 2pt;
      font-size: 16pt;
      line-height: 1.15;
      font-weight: 700;
    }
    .rule { height: 1.5pt; background: #0060FA; margin: 14pt 0; }
    .meta {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      column-gap: 20pt;
      row-gap: 4pt;
      font-size: 11pt;
    }
    .meta .right { text-align: right; }
    .meta b { font-weight: 700; }
    .model { overflow-wrap: anywhere; word-break: break-word; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 4pt;
    }
    thead { display: table-header-group; }
    th {
      background: #DAE7FE;
      border: 1px solid #95BCFC;
      color: #333333;
      font-size: 14pt;
      font-weight: 700;
      text-align: left;
      padding: 6pt 8pt;
    }
    td {
      border: 1px solid #AFCCFD;
      color: #333333;
      font-size: 11pt;
      padding: 6pt 8pt;
      min-height: 25.5pt;
      vertical-align: top;
    }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .description-cell { overflow-wrap: anywhere; word-break: break-word; }
    .price-cell {
      width: 22%;
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
    }
    .totals {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      margin-top: 14pt;
      font-size: 12pt;
      line-height: 1.55;
    }
    .total-row { display: flex; justify-content: flex-end; gap: 8pt; }
    .total-label { text-align: right; }
    .total-value { min-width: 70pt; text-align: right; }
    .total-final { margin-top: 2pt; font-size: 14pt; font-weight: 700; }
    .notes {
      margin-top: 12pt;
      font-size: 10pt;
      line-height: 1.5;
      color: #333333;
    }
    .shipping-note {
      margin-top: 10pt;
      font-size: 10.5pt;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      ${logo ? `<img class="logo" src="${logo}" alt="${escapeHtml(brandName)}">` : ''}
      <div class="site">${escapeHtml(brandUrl)}</div>
    </div>
    <h1 class="brand">${escapeHtml(brandName)}</h1>
    <div class="print-number">${LABELS.printNumber}: ${escapeHtml(document.folio_salida)}</div>
    <div class="rule"></div>
    <div class="meta">
      <div>${LABELS.client}: <b>${escapeHtml(document.cliente)}</b></div>
      <div class="right">${LABELS.date}: <b>${formatDate(document.fecha_emision)}</b></div>
      <div class="model" data-fit>${LABELS.model}: <b>${escapeHtml(model)}</b></div>
      <div class="right">${LABELS.quantity}: <b>${document.cantidad}</b></div>
    </div>
    <div class="rule"></div>
    <table>
      ${tableHeader}
      <tbody>${tableBody}</tbody>
    </table>
    ${renderTotals(totalData, document, currencySymbol, decimals)}
    ${shippingNote ? `<div class="shipping-note"><b>${escapeHtml(shippingNote.split(':')[0])}:</b>${escapeHtml(shippingNote.includes(':') ? shippingNote.slice(shippingNote.indexOf(':') + 1) : '')}</div>` : ''}
    ${notes}
  </div>
</body>
</html>`;
}

module.exports = { renderHtml, escapeHtml };
