const fs = require('fs');
const puppeteer = require('puppeteer-core');
const { ValidationError } = require('./errors');

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
];

function findBrowser() {
  const browserPath = CHROME_CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate));
  if (!browserPath) {
    throw new Error('No se encontró Chrome/Chromium. Configura PUPPETEER_EXECUTABLE_PATH.');
  }
  return browserPath;
}

async function waitForAssets(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
    }));
  });
}

async function renderPdf(html) {
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await waitForAssets(page);

    const overflow = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-fit]'))
        .filter((element) => element.scrollWidth > element.clientWidth + 2)
        .map((element) => element.textContent.trim());
    });

    if (overflow.length > 0) {
      throw new ValidationError(
        `El texto no cabe en la plantilla: ${overflow[0]}`,
        'layout',
        'text_overflow'
      );
    }

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      margin: {
        top: '0.6041666667in',
        right: '0.6in',
        bottom: '0.6041666667in',
        left: '0.6041666667in',
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function renderPng(html, selector = '.card') {
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--force-device-scale-factor=2',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    await waitForAssets(page);

    const element = await page.$(selector);
    if (!element) {
      throw new ValidationError('No se encontró el lienzo de la imagen', 'layout', 'image_canvas');
    }

    const png = await element.screenshot({
      type: 'png',
      omitBackground: false,
    });

    return Buffer.from(png);
  } finally {
    await browser.close();
  }
}

module.exports = { renderPdf, renderPng, findBrowser };
