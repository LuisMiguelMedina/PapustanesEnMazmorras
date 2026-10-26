import { FC, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './WikiPdfViewer.scss';

export interface WikiPdfViewerProps {
  url: string;
  title?: string;
  caption?: string;
  initialPage?: number;
}

/**
 * Resolves a PDF URL correctly for both local dev and GitHub Pages deployment.
 */
export function resolvePdfUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${cleanPath}`;
}

export const WikiPdfViewer: FC<WikiPdfViewerProps> = ({
  url,
  title = 'Documento PDF',
  caption,
  initialPage = 1,
}) => {
  const resolvedUrl = resolvePdfUrl(url);

  // Expanded Adobe Reader Modal State
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [page, setPage] = useState<number>(initialPage);
  const [totalPages] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 50, 75, 100, 125, 150, 200
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [fitMode, setFitMode] = useState<'custom' | 'width' | 'page'>('width');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showToolbarFloating, setShowToolbarFloating] = useState<boolean>(true);

  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // Compute clean display title
  const displayTitle = title || resolvedUrl.split('/').pop()?.replace(/\.pdf$/i, '') || 'Documento PDF';

  // Handle ESC and keyboard shortcuts when expanded, and lock body scroll
  useEffect(() => {
    if (!isExpanded) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          setIsExpanded(false);
        }
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((prev) => Math.min(prev + 25, 250));
        setFitMode('custom');
      } else if (e.key === '-') {
        setZoomLevel((prev) => Math.max(prev - 25, 50));
        setFitMode('custom');
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation((prev) => (prev + 90) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  // Handle zoom presets
  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    setFitMode('custom');
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 25, 250));
    setFitMode('custom');
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 25, 50));
    setFitMode('custom');
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFitWidth = () => {
    setFitMode('width');
    setZoomLevel(100);
  };

  const handleFitPage = () => {
    setFitMode('page');
    setZoomLevel(85);
  };

  const toggleFullscreen = useCallback(async () => {
    if (!modalContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await modalContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen]);

  const handlePrint = () => {
    const printWindow = window.open(resolvedUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  // Build iframe src URL with PDF open parameters
  const iframeSrc = useMemo(() => {
    return `${resolvedUrl}#page=${page}&toolbar=0&navpanes=0&view=${fitMode === 'width' ? 'FitH' : 'Fit'}`;
  }, [resolvedUrl, page, fitMode]);

  return (
    <div className="wiki-pdf-component-wrapper" data-widget="wiki-pdf-reader">
      {/* 1. INLINE ARTICLE READER WIDGET */}
      <div className="wiki-pdf-card">
        {/* Card Header */}
        <div className="wiki-pdf-card-header">
          <div className="pdf-header-info">
            <div className="adobe-badge-square" title="Documento PDF">
              <i className="fas fa-file-pdf" />
            </div>
            <div className="pdf-header-meta">
              <h5 className="pdf-doc-title" title={displayTitle}>
                {displayTitle}
              </h5>
              <div className="pdf-doc-submeta">
                <span className="badge-tag">Documento Clasificado</span>
              </div>
            </div>
          </div>

          <div className="pdf-header-actions">
            <button
              type="button"
              className="btn-adobe-primary"
              onClick={() => setIsExpanded(true)}
              title="Abrir en pantalla grande"
            >
              <i className="fas fa-expand me-1" />
              <span>Abrir en Grande</span>
            </button>
            <a
              href={resolvedUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn-adobe-secondary"
              title="Descargar archivo PDF"
            >
              <i className="fas fa-download" />
            </a>
          </div>
        </div>

        {/* Card Inline Preview Canvas */}
        <div className="wiki-pdf-preview-box">
          <iframe
            src={`${resolvedUrl}#toolbar=0&navpanes=0&view=FitH`}
            title={`Vista previa de ${displayTitle}`}
            className="wiki-pdf-inline-iframe"
          />
          {/* Transparent click overlay to easily open modal */}
          <div
            className="wiki-pdf-preview-overlay"
            onClick={() => setIsExpanded(true)}
            role="button"
            tabIndex={0}
            title="Haga clic para abrir en el visor grande"
          >
            <div className="overlay-pill">
              <i className="fas fa-search-plus me-2" />
              <span>Clic para abrir en visor grande</span>
            </div>
          </div>
        </div>

        {/* Card Caption / Footer */}
        {caption && <div className="wiki-pdf-card-caption">{caption}</div>}
      </div>

      {/* 2. EXPANDED / FULLSCREEN ADOBE ACROBAT READER MODAL */}
      {isExpanded && (
        <div
          ref={modalContainerRef}
          className={`adobe-reader-modal-backdrop ${isFullscreen ? 'is-fullscreen' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={`Visor de PDF: ${displayTitle}`}
        >
          {/* Reader Toolbar */}
          <header className="adobe-reader-toolbar">
            {/* Left: Brand & Title */}
            <div className="toolbar-section toolbar-left">
              <div className="adobe-logo-tag" title="Visor de PDF">
                <i className="fas fa-file-pdf" />
                <span>Lector PDF</span>
              </div>
              <div className="toolbar-doc-info" title={displayTitle}>
                <span className="toolbar-doc-title">{displayTitle}</span>
                <span className="toolbar-file-ext">.pdf</span>
              </div>
            </div>

            {/* Center: Acrobat Navigation & Zoom Tools */}
            <div className="toolbar-section toolbar-center">
              {/* Page Controls */}
              <div className="tool-group page-controls">
                <button
                  type="button"
                  className="adobe-tool-btn"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  title="Página anterior"
                >
                  <i className="fas fa-chevron-up" />
                </button>
                <div className="adobe-page-indicator">
                  <span className="page-label">Página</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={page}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1) setPage(val);
                    }}
                    className="adobe-page-input"
                    title="Número de página"
                  />
                  <span className="page-total">/ {totalPages}</span>
                </div>
                <button
                  type="button"
                  className="adobe-tool-btn"
                  onClick={() => setPage((p) => p + 1)}
                  title="Página siguiente"
                >
                  <i className="fas fa-chevron-down" />
                </button>
              </div>

              <div className="adobe-tool-divider" />

              {/* Zoom Controls */}
              <div className="tool-group zoom-controls">
                <button
                  type="button"
                  className="adobe-tool-btn"
                  onClick={handleZoomOut}
                  title="Reducir zoom (-)"
                >
                  <i className="fas fa-search-minus" />
                </button>

                <div className="adobe-zoom-select-wrapper">
                  <select
                    className="adobe-zoom-select"
                    value={fitMode === 'custom' ? zoomLevel : fitMode}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'width') handleFitWidth();
                      else if (val === 'page') handleFitPage();
                      else handleZoomChange(parseInt(val, 10));
                    }}
                    title="Nivel de zoom"
                  >
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                    <option value="125">125%</option>
                    <option value="150">150%</option>
                    <option value="200">200%</option>
                    <option value="width">Ajustar ancho</option>
                    <option value="page">Ajustar página</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="adobe-tool-btn"
                  onClick={handleZoomIn}
                  title="Aumentar zoom (+)"
                >
                  <i className="fas fa-search-plus" />
                </button>
              </div>

              <div className="adobe-tool-divider" />

              {/* View Tools: Rotate & Fit */}
              <div className="tool-group view-tools">
                <button
                  type="button"
                  className="adobe-tool-btn"
                  onClick={handleRotate}
                  title="Girar 90° hacia la derecha (R)"
                >
                  <i className="fas fa-redo-alt" />
                  {rotation !== 0 && <span className="rotation-badge">{rotation}°</span>}
                </button>
                <button
                  type="button"
                  className={`adobe-tool-btn ${fitMode === 'width' ? 'active' : ''}`}
                  onClick={handleFitWidth}
                  title="Ajustar al ancho de ventana"
                >
                  <i className="fas fa-arrows-alt-h" />
                </button>
                <button
                  type="button"
                  className={`adobe-tool-btn ${fitMode === 'page' ? 'active' : ''}`}
                  onClick={handleFitPage}
                  title="Ajustar a una página completa"
                >
                  <i className="fas fa-arrows-alt-v" />
                </button>
              </div>
            </div>

            {/* Right: File Actions & Close */}
            <div className="toolbar-section toolbar-right">
              <button
                type="button"
                className="adobe-tool-btn"
                onClick={handlePrint}
                title="Imprimir documento (Ctrl+P)"
              >
                <i className="fas fa-print" />
              </button>

              <a
                href={resolvedUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="adobe-tool-btn"
                title="Descargar archivo PDF"
              >
                <i className="fas fa-download" />
              </a>

              <button
                type="button"
                className="adobe-tool-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} />
              </button>

              <button
                type="button"
                className={`adobe-tool-btn ${showToolbarFloating ? 'active' : ''}`}
                onClick={() => setShowToolbarFloating(!showToolbarFloating)}
                title="Mostrar u ocultar barra rápida flotante"
              >
                <i className="fas fa-sliders-h" />
              </button>

              <div className="adobe-tool-divider" />

              <button
                type="button"
                className="adobe-tool-btn btn-close-adobe"
                onClick={() => setIsExpanded(false)}
                title="Cerrar visor PDF (Esc)"
              >
                <i className="fas fa-times" />
              </button>
            </div>
          </header>

          {/* Main Viewer Canvas */}
          <div className="adobe-reader-canvas">
            <div
              className={`adobe-document-sheet ${
                fitMode === 'width' ? 'fit-width' : fitMode === 'page' ? 'fit-page' : 'fit-custom'
              }`}
              style={{
                ...(rotation !== 0 ? { transform: `rotate(${rotation}deg)` } : {}),
                ...(fitMode === 'custom' ? { maxWidth: `${Math.round(8.6 * zoomLevel)}px` } : {}),
              }}
            >
              <iframe
                src={iframeSrc}
                className="adobe-pdf-iframe"
                title={displayTitle}
              />
            </div>
          </div>

          {/* Floating Acrobat HUD / Quick Bar (Bottom) */}
          {showToolbarFloating && (
            <div className="adobe-floating-hud" aria-label="Controles rápidos">
              <button
                type="button"
                className="hud-btn"
                onClick={handleZoomOut}
                title="Reducir"
              >
                <i className="fas fa-minus" />
              </button>
              <span className="hud-label">{zoomLevel}%</span>
              <button
                type="button"
                className="hud-btn"
                onClick={handleZoomIn}
                title="Aumentar"
              >
                <i className="fas fa-plus" />
              </button>
              <span className="hud-sep">|</span>
              <button
                type="button"
                className="hud-btn"
                onClick={handleRotate}
                title="Girar 90°"
              >
                <i className="fas fa-redo-alt" />
              </button>
              <button
                type="button"
                className="hud-btn"
                onClick={handleFitWidth}
                title="Ajustar ancho"
              >
                <i className="fas fa-arrows-alt-h" />
              </button>
              <button
                type="button"
                className="hud-btn"
                onClick={toggleFullscreen}
                title="Pantalla completa"
              >
                <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
