import { FC, useState } from 'react';
import { WikiDataAccess } from '../../dataAccess/WikiDataAccess';
import { WikiArticleBase } from '../../models/Wiki/WikiModels';
import { slugify } from './wikiHelpers';
import './WikiNewArticleModal.scss';

export interface WikiNewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignID: string;
  campaignTitle: string;
  existingCategories: string[];
  onCreated: (newArticleSlug: string) => void;
}

export const WikiNewArticleModal: FC<WikiNewArticleModalProps> = ({
  isOpen,
  onClose,
  campaignID,
  campaignTitle,
  existingCategories,
  onCreated,
}) => {
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [isSlugManual, setIsSlugManual] = useState<boolean>(false);
  const [category, setCategory] = useState<string>(existingCategories[0] || 'Categoría:Lore');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [template, setTemplate] = useState<'blank' | 'lore' | 'pdf' | 'character'>('lore');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugManual) {
      setSlug(slugify(val));
    }
  };

  const getTemplateContent = (artTitle: string, tmpl: string): string => {
    switch (tmpl) {
      case 'pdf':
        return `== ${artTitle} ==\n\nDocumento oficial y expediente clasificado emitido para la campaña.\n\n=== Expediente en Formato PDF ===\n\nConsulte el documento completo sin necesidad de descarga a través del lector interactivo a continuación:\n\n{{PDF|docs/expediente_temporal_bttf.pdf|${artTitle}|Documento oficial registrado en la base de datos central.}}\n\n=== Directrices de Uso ===\n\n* '''I.''' La información contenida en este documento es de carácter clasificado.\n* '''II.''' Puede abrir el lector en modo pantalla completa utilizando el visor estilo Adobe Acrobat.\n`;
      case 'character':
        return `== ${artTitle} ==\n\nBreve descripción del personaje, trasfondo y rol dentro de la campaña.\n\n=== Historia y Orígenes ===\n\nEscriba aquí la cronología del personaje, motivaciones y conexiones con el mundo.\n\n=== Habilidades y Rasgos Especiales ===\n\n* **Clase / Ocupación**: Desconocida\n* **Alineamiento**: Neutral\n* **Nivel de Amenaza**: Clase B\n\n> "Una cita memorable o lema característico de este personaje."\n`;
      case 'lore':
        return `== ${artTitle} ==\n\nIntroducción general al expediente, locación o acontecimiento histórico.\n\n=== Antecedentes Históricos ===\n\nDescriba aquí los eventos que dieron origen a esta crónica dentro del multiverso.\n\n=== Estado Actual ===\n\nDetalles sobre la situación geopolítica, facciones involucradas e impacto en la campaña.\n\n> [!NOTE]\n> Este expediente se encuentra disponible para consulta y edición de los oficiales de mesa.\n`;
      case 'blank':
      default:
        return `== ${artTitle} ==\n\nComience a redactar el expediente aquí...\n`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Debe ingresar un título para el artículo.');
      return;
    }

    const cleanSlug = slug.trim() || slugify(cleanTitle);
    if (!cleanSlug) {
      setErrorMsg('El identificador (slug) no es válido.');
      return;
    }

    // Check if slug already exists in this campaign
    const existing = WikiDataAccess.Find({ CampaignID: campaignID, ArticleSlug: cleanSlug });
    if (existing.CodeNumber === 302) {
      setErrorMsg(`Ya existe un artículo con el identificador '${cleanSlug}'. Elija otro.`);
      return;
    }

    const finalCategory = customCategory.trim()
      ? customCategory.startsWith('Categoría:')
        ? customCategory.trim()
        : `Categoría:${customCategory.trim()}`
      : category;

    const newArticle: WikiArticleBase = {
      ArticleID: `art_${campaignID}_${Date.now()}_${cleanSlug}`,
      CampaignID: campaignID,
      ArticleSlug: cleanSlug,
      ArticleTitle: cleanTitle,
      ArticleSubtitle: subtitle.trim() || null,
      ArticleCategories: [finalCategory],
      ArticleContent: getTemplateContent(cleanTitle, template),
      ArticleInfobox: {
        InfoboxType: 'GENERAL',
        Title: cleanTitle,
        ImageUrl: null,
        ImageCaption: subtitle.trim() || campaignTitle,
        Properties: [
          { Key: 'Campaña', Value: campaignTitle },
          { Key: 'Categoría', Value: finalCategory.replace(/^Categoría:\s*/i, '') },
          { Key: 'Estado', Value: 'Desclasificado' },
        ],
      },
      ArticleAliases: [cleanSlug, cleanTitle.toLowerCase()],
      ArticleRelatedSlugs: [],
      ArticleIsRedirect: false,
      ArticleRedirectTarget: null,
      LastModified: 'Reciente',
    };

    const createRes = WikiDataAccess.CreateArticle(newArticle);
    if (createRes.CodeNumber === 201 && createRes.Result) {
      onCreated(newArticle.ArticleSlug);
      onClose();
    } else {
      setErrorMsg(createRes.Message || 'No se pudo crear el artículo.');
    }
  };

  return (
    <div className="wiki-new-article-backdrop" role="dialog" aria-modal="true">
      <div className="wiki-new-article-dialog">
        <div className="new-article-header">
          <div className="d-flex align-items-center gap-2">
            <div className="header-icon-badge">
              <i className="fas fa-file-circle-plus" />
            </div>
            <div>
              <h5 className="m-0 text-white fw-bold">Nuevo Artículo de Lore</h5>
              <small className="text-muted">Wiki de: {campaignTitle}</small>
            </div>
          </div>
          <button type="button" className="btn-close-dialog" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="new-article-form">
          {errorMsg && (
            <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2">
              <i className="fas fa-exclamation-triangle" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label text-light small fw-bold">Título del Artículo:</label>
            <input
              type="text"
              className="form-control form-control-sm bg-dark text-white border-secondary"
              placeholder="Ej: Crónica de la Batalla de Shon-Xan"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="row g-2 mb-3">
            <div className="col-md-7">
              <label className="form-label text-light small fw-bold">Subtítulo / Epígrafe:</label>
              <input
                type="text"
                className="form-control form-control-sm bg-dark text-white border-secondary"
                placeholder="Ej: Registro militar y reporte de bajas"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
            <div className="col-md-5">
              <label className="form-label text-light small fw-bold">Identificador URL (Slug):</label>
              <input
                type="text"
                className="form-control form-control-sm bg-dark text-white border-secondary font-monospace"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setIsSlugManual(true);
                }}
                placeholder="cronica-de-shon-xan"
                required
              />
            </div>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <label className="form-label text-light small fw-bold">Categoría Existente:</label>
              <select
                className="form-select form-select-sm bg-dark text-white border-secondary"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCustomCategory('');
                }}
              >
                {existingCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label text-light small fw-bold">O Nueva Categoría:</label>
              <input
                type="text"
                className="form-control form-control-sm bg-dark text-white border-secondary"
                placeholder="Ej: Facciones, Criaturas..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label text-light small fw-bold">Plantilla Inicial:</label>
            <div className="template-cards-grid">
              <div
                className={`template-card ${template === 'lore' ? 'active' : ''}`}
                onClick={() => setTemplate('lore')}
              >
                <i className="fas fa-scroll" />
                <span className="tmpl-title">Crónica de Lore</span>
                <span className="tmpl-desc">Estructura clásica con antecedentes y secciones</span>
              </div>
              <div
                className={`template-card ${template === 'pdf' ? 'active' : ''}`}
                onClick={() => setTemplate('pdf')}
              >
                <i className="fas fa-file-pdf" />
                <span className="tmpl-title">Con Lector PDF</span>
                <span className="tmpl-desc">Incluye widget para visualizar PDF con visor Adobe</span>
              </div>
              <div
                className={`template-card ${template === 'character' ? 'active' : ''}`}
                onClick={() => setTemplate('character')}
              >
                <i className="fas fa-user-shield" />
                <span className="tmpl-title">Ficha de PNJ / PJ</span>
                <span className="tmpl-desc">Rasgos, trasfondo y ficha técnica</span>
              </div>
              <div
                className={`template-card ${template === 'blank' ? 'active' : ''}`}
                onClick={() => setTemplate('blank')}
              >
                <i className="fas fa-file" />
                <span className="tmpl-title">En Blanco</span>
                <span className="tmpl-desc">Documento vacío listo para redactar libremente</span>
              </div>
            </div>
          </div>

          <div className="new-article-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-info btn-sm fw-bold text-dark">
              <i className="fas fa-plus me-1" />
              Crear Artículo y Abrir Editor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
