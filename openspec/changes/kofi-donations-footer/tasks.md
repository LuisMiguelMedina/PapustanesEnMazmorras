# Tasks

## 1. Configuración de Repositorio y Patrocinio

- [x] 1.1 Crear el archivo `.github/FUNDING.yml` con el identificador de Ko-fi (`ko_fi: tu_usuario`) y verificar sintaxis válida de patrocinio en GitHub.
- [x] 1.2 Documentar las recomendaciones de configuración fiscal y de comisiones para México (preferencia de Stripe sobre PayPal y monto base de $50 MXN / $3 USD) en la documentación del portal.

## 2. Componente de Donaciones Ko-fi en Frontend

- [x] 2.1 Crear el componente `src/portal/components/donations/KofiFooterDonation.tsx` con soporte para props configurables (`username`, `label`, `suggestedAmount`), botón con ícono temático y soporte para modal/enlace directo seguro.
- [x] 2.2 Diseñar los estilos en `src/portal/components/donations/KofiFooterDonation.scss` con la paleta estética medieval / sci-fi del portal y diseño responsivo para móviles.
- [x] 2.3 Integrar el componente `KofiFooterDonation` en el footer de `src/portal/layouts/SciFiLayout.tsx` (y opcionalmente en el footer de `src/portal/Layout.tsx`).

## 3. Verificación e Integración

- [x] 3.1 Verificar interacciones en pantalla: clic de donación, apertura de modal/enlace seguro (`target="_blank"` y `rel="noreferrer"`) y responsividad en dispositivos móviles.
- [x] 3.2 Ejecutar la comprobación de tipos TypeScript (`npx tsc --noEmit`) y el proceso de compilación (`npm run build`) para validar que no existan advertencias ni regresiones.

## Workflow follow-up

- Aplicar las tareas con `/opsx-apply`.
- Probar la integración en el despliegue de GitHub Pages.
- Archivar el cambio una vez validado.
