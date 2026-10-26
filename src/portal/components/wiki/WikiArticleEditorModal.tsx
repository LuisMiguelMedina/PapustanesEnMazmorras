import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { WikiContentRenderer } from './WikiContentRenderer';
import { WikiDataAccess } from '../../dataAccess/WikiDataAccess';
import { markdownToVisualHtml, visualHtmlToMarkdown } from './wikiEditorConverter';
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
  // Mode: 'visual' (Edición básica de texto - DEFAULT per requirement) | 'markdown' (Código fuente)
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');
  // View tab: 'editor' | 'preview'
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Internal markdown state
  const [markdownContent, setMarkdownContent] = useState<string>(initialContent);

  // PDF Insert Sub-panel state
  const [showPdfPrompt, setShowPdfPrompt] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string>('docs/expediente_temporal_bttf.pdf');
  const [pdfTitle, setPdfTitle] = useState<string>('Manual de Reglas y Ficha de Personaje');
  const [pdfCaption, setPdfCaption] = useState<string>('Documento clasificado para miembros de la campaña.');

  // Wiki Link Insert Sub-panel state
  const [showLinkPrompt, setShowLinkPrompt] = useState<boolean>(false);
  const [linkTarget, setLinkTarget] = useState<string>('');
  const [linkLabel, setLinkLabel] = useState<string>('');

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const visualEditorRef = useRef<HTMLDivElement | null>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Initialize visual editor content on open
  useEffect(() => {
    if (isOpen) {
      setMarkdownContent(initialContent);
      setEditorMode('visual');
      setActiveTab('editor');
      setTimeout(() => {
        if (visualEditorRef.current) {
          visualEditorRef.current.innerHTML = markdownToVisualHtml(initialContent);
        }
      }, 50);
    }
  }, [isOpen, initialContent]);

  // Synchronize from Visual to Markdown
  const syncVisualToMarkdown = useCallback((): string => {
    if (visualEditorRef.current) {
      const html = visualEditorRef.current.innerHTML;
      const md = visualHtmlToMarkdown(html);
      setMarkdownContent(md);
      return md;
    }
    return markdownContent;
  }, [markdownContent]);

  // Synchronize from Markdown to Visual
  const syncMarkdownToVisual = useCallback((md: string) => {
    if (visualEditorRef.current) {
      visualEditorRef.current.innerHTML = markdownToVisualHtml(md);
    }
  }, []);

  // Switch between Visual mode (Edición Básica) and Markdown mode
  const handleSwitchMode = (targetMode: 'visual' | 'markdown') => {
    if (targetMode === editorMode) return;

    if (targetMode === 'markdown') {
      const currentMd = syncVisualToMarkdown();
      setMarkdownContent(currentMd);
      setEditorMode('markdown');
    } else {
      syncMarkdownToVisual(markdownContent);
      setEditorMode('visual');
    }
  };

  // Visual formatting commands
  const applyVisualCommand = (command: string, value: string | undefined = undefined) => {
    if (editorMode !== 'visual') return;
    visualEditorRef.current?.focus();
    document.execCommand(command, false, value);
    syncVisualToMarkdown();
  };

  const applyFormatBlock = (tag: string) => {
    if (editorMode !== 'visual') return;
    visualEditorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    syncVisualToMarkdown();
  };

  // Insert Table in Visual Mode
  const handleInsertTable = () => {
    if (editorMode === 'visual') {
      const tableHtml = `
        <table class="visual-editor-table">
          <thead>
            <tr>
              <th>Columna 1</th>
              <th>Columna 2</th>
              <th>Columna 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dato 1</td>
              <td>Dato 2</td>
              <td>Dato 3</td>
            </tr>
            <tr>
              <td>Dato 4</td>
              <td>Dato 5</td>
              <td>Dato 6</td>
            </tr>
          </tbody>
        </table>
        <p><br></p>
      `;
      visualEditorRef.current?.focus();
      document.execCommand('insertHTML', false, tableHtml);
      syncVisualToMarkdown();
    } else {
      const mdTable = '\n\n| Columna 1 | Columna 2 | Columna 3 |\n|---|---|---|\n| Dato 1 | Dato 2 | Dato 3 |\n| Dato 4 | Dato 5 | Dato 6 |\n\n';
      insertTextInMarkdown(mdTable);
    }
    setFeedbackMsg('Tabla insertada correctamente.');
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  // Insert PDF reader in active mode
  const handleInsertPdf = () => {
    if (!pdfUrl.trim()) return;
    const cleanUrl = pdfUrl.trim();
    const cleanTitle = pdfTitle.trim() || 'Documento PDF';
    const cleanCaption = pdfCaption.trim();

    if (editorMode === 'visual') {
      const blockHtml = `
        <div class="visual-pdf-block" data-pdf-url="${cleanUrl}" data-pdf-title="${cleanTitle}" data-pdf-caption="${cleanCaption}" contenteditable="false">
          <div class="visual-pdf-header">
            <span class="visual-adobe-badge"><i class="fas fa-file-pdf"></i></span>
            <div class="visual-pdf-info">
              <strong>${cleanTitle}</strong>
              <small>${cleanUrl}</small>
            </div>
            <span class="visual-pdf-action-pill"><i class="fas fa-expand me-1"></i> Lector Interactivo</span>
          </div>
          ${cleanCaption ? `<div class="visual-pdf-caption">${cleanCaption}</div>` : ''}
        </div>
        <p><br></p>
      `;
      visualEditorRef.current?.focus();
      document.execCommand('insertHTML', false, blockHtml);
      syncVisualToMarkdown();
    } else {
      const tag = cleanCaption
        ? `\n\n{{PDF|${cleanUrl}|${cleanTitle}|${cleanCaption}}}\n\n`
        : `\n\n{{PDF|${cleanUrl}|${cleanTitle}}}\n\n`;
      insertTextInMarkdown(tag);
    }

    setShowPdfPrompt(false);
    setFeedbackMsg('Widget de Lector PDF insertado.');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Insert Wiki Link
  const handleInsertWikiLink = () => {
    if (!linkTarget.trim()) return;
    const target = linkTarget.trim();
    const label = linkLabel.trim() || target;

    if (editorMode === 'visual') {
      const linkHtml = `<a class="visual-wiki-link" data-wiki-target="${target}" href="#wiki-${target}">${label}</a>&nbsp;`;
      visualEditorRef.current?.focus();
      document.execCommand('insertHTML', false, linkHtml);
      syncVisualToMarkdown();
    } else {
      const tag = target === label ? `[[${target}]]` : `[[${target}|${label}]]`;
      insertTextInMarkdown(tag);
    }

    setShowLinkPrompt(false);
    setLinkTarget('');
    setLinkLabel('');
    setFeedbackMsg('Enlace wiki insertado.');
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  // Helper for Markdown textarea cursor insertion
  const insertTextInMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = markdownTextareaRef.current;
    if (!textarea) {
      setMarkdownContent((prev) => `${prev}\n${prefix}${suffix}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdownContent.substring(start, end);
    const replacement = `${prefix}${selected || ''}${suffix}`;
    const newContent =
      markdownContent.substring(0, start) + replacement + markdownContent.substring(end);
    setMarkdownContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  // Save handler
  const handleSave = () => {
    const finalMd = editorMode === 'visual' ? syncVisualToMarkdown() : markdownContent;
    WikiDataAccess.SaveArticleContent(campaignID, articleSlug, finalMd);
    onSaved(finalMd);
    setFeedbackMsg('Cambios guardados en la Wiki.');
    setTimeout(() => {
      onClose();
    }, 500);
  };

  // Reset handler
  const handleReset = () => {
    if (window.confirm('¿Desea restaurar el contenido original de este artículo?')) {
      WikiDataAccess.ResetArticleContent(campaignID, articleSlug);
      setMarkdownContent(initialContent);
      if (editorMode === 'visual' && visualEditorRef.current) {
        visualEditorRef.current.innerHTML = markdownToVisualHtml(initialContent);
      }
      onSaved(initialContent);
      setFeedbackMsg('Contenido original restaurado.');
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wiki-editor-modal-backdrop" role="dialog" aria-modal="true">
      <div className="wiki-editor-modal-dialog">
        {/* Header */}
        <div className="wiki-editor-header">
          <div className="editor-header-title">
            <div className="editor-icon-badge">
              <i className="fas fa-feather-pointed" />
            </div>
            <div>
              <h4>Expediente: {articleTitle}</h4>
              <span className="editor-subtitle">
                Diseñe su artículo con <strong>Edición Básica (Visual)</strong> o <strong>Código Markdown</strong>
              </span>
            </div>
          </div>

          <div className="editor-header-controls">
            {/* Mode Switcher: Visual (Default) vs Markdown */}
            <div className="editor-mode-toggle" title="Cambiar modo de edición al estilo Wikifandom">
              <button
                type="button"
                className={`mode-btn ${editorMode === 'visual' && activeTab === 'editor' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('editor');
                  handleSwitchMode('visual');
                }}
              >
                <i className="fas fa-pen-nib me-1" />
                <span>Edición Básica (Visual)</span>
                <span className="badge-default">Default</span>
              </button>
              <button
                type="button"
                className={`mode-btn ${editorMode === 'markdown' && activeTab === 'editor' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('editor');
                  handleSwitchMode('markdown');
                }}
              >
                <i className="fas fa-code me-1" />
                <span>Modo Markdown</span>
              </button>
            </div>

            {/* Preview Tab */}
            <button
              type="button"
              className={`preview-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => {
                if (editorMode === 'visual') syncVisualToMarkdown();
                setActiveTab(activeTab === 'preview' ? 'editor' : 'preview');
              }}
            >
              <i className={`fas ${activeTab === 'preview' ? 'fa-edit' : 'fa-eye'} me-1`} />
              <span>{activeTab === 'preview' ? 'Volver al Editor' : 'Vista Previa'}</span>
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
            {/* 1. Visual Mode Toolbar */}
            {editorMode === 'visual' ? (
              <>
                {/* Paragraph / Heading Format Dropdown */}
                <div className="toolbar-group">
                  <select
                    className="toolbar-select-format"
                    defaultValue="p"
                    onChange={(e) => {
                      applyFormatBlock(e.target.value);
                      e.target.value = 'p';
                    }}
                    title="Estilo de párrafo o encabezado"
                  >
                    <option value="p">Párrafo normal</option>
                    <option value="h2">Encabezado H2 (== Título ==)</option>
                    <option value="h3">Subencabezado H3 (=== Sección ===)</option>
                    <option value="h4">Encabezado H4 (==== Subsección ====)</option>
                    <option value="blockquote">Cita en Bloque (&gt; Cita)</option>
                  </select>
                </div>

                <div className="toolbar-separator" />

                {/* Inline Formatting */}
                <div className="toolbar-group">
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => applyVisualCommand('bold')}
                    title="Negrita (Ctrl+B)"
                  >
                    <i className="fas fa-bold" />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => applyVisualCommand('italic')}
                    title="Cursiva (Ctrl+I)"
                  >
                    <i className="fas fa-italic" />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => applyVisualCommand('strikeThrough')}
                    title="Tachado"
                  >
                    <i className="fas fa-strikethrough" />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => applyVisualCommand('removeFormat')}
                    title="Limpiar Formato"
                  >
                    <i className="fas fa-eraser" />
                  </button>
                </div>

                <div className="toolbar-separator" />

                {/* Lists */}
                <div className="toolbar-group">
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => applyVisualCommand('insertUnorderedList')}
                    title="Lista con viñetas"
                  >
                    <i className="fas fa-list-ul" />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => applyVisualCommand('insertOrderedList')}
                    title="Lista numerada"
                  >
                    <i className="fas fa-list-ol" />
                  </button>
                </div>

                <div className="toolbar-separator" />

                {/* Insert Elements */}
                <div className="toolbar-group">
                  <button
                    type="button"
                    className="tool-btn-action btn-pdf"
                    onClick={() => setShowPdfPrompt(!showPdfPrompt)}
                    title="Insertar lector interactivo de PDF"
                  >
                    <i className="fas fa-file-pdf me-1" />
                    <span>+ Lector PDF</span>
                  </button>
                  <button
                    type="button"
                    className="tool-btn-action"
                    onClick={() => setShowLinkPrompt(!showLinkPrompt)}
                    title="Insertar enlace a otro artículo de la Wiki"
                  >
                    <i className="fas fa-link me-1" />
                    <span>+ Enlace Wiki</span>
                  </button>
                  <button
                    type="button"
                    className="tool-btn-action"
                    onClick={handleInsertTable}
                    title="Insertar tabla"
                  >
                    <i className="fas fa-table me-1" />
                    <span>+ Tabla</span>
                  </button>
                </div>
              </>
            ) : (
              /* 2. Markdown Mode Toolbar */
              <>
                <div className="toolbar-group">
                  <button
                    type="button"
                    className="tool-btn-action btn-pdf"
                    onClick={() => setShowPdfPrompt(!showPdfPrompt)}
                    title="Insertar directiva de Lector PDF: {{PDF|url|titulo}}"
                  >
                    <i className="fas fa-file-pdf me-1" />
                    <span>+ Insertar Lector PDF</span>
                  </button>
                  <button
                    type="button"
                    className="tool-btn-action"
                    onClick={() => setShowLinkPrompt(!showLinkPrompt)}
                    title="Insertar enlace wiki: [[Artículo|Texto]]"
                  >
                    <i className="fas fa-link me-1" />
                    <span>+ Enlace Wiki</span>
                  </button>
                </div>

                <div className="toolbar-separator" />

                <div className="toolbar-group">
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => insertTextInMarkdown('== ', ' ==\n')}
                    title="Encabezado H2"
                  >
                    <strong>H2</strong>
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => insertTextInMarkdown('=== ', ' ===\n')}
                    title="Subencabezado H3"
                  >
                    <strong>H3</strong>
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => insertTextInMarkdown("'''", "'''")}
                    title="Negrita"
                  >
                    <i className="fas fa-bold" />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => insertTextInMarkdown("''", "''")}
                    title="Cursiva"
                  >
                    <i className="fas fa-italic" />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => insertTextInMarkdown('> ')}
                    title="Cita en bloque"
                  >
                    <i className="fas fa-quote-left" />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => insertTextInMarkdown('* ')}
                    title="Lista con viñetas"
                  >
                    <i className="fas fa-list-ul" />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={handleInsertTable}
                    title="Insertar tabla Markdown"
                  >
                    <i className="fas fa-table" />
                  </button>
                </div>
              </>
            )}

            {feedbackMsg && (
              <div className="toolbar-feedback animate__animated animate__fadeIn">
                <i className="fas fa-check-circle me-1" />
                {feedbackMsg}
              </div>
            )}
          </div>
        )}

        {/* Sub-panel: Insert PDF */}
        {showPdfPrompt && activeTab === 'editor' && (
          <div className="pdf-insert-subpanel animate__animated animate__fadeIn">
            <div className="subpanel-header">
              <div className="d-flex align-items-center gap-2">
                <div className="adobe-badge-mini">
                  <i className="fas fa-file-pdf" />
                </div>
                <h6 className="m-0 text-white fw-bold">Configuración de Lector PDF Interactivo</h6>
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
              <div className="row g-2 mb-2">
                <div className="col-md-7">
                  <label className="form-label text-light small fw-bold">Ruta o URL del PDF:</label>
                  <input
                    type="text"
                    className="form-control form-control-sm bg-dark text-white border-secondary"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    placeholder="docs/expediente_temporal_bttf.pdf o https://..."
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label text-light small fw-bold">Título del Documento:</label>
                  <input
                    type="text"
                    className="form-control form-control-sm bg-dark text-white border-secondary"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    placeholder="Ej: Reglamento Oficial"
                  />
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label text-light small fw-bold">Epígrafe / Subtítulo (Opcional):</label>
                <input
                  type="text"
                  className="form-control form-control-sm bg-dark text-white border-secondary"
                  value={pdfCaption}
                  onChange={(e) => setPdfCaption(e.target.value)}
                  placeholder="Descripción al pie del widget lector"
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
                    setPdfUrl('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
                    setPdfTitle('Reglamento de Prueba Universal W3C');
                    setPdfCaption('Documento de prueba remoto');
                  }}
                >
                  Documento W3C (Online)
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
                <button type="button" className="btn btn-sm btn-danger fw-bold" onClick={handleInsertPdf}>
                  <i className="fas fa-plus me-1" />
                  Insertar Lector en el Artículo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sub-panel: Insert Wiki Link */}
        {showLinkPrompt && activeTab === 'editor' && (
          <div className="wiki-link-subpanel animate__animated animate__fadeIn">
            <div className="subpanel-header">
              <div className="d-flex align-items-center gap-2">
                <i className="fas fa-link text-info" />
                <h6 className="m-0 text-white fw-bold">Insertar Enlace de Wiki Interno</h6>
              </div>
              <button
                type="button"
                className="btn-close-subpanel"
                onClick={() => setShowLinkPrompt(false)}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="subpanel-body">
              <div className="row g-2 mb-2">
                <div className="col-md-6">
                  <label className="form-label text-light small fw-bold">Artículo de Destino (Título o Slug):</label>
                  <input
                    type="text"
                    className="form-control form-control-sm bg-dark text-white border-secondary"
                    value={linkTarget}
                    onChange={(e) => setLinkTarget(e.target.value)}
                    placeholder="Ej: Volkxus o back-to-the-future-past-and-future"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-light small fw-bold">Texto Visible (Opcional):</label>
                  <input
                    type="text"
                    className="form-control form-control-sm bg-dark text-white border-secondary"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Dejar vacío para usar el título de destino"
                  />
                </div>
              </div>

              <div className="mt-2 text-end">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary me-2"
                  onClick={() => setShowLinkPrompt(false)}
                >
                  Cancelar
                </button>
                <button type="button" className="btn btn-sm btn-info text-dark fw-bold" onClick={handleInsertWikiLink}>
                  <i className="fas fa-link me-1" />
                  Insertar Enlace
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor Body */}
        <div className="wiki-editor-body">
          {activeTab === 'editor' ? (
            editorMode === 'visual' ? (
              /* Visual Rich Text Editor (DEFAULT - Wikifandom style) */
              <div
                ref={visualEditorRef}
                className="visual-editor-canvas"
                contentEditable
                suppressContentEditableWarning
                onBlur={syncVisualToMarkdown}
                data-placeholder="Comience a escribir su artículo en formato visual aquí..."
                spellCheck={false}
              />
            ) : (
              /* Markdown Source Code Editor */
              <textarea
                ref={markdownTextareaRef}
                className="wiki-editor-textarea"
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                placeholder="Escriba aquí el contenido del artículo en formato Markdown..."
                spellCheck={false}
              />
            )
          ) : (
            /* Live Preview Pane */
            <div className="wiki-editor-preview-pane">
              <div className="preview-watermark">
                <i className="fas fa-eye me-1" />
                <span>Vista Previa del Expediente (Renderizado Final)</span>
              </div>
              <WikiContentRenderer
                content={editorMode === 'visual' ? syncVisualToMarkdown() : markdownContent}
                campaignID={campaignID}
                categories={categories}
                resolveSlug={resolveSlug}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wiki-editor-footer">
          <div className="footer-left">
            <span className="editor-status-pill">
              <i className="fas fa-circle-check text-success me-1" />
              Modo Activo: {editorMode === 'visual' ? 'Edición Básica (Visual)' : 'Código Markdown'}
            </span>
            <button
              type="button"
              className="btn btn-outline-warning btn-sm ms-2"
              onClick={handleReset}
              title="Restaurar el contenido original de la base de datos"
            >
              <i className="fas fa-undo me-1" />
              Restaurar Original
            </button>
          </div>

          <div className="footer-right">
            <button type="button" className="btn btn-secondary btn-sm me-2" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-success btn-sm fw-bold" onClick={handleSave}>
              <i className="fas fa-save me-1" />
              Guardar Expediente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
