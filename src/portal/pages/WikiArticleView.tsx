import { FC, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WikiContentRenderer } from '../components/wiki/WikiContentRenderer';
import { WikiInfobox } from '../components/wiki/WikiInfobox';
import { WikiSidebar } from '../components/wiki/WikiSidebar';
import { WikiHomeView } from '../components/wiki/WikiHomeView';
import { WikiTableOfContents } from '../components/wiki/WikiTableOfContents';
import { WikiAudioNarrator } from '../components/wiki/WikiAudioNarrator';
import { extractHeadings } from '../components/wiki/wikiHelpers';
import { useWikiViewModel } from '../viewModels/useWikiViewModel';
import './WikiArticleView.scss';

export const WikiArticleView: FC = () => {
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
  } = useWikiViewModel(campaignID, articleSlug);

  const isHomeView = !articleSlug || articleSlug === 'home';

  // Extract headings for Table of Contents
  const headings = useMemo(() => {
    if (!currentArticle) return [];
    return extractHeadings(currentArticle.ArticleContent);
  }, [currentArticle]);

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
              </div>
            </header>

            {/* Vocaloid Miku TTS Audio Narrator (Book Mode) */}
            <WikiAudioNarrator
              content={currentArticle.ArticleContent}
              articleTitle={currentArticle.ArticleTitle}
            />

            <div className="article-body-layout">
              {currentArticle.ArticleInfobox && (
                <WikiInfobox infobox={currentArticle.ArticleInfobox} />
              )}

              {/* Wikipedia-style Table of Contents */}
              <WikiTableOfContents headings={headings} />

              <WikiContentRenderer
                content={currentArticle.ArticleContent}
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
          </>
        ) : (
          <div className="article-not-found">
            <i className="fas fa-folder-minus" />
            <h3>Expediente No Encontrado</h3>
            <p>{errorMessage || 'El artículo solicitado no existe o fue desclasificado.'}</p>
            <Link to={`/wiki/${campaignID}`} className="btn btn-outline-info font-monospace mt-2">
              <i className="fas fa-home me-2" />
              Ir al Home de la Wiki
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};
