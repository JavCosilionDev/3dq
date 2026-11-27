<p align="center">
  <img src="assets/images/imprematica-logo.png" width="120" alt="QMaticFDM"/>
</p>

# QMaticFDM

QMaticFDM es un fork de [3DQ](https://github.com/Migz93/3dq) mantenido por [Impremática](https://imprematica.com), con modificaciones y personalizaciones propias para cotizaciones, ventas y documentos de impresión 3D.

> **Basado en 3DQ** · Proyecto original: [Migz93/3dq](https://github.com/Migz93/3dq) · Licencia MIT.

## Características

- **Costo rápido**: estimaciones ágiles con los datos esenciales.
- **Cotizador paso a paso**: datos del trabajo, filamento con color y purga, hardware, impresión, mano de obra y resumen.
- **Historial de cotizaciones**: consulta, edición, duplicado y combinación de cotizaciones existentes.
- **Imágenes por cotización**: varias imágenes con una marcada como principal para el cliente.
- **PDF y PNG Impremática**: documentos con folio, totales validados y exportación de imagen en alta resolución.
- **Ventas**: una cotización puede tener varias ventas, con subtotal, IVA y referencia bancaria para conciliación.
- **Análisis**: ventas por semana y por mes, filamento consumido, purga, formas de pago, modelos más vendidos y conversión.
- **Filamentos, impresoras y hardware**: catálogos con costos, depreciación y consumo.
- **Spoolman**: sincronización opcional de filamentos.
- **Configuración y branding**: costos globales, impuestos, moneda, marca y datos del documento.

## Requisitos

- Node.js 20 o superior.
- Docker y Docker Compose para el entorno de producción.
- Chrome, Chromium o Edge para generar PDF y PNG.

## Inicio rápido con Docker

El proyecto usa `./config` como directorio persistente. Contiene la base de datos SQLite, las imágenes y los documentos generados. Docker Compose lo monta en `/config`.

```bash
npm run docker:up
```

La aplicación queda disponible en http://localhost:6123

El contenedor compila el cliente React e instala Chromium para la generación de documentos.

### Docker Compose

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

Comandos útiles:

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

No ejecutes `npm run dev` al mismo tiempo que Docker. El servidor de desarrollo usa el puerto `6123` para Express y `3000` para React; Docker sirve todo desde `6123`.

## Documentos

La exportación usa el documento canónico guardado en `quote_documents` y lo renderiza con Chromium. Requiere Chrome o Chromium:

- Windows: Chrome o Edge se detectan automáticamente.
- Linux/Docker: configura `PUPPETEER_EXECUTABLE_PATH` con la ruta de Chromium.

Generar un PDF desde un archivo JSON:

```bash
npm run pdf:render -- tests/fixtures/pdf/IMP26-0034.json
```

Ejecutar las pruebas de regresión de PDF:

```bash
npm run test:pdf
```

## Seguridad

3DQ, el proyecto base, fue desarrollado con apoyo de tecnologías de IA. QMaticFDM hereda ese código y agrega modificaciones propias; no se garantiza que el código esté libre de vulnerabilidades. Se recomienda:

- **Red local**: ejecutar la aplicación en la red local en lugar de exponerla directamente a internet.
- **VPN**: usar una VPN si se necesita acceso remoto.
- **Respaldos**: mantener copias de seguridad del archivo SQLite ubicado en `config`.
- **Actualizaciones**: revisar periódicamente las mejoras de seguridad.

## Contribuir

QMaticFDM es un proyecto open source y las contribuciones son bienvenidas. Puedes ayudar con código, pruebas, documentación, traducciones o reportes de errores.

- Revisa el [repositorio de QMaticFDM](https://github.com/JavCosilionDev/3dq).
- Abre un issue para reportar errores o proponer mejoras.
- Envía tus cambios mediante un pull request.

Si tu cambio es específico de QMaticFDM, descríbelo con claridad para que pueda integrarse sin afectar la compatibilidad con el proyecto base.

## Licencia

MIT. QMaticFDM conserva la licencia y el reconocimiento del proyecto original [3DQ](https://github.com/Migz93/3dq).
