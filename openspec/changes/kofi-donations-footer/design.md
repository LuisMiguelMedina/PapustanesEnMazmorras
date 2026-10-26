# Design

## Context

El portal web *Papustanes en Mazmorras* utiliza actualmente `SciFiLayout` como layout público general y `Layout` para el área de Intranet. Los pies de página actuales contienen únicamente texto de copyright estático. La integración de Ko-fi busca habilitar apoyo comunitario mediante micro-mecenazgo de manera visualmente integrada con la estética de fantasía/sci-fi del proyecto, evitando botones flotantes intrusivos y optimizando la recaudación neta en México según las directrices de comisiones.

## Goals / Non-Goals

**Goals:**
- Diseñar e implementar un componente modular `KofiFooterDonation` para el footer de `SciFiLayout` y adaptable a `Layout`.
- Estilizar el botón con los colores temáticos del portal (oro/ámbar medieval y acentos de Ko-fi `#FF5E5B`) respetando la atmósfera del sitio.
- Soporte para abrir la pasarela de Ko-fi mediante un modal/overlay no invasivo o enlace seguro con apertura en nueva pestaña (`target="_blank"`).
- Añadir `.github/FUNDING.yml` en la raíz del repositorio para activar el botón nativo de "Sponsor" en GitHub.
- Dejar parametrizado el identificador de usuario (`kofiUsername`) para facilitar su modificación sin tocar lógica de negocio.

**Non-Goals:**
- No se implementa procesamiento de pagos propio ni manejo de tarjetas en frontend/backend (Ko-fi y Stripe gestionan toda la seguridad PCI-DSS).
- No se requiere servidor de webhooks en esta fase (se documenta como evolución futura para beneficios automáticos dentro de la intranet).

## Decisions

### 1. Componente React nativo vs. Script Flotante de Ko-fi
- **Decisión**: Crear un componente React dedicado (`KofiFooterDonation`) integrado en la estructura del footer en lugar de inyectar el script global de botón flotante de Ko-fi en `index.html`.
- **Razón**: Los widgets flotantes fijos en las esquinas inferiores colisionan con interfaces móviles, barras de herramientas y modales del portal. Un botón en el footer es discreto, respetuoso con la lectura del lore y 100% responsivo.
- **Alternativas consideradas**: Script oficial `<script src="...widget.js">` inyectado en `index.html`. Descartado por afectar la métrica de performance inicial y sobrecargar la vista móvil.

### 2. Apertura Híbrida (Modal Overlay / Enlace Directo Seguro)
- **Decisión**: Ofrecer interacción que permita abrir la página de donación en una pestaña externa segura (`rel="noreferrer"`) o mostrar un modal con la información de apoyo y monto sugerido ($50 MXN / $3 USD) para amortizar la cuota fija.
- **Razón**: Máxima compatibilidad contra extensiones de bloqueo de rastreo (AdBlockers / Brave Shields) que suelen romper iframes embebidos de pago.

### 3. Archivo `.github/FUNDING.yml`
- **Decisión**: Crear `.github/FUNDING.yml` conteniendo:
  ```yaml
  ko_fi: tu_usuario
  ```
- **Razón**: GitHub detecta automáticamente este archivo y habilita el botón "Sponsor" en la barra superior del repositorio sin costes adicionales.

## Risks / Trade-offs

- **[Riesgo de bloqueo de iframes por AdBlockers]** → **Mitigación**: El botón siempre incluye como alternativa un enlace directo a `https://ko-fi.com/<username>`.
- **[Comisiones elevadas en donaciones pequeñas en México]** → **Mitigación**: Indicar claramente en el texto descriptivo o tooltip una sugerencia de donación base ($50 MXN o $3 USD) y priorizar cuenta de Stripe en los ajustes de Ko-fi.
