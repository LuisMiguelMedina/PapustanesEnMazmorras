# Guía de Configuración de Donaciones Ko-fi (Optimización para México)

Esta guía documenta los pasos necesarios para configurar y mantener el canal de donaciones Ko-fi en el portal *Papustanes en Mazmorras*, maximizando el ingreso neto y minimizando las comisiones bancarias.

---

## 1. Conexión de Pasarelas: Stripe vs. PayPal en México

Ko-fi permite conectar **Stripe** y **PayPal**, pero para creadores en México se debe **priorizar Stripe**:

- **Problema con PayPal en México**:
  - Si un usuario dona en dólares ($USD) o euros (€EUR), PayPal transfiere automáticamente el saldo a tu cuenta bancaria mexicana todas las noches.
  - Al hacer esta transferencia automática, PayPal aplica su propio tipo de cambio interbancario desfavorable, descontando entre un **3.5% y 4.0% adicional** por debajo del valor oficial de la divisa, sumado a la comisión fija por transacción.
- **Ventaja de Stripe**:
  - La conversión de divisas es transparente y oficial.
  - Permite a los donantes pagar al instante mediante **Apple Pay**, **Google Pay** o tarjeta de débito/crédito directa sin obligarlos a registrarse o iniciar sesión en una cuenta de PayPal.

> **Acción requerida en Ko-fi**: Ir a *Settings > Payment* y conectar tu cuenta de **Stripe** como procesador principal.

---

## 2. Ajuste del Monto Mínimo por "Café"

El factor que más reduce los ingresos en micro-donaciones no es la tasa porcentual (~3.6%), sino la **cuota fija por operación** ($3.00 MXN en Stripe o $4.00 MXN en PayPal):

- Si el valor unitario se deja en $20–$30 MXN, la cuota fija absorbe entre el 10% y el 15% del total.
- **Configuración recomendada**:
  - En *Settings > Payment*, fijar la moneda base en **MXN** y establecer el precio por unidad en **$50.00 MXN** o **$60.00 MXN** (o **$3.00 – $5.00 USD** si se elige moneda extranjera).
  - De esta manera, la cuota fija de $3.00 MXN representa menos del 6% del importe donado.

---

## 3. Identificador de Usuario y Botón en GitHub

- **Usuario en la Aplicación**:
  - El componente de footer `KofiFooterDonation` acepta la prop `username` (por defecto `papustanes`). Puedes personalizarlo en `src/portal/layouts/SciFiLayout.tsx`.
- **Botón "Sponsor" en GitHub**:
  - El repositorio cuenta con el archivo [`.github/FUNDING.yml`](file:///.github/FUNDING.yml) con la clave:
    ```yaml
    ko_fi: papustanes
    ```
  - Al publicar este archivo en la rama principal, GitHub muestra de inmediato el botón de corazón **Sponsor** en la cabecera del repositorio.

---

## 4. Automatización Futura (Webhooks)

Ko-fi ofrece la pestaña *API / Webhooks* en su panel de control:
- Cada vez que se recibe una donación, Ko-fi envía una petición `POST` en formato JSON con:
  - `supporter_name`: Nombre o apodo del mecenas.
  - `amount`: Monto aportado.
  - `currency`: Moneda utilizada.
  - `message`: Mensaje opcional adjunto a la donación.
  - `verification_token`: Token para validar autenticidad.
- Puede utilizarse en el futuro para acreditar rangos automáticos dentro del portal ZRK o publicar agradecimientos en el muro de anuncios.
