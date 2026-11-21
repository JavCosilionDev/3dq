const fs = require('fs');
const path = require('path');
const { normalizeDocument } = require('../services/pdf/validate');
const { renderHtml } = require('../services/pdf/template');
const { renderPdf } = require('../services/pdf/renderer');
const { DEFAULTS } = require('../services/pdf/settings');

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Uso: node scripts/render-pdf.js <documento.json> [salida.pdf]');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const { document, totals } = normalizeDocument(input);
  const outputPath = process.argv[3] || path.join(process.cwd(), `${document.folio_salida}.pdf`);
  const html = renderHtml(document, totals, DEFAULTS);
  const pdf = await renderPdf(html);

  fs.writeFileSync(outputPath, pdf);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
