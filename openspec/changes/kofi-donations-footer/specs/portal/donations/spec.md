# Spec Delta

## Purpose

Permite a los usuarios y seguidores apoyar financieramente el proyecto mediante un widget de donaciones Ko-fi en el pie de página y metadatos de financiamiento en el repositorio.

## ADDED Requirements

### Requirement: Footer Ko-fi donation trigger
The system SHALL display a clear and styled Ko-fi donation call-to-action button within the global application footer.

#### Scenario: Visualización del botón en el footer
- **WHEN** un usuario navega a cualquier página pública dentro del portal
- **THEN** el pie de página muestra el elemento interactivo de donación de Ko-fi con su emblema y texto descriptivo de apoyo

#### Scenario: Interacción con el botón de donación
- **WHEN** el usuario hace clic en el botón de donación de Ko-fi
- **THEN** el sistema abre el diálogo modal de pago de Ko-fi o redirige de forma segura a la página de creador en una nueva pestaña

### Requirement: Modal de pago integrado no intrusivo
The system SHALL allow user interaction with the Ko-fi contribution modal without resetting or losing the active navigation context.

#### Scenario: Apertura del modal de donación
- **WHEN** el usuario activa la opción de donar mediante el widget embebido
- **THEN** se despliega el contenedor de pago de Ko-fi centrado con overlay oscuro de fondo y opción de cierre accesible

#### Scenario: Cierre del modal de donación
- **WHEN** el usuario hace clic fuera del modal o en el botón de cierre
- **THEN** el modal se oculta y la vista previa del portal permanece intacta

### Requirement: Configuración de patrocinio en el repositorio
The repository SHALL include community funding configuration for GitHub Sponsors via the standard funding metadata file.

#### Scenario: Detección de patrocinio en GitHub
- **WHEN** un visitante accede al repositorio en GitHub
- **THEN** GitHub detecta el archivo `.github/FUNDING.yml` y muestra el botón "Sponsor" enlazado a Ko-fi
