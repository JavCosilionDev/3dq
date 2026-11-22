const fs = require('fs');
const path = require('path');
const { LABELS } = require('./labels');
const { formatDate } = require('./dates');
const { formatDuration } = require('./duration');
const { formatMoney, formatGrams } = require('./money');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(ROOT, 'config');
const assetCache = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : '#95BCFC';
}

function resolveConfigPath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.join(CONFIG_DIR, value);
}

function primaryImage(document) {
  const images = Array.isArray(document.imagenes) ? document.imagenes : [];
  return images.find((image) => image.primaria) || images[0] || null;
}

function imageSource(image) {
  if (!image) return null;
  return dataUri(resolveConfigPath(image.archivo), image.mime_type || 'image/png');
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
      const colorLabel = item.color ? ` · ${escapeHtml(item.color)}` : '';
      const dot = item.color_hex
        ? `<span class="color-dot" style="background:${safeColor(item.color_hex)}"></span>`
        : '';
      const purge = item.purge_grams > 0
        ? ` <span class="purge">· purga ${formatGrams(item.purge_grams)}</span>`
        : '';

      rows.push(`<tr><td class="description-cell" data-fit><div class="concept">${dot}<span>${escapeHtml(item.material)}${colorLabel}: ${formatGrams(item.gramos)}</span>${purge}</div></td></tr>`);
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
  const photo = imageSource(primaryImage(document));
  const productPhoto = photo
    ? `<div class="product-photo"><img src="${photo}" alt="${escapeHtml(primaryImage(document).alt || document.modelo_base)}"></div>`
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
    .concept { display: flex; align-items: center; flex-wrap: wrap; gap: 5pt; }
    .color-dot {
      display: inline-block;
      width: 8pt;
      height: 8pt;
      border-radius: 50%;
      border: 0.75pt solid #95BCFC;
      flex: 0 0 auto;
    }
    .purge { color: #666666; font-size: 9.5pt; }
    .product-photo {
      margin: 10pt 0 4pt 0;
      text-align: center;
    }
    .product-photo img {
      max-width: 150pt;
      max-height: 150pt;
      object-fit: contain;
      border: 1px solid #DAE7FE;
      border-radius: 4pt;
      padding: 4pt;
    }
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
    ${productPhoto}
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

function renderImageHtml(document, totalData, settings) {
  const brandName = settings.pdf_brand_name || settings.company_name || LABELS.brand;
  const brandUrl = settings.pdf_brand_url || 'imprematica.com';
  const currencySymbol = settings.currency_symbol || '$';
  const decimals = document.precios_incluyen_iva ? 2 : 0;
  const logoPath = resolveAssetPath(settings.pdf_logo_path || 'assets/images/imprematica-logo.png');
  const logo = dataUri(logoPath, 'image/png');
  const regularFont = dataUri(path.join(ROOT, 'assets/fonts/LiberationSans-Regular.ttf'), 'font/ttf');
  const boldFont = dataUri(path.join(ROOT, 'assets/fonts/LiberationSans-Bold.ttf'), 'font/ttf');
  const visibleItems = document.items.filter((item) => item.visible !== false);
  const primary = primaryImage(document);
  const photo = imageSource(primary);
  const model = document.regalo && !document.modelo_base.toLowerCase().includes('regalo')
    ? `${document.modelo_base} + regalo`
    : document.modelo_base;

  const conceptRows = visibleItems.map((item) => {
    if (item.tipo === 'filamento') {
      const dot = `<span class="dot" style="background:${safeColor(item.color_hex)}"></span>`;
      const name = [item.material, item.color].filter(Boolean).join(' · ');
      const purge = item.purge_grams > 0
        ? `<span class="muted">purga ${formatGrams(item.purge_grams)}</span>`
        : '';
      return `
        <div class="line">
          ${dot}
          <span class="line-name">${escapeHtml(name)}</span>
          <span class="line-value">${formatGrams(item.gramos)}</span>
          ${purge}
        </div>
      `;
    }

    if (item.tipo === 'producto') {
      return `
        <div class="line">
          <span class="line-name">${escapeHtml(item.texto)}</span>
          ${document.mostrar_precios_por_item
            ? `<span class="line-value">${formatMoney(Math.round(item.precio * 100), currencySymbol, decimals)}</span>`
            : ''}
        </div>
      `;
    }

    return `
      <div class="line">
        <span class="line-name">${escapeHtml(item.texto)}</span>
      </div>
    `;
  }).join('');

  const discountLabel = totalData.discountPercent > 0
    ? `${LABELS.discount} (${totalData.discountPercent}%)`
    : LABELS.discount;

  const totalRows = [
    [totalData.subtotalLabel, formatMoney(totalData.subtotal, currencySymbol, decimals)],
    ...(totalData.showDiscount ? [[discountLabel, `-${formatMoney(totalData.discount, currencySymbol, decimals)}`]] : []),
    ...(totalData.showNet ? [[LABELS.subtotalAfterDiscount, formatMoney(totalData.net, currencySymbol, decimals)]] : []),
    ...(totalData.showTax ? [[`${LABELS.tax} (${totalData.taxPercent}%)`, formatMoney(totalData.tax, currencySymbol, decimals)]] : []),
    ...(totalData.showShipping ? [[LABELS.shipping, formatMoney(totalData.shipping, currencySymbol, decimals)]] : []),
  ].map(([label, value]) => `
    <div class="total-row">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value)}</b>
    </div>
  `).join('');

  const duration = document.duracion_minutos > 0
    ? `<span class="chip">${LABELS.duration}: ${formatDuration(document.duracion_minutos)}</span>`
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
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #333333;
      font-family: 'Liberation Sans', Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .card {
      width: 780px;
      background: #ffffff;
      border: 1px solid #DAE7FE;
      border-radius: 18px;
      overflow: hidden;
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      padding: 26px 30px 20px 30px;
      background: linear-gradient(135deg, #F4F8FF 0%, #FFFFFF 65%);
      border-bottom: 1px solid #DAE7FE;
    }
    .brand-block { display: flex; align-items: center; gap: 12px; }
    .logo { width: 48px; height: 48px; object-fit: contain; }
    .brand-name { font-size: 24px; font-weight: 700; line-height: 1.1; color: #0060FA; }
    .brand-site { font-size: 12px; color: #5C6B84; margin-top: 2px; }
    .folio { text-align: right; }
    .folio .label { font-size: 12px; color: #5C6B84; }
    .folio .value { font-size: 20px; font-weight: 700; color: #333333; }
    .folio .date { font-size: 12px; color: #5C6B84; margin-top: 3px; }
    .hero {
      width: 100%;
      height: 360px;
      background: #F7FAFF;
      border-bottom: 1px solid #DAE7FE;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .hero img { width: 100%; height: 100%; object-fit: contain; padding: 20px; }
    .card-body { padding: 26px 30px 24px 30px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
      margin-bottom: 20px;
    }
    .meta-item span { display: block; font-size: 11px; color: #5C6B84; text-transform: uppercase; letter-spacing: 0.6px; }
    .meta-item b { display: block; font-size: 15px; margin-top: 2px; overflow-wrap: anywhere; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .chip {
      display: inline-block;
      background: #DAE7FE;
      color: #0B4AA8;
      border-radius: 999px;
      padding: 5px 11px;
      font-size: 12px;
      font-weight: 700;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #0060FA;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 1px solid #DAE7FE;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .lines { margin-bottom: 20px; }
    .line {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 0;
      border-bottom: 1px solid #EEF4FF;
      font-size: 14px;
    }
    .line:last-child { border-bottom: none; }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 1px solid #95BCFC;
      flex: 0 0 auto;
    }
    .line-name { flex: 1; overflow-wrap: anywhere; }
    .line-value { font-weight: 700; white-space: nowrap; }
    .muted { color: #6B778C; font-size: 12px; }
    .totals {
      background: #F7FAFF;
      border: 1px solid #DAE7FE;
      border-radius: 12px;
      padding: 16px 18px;
      margin-left: auto;
      width: 340px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 4px 0;
      font-size: 13px;
      color: #39465C;
    }
    .total-row b { color: #333333; }
    .total-final {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #95BCFC;
      margin-top: 10px;
      padding-top: 12px;
      font-size: 22px;
      font-weight: 700;
      color: #0060FA;
    }
    .total-final span { color: #333333; font-size: 15px; }
    .card-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 16px 30px;
      border-top: 1px solid #DAE7FE;
      background: #F7FAFF;
      color: #5C6B84;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-head">
      <div class="brand-block">
        ${logo ? `<img class="logo" src="${logo}" alt="${escapeHtml(brandName)}">` : ''}
        <div>
          <div class="brand-name">${escapeHtml(brandName)}</div>
          <div class="brand-site">${escapeHtml(brandUrl)}</div>
        </div>
      </div>
      <div class="folio">
        <div class="label">${LABELS.printNumber}</div>
        <div class="value">${escapeHtml(document.folio_salida)}</div>
        <div class="date">${formatDate(document.fecha_emision)}</div>
      </div>
    </div>
    ${photo ? `<div class="hero"><img src="${photo}" alt="${escapeHtml(primary.alt || document.modelo_base)}"></div>` : ''}
    <div class="card-body">
      <div class="meta-grid">
        <div class="meta-item"><span>${LABELS.client}</span><b>${escapeHtml(document.cliente)}</b></div>
        <div class="meta-item"><span>${LABELS.quantity}</span><b>${document.cantidad}</b></div>
        <div class="meta-item"><span>${LABELS.model}</span><b>${escapeHtml(model)}</b></div>
        <div class="meta-item"><span>${LABELS.date}</span><b>${formatDate(document.fecha_emision)}</b></div>
      </div>
      ${duration ? `<div class="chips">${duration}</div>` : ''}
      <div class="section-title">${LABELS.description}</div>
      <div class="lines">${conceptRows}</div>
      <div class="totals">
        ${totalRows}
        <div class="total-final">
          <span>${LABELS.total}</span>
          <b>${formatMoney(totalData.total, currencySymbol, decimals)}</b>
        </div>
      </div>
    </div>
    <div class="card-foot">
      <span>${escapeHtml(brandName)}</span>
      <span>${escapeHtml(brandUrl)}</span>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderHtml, renderImageHtml, escapeHtml };
