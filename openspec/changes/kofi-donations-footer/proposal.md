# Proposal

## Why

La plataforma *Papustanes en Mazmorras / Multiverse of Madness* ofrece acceso público a expedientes de lore, wikis interactivas y seguimiento de campañas de rol de mesa. Para sostener el mantenimiento de la infraestructura y el desarrollo continuo, se requiere un mecanismo de donaciones comunitarias no intrusivo, visualmente integrado en el pie de página (*footer*) de la aplicación y configurado con las mejores prácticas de comisiones para creadores en México (priorizando pasarelas como Stripe sobre PayPal para evitar pérdidas cambiarias y estableciendo montos mínimos eficientes).

## What Changes

- **Componente de Donaciones Ko-fi en el Footer**: Creación de un widget / botón de donación estilizado (`KofiFooterDonation`) integrado armónicamente en el footer global de `SciFiLayout` (y adaptable al footer de la Intranet ZRK).
- **Modal interactivo o enlace seguro**: Soporte para abrir el iframe modal nativo de Ko-fi o enlace directo a la página de creador sin interrumpir la experiencia de navegación del usuario.
- **Optimización de comisiones para México**: Configuración y recomendaciones documentadas para conectar Stripe prioritariamente sobre PayPal (reduciendo pérdidas del 3.5%–4% por tipo de cambio) y recomendación de aportación base ($50–$60 MXN o $3–$5 USD) para mitigar el impacto de las tarifas fijas por transacción.
- **Configuración de GitHub Sponsors / Funding**: Creación de `.github/FUNDING.yml` para activar nativamente el botón de "Sponsor" en el repositorio apuntando a Ko-fi.

## Capabilities

### New Capabilities
- `portal/donations`: Componente visual de patrocinio comunitario en el pie de página, soporte de integración de Ko-fi (overlay/modal o enlace) y archivo de financiamiento para el repositorio.

### Modified Capabilities
<!-- Ninguna capacidad previa requiere modificación de especificación -->

## Impact

- **Código Frontend**: Modificación de `src/portal/layouts/SciFiLayout.tsx`, creación de `src/portal/components/donations/KofiFooterDonation.tsx` y su hoja de estilos SCSS.
- **Repositorio**: Incorporación de `.github/FUNDING.yml`.
- **Dependencias**: Sin nuevas dependencias de terceros pesadas; usa CSS temático y carga condicional del script de Ko-fi únicamente si se opta por el overlay modal.
