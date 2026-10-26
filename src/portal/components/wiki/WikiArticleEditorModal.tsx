import { FC, useState, useRef } from 'react';
import { WikiContentRenderer } from './WikiContentRenderer';
import { WikiDataAccess } from '../../dataAccess/WikiDataAccess';
import './WikiArticleEditorModal.scss';

export interface WikiArticleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignID: string;
  articleSlug: string;
  initialContent: string;
  articleTitle: string;
  categories: string[];
  resolveSlug: (target: string) => string;
  onSaved: (newContent: string) => void;
}

export const WikiArticleEditorModal: FC<WikiArticleEditorModalProps> = ({
  isOpen,
  onClose,
  campaignID,
  articleSlug,
  initialContent,
  articleTitle,
  categories,
  resolveSlug,
  onSaved,
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [showPdfPrompt, setShowPdfPrompt] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string>('docs/expediente_temporal_bttf.pdf');
  const [pdfTitle, setPdfTitle] = useState<string>('Expediente Clasificado y Ficha de Personaje');
  const [pdfCaption, setPdfCaption] = useState<string>(
    'Documento oficial desclasificado para miembros de la campaña.',
  );
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  if (!isOpen) return null;

  const insertTextAtCursor = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}\n${prefix}${suffix}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || ''}${suffix}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  const handleInsertPdf = () => {
    if (!pdfUrl.trim()) return;
    const cleanUrl = pdfUrl.trim();
    const cleanTitle = pdfTitle.trim() || 'Documento PDF';
    const cleanCaption = pdfCaption.trim();

    const tag = cleanCaption
      ? `\n\n{{PDF|${cleanUrl}|${cleanTitle}|${cleanCaption}}}\n\n`
      : `\n\n{{PDF|${cleanUrl}|${cleanTitle}}}\n\n`;

    insertTextAtCursor(tag);
    setShowPdfPrompt(false);
    setFeedbackMsg('Widget de Lector PDF insertado en el editor.');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSave = () => {
    WikiDataAccess.SaveArticleContent(campaignID, articleSlug, content);
    onSaved(content);
    setFeedbackMsg('Cambios guardados con éxito.');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleReset = () => {
    if (window.confirm('¿Desea restaurar el contenido original del artículo descartando sus cambios?')) {
      WikiDataAccess.ResetArticleContent(campaignID, articleSlug);
      setContent(initialContent);
      onSaved(initialContent);
      setFeedbackMsg('Contenido original restaurado.');
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  return (
    <div className="wiki-editor-modal-backdrop" role="dialog" aria-modal="true">
      <div className="wiki-editor-modal-dialog">
        {/* Header */}
        <div className="wiki-editor-header">
          <div className="editor-header-title">
            <div className="editor-icon-badge">
              <i className="fas fa-edit" />
            </div>
            <div>
              <h4>Editor de Expediente: {articleTitle}</h4>
              <span className="editor-subtitle">
                Modifique el contenido de la Wiki e inserte lectores de PDF en tiempo real
              </span>
            </div>
          </div>

          <div className="editor-header-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              <i className="fas fa-code me-1" />
              Editor Markdown
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              <i className="fas fa-eye me-1" />
              Vista Previa
            </button>
            <button
              type="button"
              className="btn-close-modal"
              onClick={onClose}
              title="Cerrar editor"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        {activeTab === 'editor' && (
          <div className="wiki-editor-toolbar">
            <div className="toolbar-group">
              <button
                type="button"
                className="btn-toolbar-pdf"
                onClick={() => setShowPdfPrompt(!showPdfPrompt)}
                title="Insertar widget de lector PDF interactivo con visor Adobe Acrobat"
              >
                <i className="fas fa-file-pdf me-1" />
                <span>+ Insertar Lector PDF</span>
              </button>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
              <button
                type="button"
                className="tool-btn"
                onClick={() => insertTextAtCursor('== ', ' ==\n')}
                title="Encabezado H2"
              >
                <strong>H2</strong>
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => insertTextAtCursor('=== ', ' ===\n')}
                title="Subencabezado H3"
              >
                <strong>H3</strong>
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => insertTextAtCursor("'''", "'''")}
                title="Texto en Negrita"
              >
                <i className="fas fa-bold" />
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => insertTextAtCursor("''", "''")}
                title="Texto en Cursiva"
              >
                <i className="fas fa-italic" />
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => insertTextAtCursor('> ')}
                title="Cita en Bloque"
              >
                <i className="fas fa-quote-left" />
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => insertTextAtCursor('* ')}
                title="Lista de viñetas"
              >
                <i className="fas fa-list-ul" />
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => insertTextAtCursor('[[', ']]')}
                title="Enlace a otro artículo Wiki"
              >
                <i className="fas fa-link" />
              </button>
            </div>

            {feedbackMsg && (
              <div className="toolbar-feedback animate__animated animate__fadeIn">
                <i className="fas fa-check-circle me-1" />
                {feedbackMsg}
              </div>
            )}
          </div>
        )}

        {/* PDF Prompt Sub-panel */}
        {showPdfPrompt && activeTab === 'editor' && (
          <div className="pdf-insert-subpanel">
            <div className="subpanel-header">
              <div className="d-flex align-items-center gap-2">
                <i className="fas fa-file-pdf text-danger" />
                <h6 className="m-0 text-white fw-bold">Configuración del Documento PDF</h6>
              </div>
              <button
                type="button"
                className="btn-close-subpanel"
                onClick={() => setShowPdfPrompt(false)}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="subpanel-body">
              <div className="mb-2">
                <label className="form-label text-light small fw-bold">URL o Ruta del PDF:</label>
                <input
                  type="text"
                  className="form-control form-control-sm bg-dark text-white border-secondary"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="Ej: docs/expediente_temporal_bttf.pdf o https://..."
                />
              </div>

              <div className="mb-2">
                <label className="form-label text-light small fw-bold">Título del Documento:</label>
                <input
                  type="text"
                  className="form-control form-control-sm bg-dark text-white border-secondary"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="Título visible en el widget y en el menú Adobe"
                />
              </div>

              <div className="mb-2">
                <label className="form-label text-light small fw-bold">Epígrafe / Subtítulo:</label>
                <input
                  type="text"
                  className="form-control form-control-sm bg-dark text-white border-secondary"
                  value={pdfCaption}
                  onChange={(e) => setPdfCaption(e.target.value)}
                  placeholder="Descripción complementaria del PDF"
                />
              </div>

              <div className="preset-links-bar">
                <span className="preset-label">Preajustes Rápidos:</span>
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() => {
                    setPdfUrl('docs/expediente_temporal_bttf.pdf');
                    setPdfTitle('Expediente Clasificado: Lore Temporal BTTF');
                    setPdfCaption('Documento Oficial de la Base de Datos Wiki de Papustanes');
                  }}
                >
                  Expediente Local BTTF (.pdf)
                </button>
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() => {
                    setPdfUrl(
                      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                    );
                    setPdfTitle('Reglamento de Prueba Universal W3C');
                    setPdfCaption('Documento de prueba remoto');
                  }}
                >
                  Documento W3C (Remoto)
                </button>
              </div>

              <div className="mt-3 text-end">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary me-2"
                  onClick={() => setShowPdfPrompt(false)}
                >
                  Cancelar
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={handleInsertPdf}>
                  <i className="fas fa-plus me-1" />
                  Insertar en el Artículo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="wiki-editor-body">
          {activeTab === 'editor' ? (
            <textarea
              ref={textareaRef}
              className="wiki-editor-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escriba aquí el contenido del artículo en formato Wiki Markdown..."
              spellCheck={false}
            />
          ) : (
            <div className="wiki-editor-preview-pane">
              <WikiContentRenderer
                content={content}
                campaignID={campaignID}
                categories={categories}
                resolveSlug={resolveSlug}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="wiki-editor-footer">
          <div className="footer-left">
            <button
              type="button"
              className="btn btn-outline-warning btn-sm"
              onClick={handleReset}
              title="Restaurar el texto original de la base de datos"
            >
              <i className="fas fa-undo me-1" />
              Restaurar Original
            </button>
          </div>

          <div className="footer-right">
            <button type="button" className="btn btn-secondary btn-sm me-2" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-success btn-sm" onClick={handleSave}>
              <i className="fas fa-save me-1" />
              Guardar Cambios y Ver Lector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
