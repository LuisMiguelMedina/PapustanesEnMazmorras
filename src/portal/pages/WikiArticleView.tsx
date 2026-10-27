import { FC, useState, useMemo, useEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { WikiContentRenderer } from '../components/wiki/WikiContentRenderer';
import { WikiInfobox } from '../components/wiki/WikiInfobox';
import { WikiSidebar } from '../components/wiki/WikiSidebar';
import { WikiHomeView } from '../components/wiki/WikiHomeView';
import { WikiTableOfContents } from '../components/wiki/WikiTableOfContents';
import { WikiAudioNarrator } from '../components/wiki/WikiAudioNarrator';
import { WikiArticleEditorModal } from '../components/wiki/WikiArticleEditorModal';
import { WikiNewArticleModal } from '../components/wiki/WikiNewArticleModal';
import { extractHeadings } from '../components/wiki/wikiHelpers';
import { WikiDataAccess } from '../dataAccess/WikiDataAccess';
import { useDebugMode } from '../hooks/useDebugMode';
import { useWikiViewModel } from '../viewModels/useWikiViewModel';
import './WikiArticleView.scss';

export const WikiArticleView: FC = () => {
  const navigate = useNavigate();
  const { campaignID = 'bttf', articleSlug } = useParams<{
    campaignID?: string;
    articleSlug?: string;
  }>();

  const {
    campaign,
    categories,
    articles,
    currentArticle,
    selectedCategory,
    searchQuery,
    searchResults,
    isLoading,
    errorMessage,
    setSearchQuery,
    setSelectedCategory,
    resolveCanonicalSlug,
    refresh,
  } = useWikiViewModel(campaignID, articleSlug);

  const isHomeView = !articleSlug || articleSlug === 'home';
  const isDebug = useDebugMode();
  const [searchParams, setSearchParams] = useSearchParams();

  const exitDebugMode = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('debug');
    setSearchParams(next, { replace: true });
  };

  const [customContent, setCustomContent] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isNewArticleOpen, setIsNewArticleOpen] = useState<boolean>(false);

  useEffect(() => {
    setCustomContent(null);
  }, [articleSlug, campaignID]);

  const effectiveContent = customContent ?? currentArticle?.ArticleContent ?? '';

  // Extract headings for Table of Contents
  const headings = useMemo(() => {
    if (!effectiveContent) return [];
    return extractHeadings(effectiveContent);
  }, [effectiveContent]);

  // Determine previous and next articles for sequential reading
  const { prevArticle, nextArticle } = useMemo(() => {
    if (!currentArticle || !articles.length) return { prevArticle: null, nextArticle: null };
    const list = articles.filter((a) => !a.ArticleIsRedirect);
    const currentIndex = list.findIndex((a) => a.ArticleSlug === currentArticle.ArticleSlug);
    if (currentIndex === -1) return { prevArticle: null, nextArticle: null };
    const prev = currentIndex > 0 ? list[currentIndex - 1] : null;
    const next = currentIndex < list.length - 1 ? list[currentIndex + 1] : null;
    return { prevArticle: prev, nextArticle: next };
  }, [articles, currentArticle]);

  // Related articles
  const relatedArticles = useMemo(() => {
    if (!currentArticle) return [];
    return articles
      .filter(
        (a) =>
          !a.ArticleIsRedirect &&
          a.ArticleSlug !== currentArticle.ArticleSlug &&
          (currentArticle.ArticleRelatedSlugs.includes(a.ArticleSlug) ||
            a.ArticleCategories.some((c) => currentArticle.ArticleCategories.includes(c))),
      )
      .slice(0, 3);
  }, [articles, currentArticle]);

  return (
    <div className="wiki-view-container">
      <WikiSidebar
        campaign={campaign}
        categories={categories}
        articles={articles}
        activeSlug={currentArticle?.ArticleSlug || (isHomeView ? 'home' : articleSlug)}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        searchResults={searchResults}
        onSearchChange={setSearchQuery}
        onSelectCategory={setSelectedCategory}
        onNewArticle={isDebug ? () => setIsNewArticleOpen(true) : undefined}
      />

      <main className="wiki-main-viewport">
        <nav className="wiki-breadcrumbs" aria-label="Migas de pan">
          <Link to="/campaigns">Campañas</Link>
          <span className="separator">/</span>
          <Link to={`/wiki/${campaignID}`} className={isHomeView ? 'current-crumb' : ''}>
            {campaign?.CampaignTitle || campaignID} (Wiki)
          </Link>
          {currentArticle && (
            <>
              <span className="separator">/</span>
              <span className="current-crumb">{currentArticle.ArticleTitle}</span>
            </>
          )}
        </nav>

        {isDebug && (
          <div className="wiki-debug-banner mb-3" role="status">
            <span className="wiki-debug-banner__text">
              <i className="fas fa-terminal me-2" aria-hidden />
              Modo debug activo (?debug=1): edición y creación habilitadas.
            </span>
            <button type="button" className="wiki-debug-banner__exit" onClick={exitDebugMode}>
              Salir de modo debug
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-info" role="status">
              <span className="visually-hidden">Cargando expediente…</span>
            </div>
            <p className="mt-2 text-muted font-monospace">Accediendo a los archivos de la wiki…</p>
          </div>
        ) : isHomeView ? (
          <WikiHomeView
            campaign={campaign}
            categories={categories}
            articles={articles}
            campaignID={campaignID}
            onNewArticle={isDebug ? () => setIsNewArticleOpen(true) : undefined}
          />
        ) : currentArticle ? (
          <>
            <header className="article-header">
              <div className="article-badge">
                <i className="fas fa-microchip" />
                <span>Expediente de Lore // Base de Datos Central</span>
              </div>
              <h1 className="article-title">{currentArticle.ArticleTitle}</h1>
              <div className="article-meta-bar">
                <span>
                  <i className="fas fa-barcode" />
                  {currentArticle.ArticleID}
                </span>
                <span>
                  <i className="far fa-calendar-alt" />
                  Última revisión: {currentArticle.LastModified || 'Reciente'}
                </span>
                <span>
                  <i className="fas fa-folder-open" />
                  {currentArticle.ArticleCategories.join(', ') || 'General'}
                </span>
                {isDebug && (
                  <div className="meta-actions-cluster">
                    <button
                      type="button"
                      className="btn-edit-article"
                      onClick={() => setIsEditorOpen(true)}
                      title="Diseñar o editar este expediente (?debug=1)"
                    >
                      <i className="fas fa-edit me-1 text-info" />
                      <span>Editar / Diseñar</span>
                    </button>
                    <button
                      type="button"
                      className="btn-new-article-meta"
                      onClick={() => setIsNewArticleOpen(true)}
                      title="Crear un nuevo expediente para esta campaña (?debug=1)"
                    >
                      <i className="fas fa-plus me-1 text-success" />
                      <span>+ Nuevo</span>
                    </button>
                    {articles.length > 1 && (
                      <button
                        type="button"
                        className="btn-delete-article-meta"
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Está seguro de que desea eliminar el expediente '${currentArticle.ArticleTitle}'?`,
                            )
                          ) {
                            WikiDataAccess.DeleteArticle(campaignID, currentArticle.ArticleSlug);
                            refresh();
                            navigate(`/wiki/${campaignID}`);
                          }
                        }}
                        title="Eliminar este expediente de la Wiki (?debug=1)"
                      >
                        <i className="fas fa-trash-alt text-danger" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </header>

            {/* Vocaloid Miku TTS Audio Narrator (Book Mode) */}
            <WikiAudioNarrator
              content={effectiveContent}
              articleTitle={currentArticle.ArticleTitle}
            />

            <div className="article-body-layout">
              {currentArticle.ArticleInfobox && (
                <WikiInfobox infobox={currentArticle.ArticleInfobox} />
              )}

              {/* Wikipedia-style Table of Contents */}
              <WikiTableOfContents headings={headings} />

              <WikiContentRenderer
                content={effectiveContent}
                campaignID={campaignID}
                categories={currentArticle.ArticleCategories}
                resolveSlug={resolveCanonicalSlug}
              />
            </div>

            {/* Sequential Reading Navigation Footer */}
            <footer className="article-footer-nav">
              <div className="article-paging-bar">
                {prevArticle ? (
                  <Link
                    to={`/wiki/${campaignID}/${prevArticle.ArticleSlug}`}
                    className="paging-btn prev-btn"
                  >
                    <span className="paging-dir">← Anterior</span>
                    <span className="paging-title">{prevArticle.ArticleTitle}</span>
                  </Link>
                ) : (
                  <div className="paging-placeholder" />
                )}

                <Link
                  to={`/wiki/${campaignID}`}
                  className="btn-return-home"
                  title="Volver al Portal Home de la Wiki"
                >
                  <i className="fas fa-landmark me-1" />
                  <span>Portal Home</span>
                </Link>

                {nextArticle ? (
                  <Link
                    to={`/wiki/${campaignID}/${nextArticle.ArticleSlug}`}
                    className="paging-btn next-btn"
                  >
                    <span className="paging-dir">Siguiente →</span>
                    <span className="paging-title">{nextArticle.ArticleTitle}</span>
                  </Link>
                ) : (
                  <div className="paging-placeholder" />
                )}
              </div>

              {/* Related Articles ("Véase También") */}
              {relatedArticles.length > 0 && (
                <div className="related-articles-section">
                  <h4 className="related-heading">
                    <i className="fas fa-link me-2 text-info" />
                    Expedientes Relacionados
                  </h4>
                  <div className="related-cards-grid">
                    {relatedArticles.map((rel) => (
                      <Link
                        key={rel.ArticleID}
                        to={`/wiki/${campaignID}/${rel.ArticleSlug}`}
                        className="related-card"
                      >
                        <span className="rel-title">{rel.ArticleTitle}</span>
                        <span className="rel-cat">
                          {rel.ArticleCategories[0]?.replace(/^Categor[ií]a:\s*/i, '') || 'General'}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </footer>

            {/* In-Browser Wiki Article & PDF Editor Modal */}
            {isDebug && isEditorOpen && currentArticle && (
              <WikiArticleEditorModal
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                campaignID={campaignID}
                articleSlug={currentArticle.ArticleSlug}
                initialContent={effectiveContent}
                articleTitle={currentArticle.ArticleTitle}
                categories={currentArticle.ArticleCategories}
                resolveSlug={resolveCanonicalSlug}
                onSaved={(newContent) => {
                  setCustomContent(newContent);
                  refresh();
                }}
              />
            )}
          </>
        ) : (
          <div className="article-not-found">
            <i className="fas fa-folder-minus" />
            <h3>Expediente No Encontrado</h3>
            <p>{errorMessage || 'El artículo solicitado no existe o fue desclasificado.'}</p>
            <div className="d-flex gap-2 justify-content-center mt-3">
              <Link to={`/wiki/${campaignID}`} className="btn btn-outline-info font-monospace">
                <i className="fas fa-home me-2" />
                Ir al Home de la Wiki
              </Link>
              {isDebug && (
                <button
                  type="button"
                  className="btn btn-info font-monospace text-dark fw-bold"
                  onClick={() => setIsNewArticleOpen(true)}
                >
                  <i className="fas fa-plus me-1" />
                  Crear Nuevo Artículo
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal to create a new wiki article for this campaign */}
        {isDebug && isNewArticleOpen && (
          <WikiNewArticleModal
            isOpen={isNewArticleOpen}
            onClose={() => setIsNewArticleOpen(false)}
            campaignID={campaignID}
            campaignTitle={campaign?.CampaignTitle || campaignID}
            existingCategories={categories.map((c) => c.CategoryName)}
            onCreated={(newSlug) => {
              refresh();
              navigate(`/wiki/${campaignID}/${newSlug}`);
              setTimeout(() => {
                setIsEditorOpen(true);
              }, 150);
            }}
          />
        )}
      </main>
    </div>
  );
};
