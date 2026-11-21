const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const pdfParse = require('pdf-parse');
const { calculateTotals } = require('../services/pdf/totals');
const { normalizeDocument } = require('../services/pdf/validate');
const { formatDuration } = require('../services/pdf/duration');
const { deriveOutputFolio } = require('../services/pdf/folio');
const { renderHtml } = require('../services/pdf/template');
const { renderPdf } = require('../services/pdf/renderer');
const { getSettings } = require('../services/pdf/settings');

const FIXTURES = path.join(__dirname, 'fixtures', 'pdf');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));
}

function settings() {
  return {
    ...getSettings({
      prepare() {
        return { all: () => [] };
      },
    }),
    pdf_brand_name: 'Impremática',
    pdf_brand_url: 'imprematica.com',
    pdf_logo_path: 'assets/images/imprematica-logo.png',
    pdf_template_version: 'imprematica-v1',
    pdf_shipping_note: 'Entrega estimada: 2 días hábiles en promedio.',
    currency_symbol: '$',
  };
}

test('calcula los totales históricos al peso', () => {
  const cases = {
    'IMP26-0003': { subtotal: 17200, discount: 0, tax: 2800, total: 20000 },
    'IMP26-0010': { subtotal: 21500, discount: 0, tax: 3500, total: 25000 },
    'IMP26-0013': { subtotal: 17200, discount: 5100, tax: 1900, total: 14000 },
    'IMP26-0030': { subtotal: 25300, discount: 6300, tax: 3000, total: 22000 },
    'IMP26-0034': { subtotal: 110900, discount: 33300, tax: 12400, total: 90000 },
    'IMP26-0028a': { subtotal: 47700, discount: 16700, tax: 5000, total: 56000, shipping: 20000 },
    'IMP26-0016': { subtotal: 25500, discount: 5500, tax: 0, total: 20000 },
  };

  for (const [name, expected] of Object.entries(cases)) {
    const { totals } = normalizeDocument(loadFixture(name));
    assert.equal(totals.subtotal, expected.subtotal, `${name} subtotal`);
    assert.equal(totals.discount, expected.discount, `${name} descuento`);
    assert.equal(totals.tax, expected.tax, `${name} IVA`);
    assert.equal(totals.total, expected.total, `${name} total`);
    if (expected.shipping !== undefined) {
      assert.equal(totals.shipping, expected.shipping, `${name} envío`);
    }
    assert.equal(
      totals.subtotal - totals.discount + totals.tax + totals.shipping,
      totals.total,
      `${name} ecuación`
    );
  }
});

test('formatea duraciones omitiendo componentes en cero', () => {
  const cases = [
    [30, '30m'],
    [450, '7h 30m'],
    [520, '8h 40m'],
    [1300, '21h 40m'],
    [1670, '1d 3h 50m'],
    [3487, '2d 10h 7m'],
  ];

  for (const [minutes, expected] of cases) {
    assert.equal(formatDuration(minutes), expected);
  }
});

test('deriva el folio de salida del folio de origen', () => {
  assert.equal(deriveOutputFolio('COT-3D-2026-0034'), 'IMP26-0034');
  assert.equal(deriveOutputFolio('COT-3D-2027-0001'), 'IMP27-0001');
});

test('rechaza textos prohibidos y totales que no cierran', () => {
  const sanitized = loadFixture('IMP26-0034');
  sanitized.items[0].material = 'Jayo PLA+';
  assert.equal(normalizeDocument(sanitized).document.items[0].material, 'PLA+');

  const badText = loadFixture('IMP26-0034');
  badText.modelo_base = 'Lámpara Jayo';
  assert.throws(() => normalizeDocument(badText), /prohibido/i);

  const badTotal = loadFixture('IMP26-0034');
  badTotal.subtotal_lista = 100;
  badTotal.total_objetivo = 250;
  assert.throws(() => normalizeDocument(badTotal), /descuento no puede ser negativo/i);
});

test('genera el PDF de Impremática con los datos del caso 0034', async () => {
  const fixture = loadFixture('IMP26-0034');
  const { document, totals } = normalizeDocument(fixture);
  const html = renderHtml(document, totals, settings());
  const pdf = await renderPdf(html);
  const text = (await pdfParse(pdf)).text;

  assert.match(text, /Impremática/);
  assert.match(text, /Impresión #: IMP26-0034/);
  assert.match(text, /2d 10h 7m/);
  assert.match(text, /PLA\+: 475\.00g/);
  assert.match(text, /4 Litofanías/);
  assert.match(text, /-\$333/);
  assert.match(text, /Total:\s*\$900/);

  for (const forbidden of ['Jayo', 'Labour', 'Invoice', 'Quote #', 'Tax', 'localhost', '1/1']) {
    assert.doesNotMatch(text, new RegExp(forbidden, 'i'));
  }
});

test('genera la variante de varios productos con precios', async () => {
  const fixture = loadFixture('IMP26-0016');
  const { document, totals } = normalizeDocument(fixture);
  const html = renderHtml(document, totals, settings());
  const pdf = await renderPdf(html);
  const text = (await pdfParse(pdf)).text;

  assert.match(text, /Precio/);
  assert.match(text, /\$170\.00/);
  assert.match(text, /\$85\.00/);
  assert.match(text, /Subtotal \(con IVA\):\s*\$255\.00/);
  assert.match(text, /Descuento:\s*-\$55\.00/);
  assert.match(text, /Total:\s*\$200\.00/);
});
