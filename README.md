<p align="center">
  <img src="assets/images/Logo.svg" alt="3DQ Logo"/>
</p>

3DQ is a self-hosted quoting tool for 3D prints.
It helps you calculate quotes for 3D printing jobs by considering filament costs, power usage, printer depreciation, labor, and more.

# Preview

![Home Page](./assets/screenshots/Screenshot_Home.jpg)
![Quote](./assets/screenshots/Screenshot_Quote.jpg)
![Invoice](./assets/screenshots/Screenshot_Invoice.jpg)
![InvoiceInternal](./assets/screenshots/Screenshot_InvoiceInternal.jpg)

## Features

- **Quick Cost**: Generate fast cost estimates with minimal inputs
- **Quote Builder**: Create detailed quotes with a step-by-step process (general info, filament, hardware, labour, cost summary)
- **Quote History**: View & manage all past quotes
- **Impremática PDF**: Generate client-ready PDFs from a validated document, with totals that close to the peso
- **Document Editor**: Adjust issue date, target total, discount mode, shipping, gift flag and visible lines before exporting
- **Sales Tracking**: Mark quotes as sold and review sold totals separately
- **Quote Merging**: Combine existing quotes into one multi-product document using their calculated totals
- **HTML Invoices**: Generate client-friendly or detailed internal invoices with optional tax calculation
- **Filament Management**: Configure filament types with pricing and sync with Spoolman
- **Printer Management**: Configure printers with depreciation and power usage calculations
- **Hardware Management**: Configure additional components used in prints (screws, magnets, etc.)
- **Settings**: Configure global settings (electricity cost, labor rate, markup, tax rate, currency, branding, etc.)
- **Customizable Branding**: Personalize with your brand color & name.

## Getting Started

> **Note**: The project uses `./config` as the persistent data directory. It contains the SQLite database and generated PDFs. Docker Compose mounts it at `/config`.

### Quick Start with Docker

```bash
npm run docker:up
```

Then access the application at http://localhost:6123

The container builds the current project, including the React client and Chromium for PDF generation.

### Docker Compose

The repository includes `docker-compose.yml`:

```yaml
services:
  3dq:
    build: .
    container_name: 3dq
    ports:
      - "6123:6123"
    volumes:
      - ./config:/config
    environment:
      CONFIG_DIR: /config
      PORT: 6123
      NODE_ENV: production
      PUPPETEER_EXECUTABLE_PATH: /usr/bin/chromium
    restart: unless-stopped
```

Useful commands:

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

Do not run `npm run dev` at the same time as Docker. The development server uses port `6123` for Express and `3000` for React; Docker serves everything from `6123`.

## PDF Impremática

The PDF export uses the canonical document stored in `quote_documents` and renders it with Chromium. It requires Chrome or Chromium:

- Windows: Chrome or Edge is detected automatically.
- Linux/Docker: set `PUPPETEER_EXECUTABLE_PATH` to the Chromium executable.

Generate a PDF from a JSON file:

```bash
npm run pdf:render -- tests/fixtures/pdf/IMP26-0034.json
```

Run the PDF regression tests:

```bash
npm run test:pdf
```

## Security Notice

3DQ was developed with the use of AI technologies (Windsurf with Claude 3.7 Sonnet). We can't verify that best practices were followed nor that the code is free of vulnerabilities.
Therefore we recommend:

- **Local Network Only**: For optimal security, run 3DQ on your local network rather than exposing it directly to the internet
- **Use VPN**: If remote access is needed, consider using a VPN
- **Regular Backups**: Keep regular backups of your database file located in the config directory
- **Updates**: Check for updates regularly as security improvements may be released

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

