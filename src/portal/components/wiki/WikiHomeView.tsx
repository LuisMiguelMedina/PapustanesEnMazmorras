import { FC, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CampaignBase } from '../../models/Campaigns/CampaignModels';
import { WikiArticleBase, WikiCategoryBase } from '../../models/Wiki/WikiModels';
import { searchWikiArticles, generateExcerpt } from './wikiHelpers';
import './WikiHomeView.scss';

export interface WikiHomeViewProps {
  campaign: CampaignBase | null;
  categories: WikiCategoryBase[];
  articles: WikiArticleBase[];
  campaignID: string;
  onNewArticle?: () => void;
}

type DirectoryViewMode = 'CATEGORIES' | 'ALPHABETICAL';

export const WikiHomeView: FC<WikiHomeViewProps> = ({
  campaign,
  categories,
  articles,
  campaignID,
  onNewArticle,
}) => {
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [directoryMode, setDirectoryMode] = useState<DirectoryViewMode>('CATEGORIES');

  // Featured article: the one designated as CampaignWikiHomeSlug or the first one
  const featuredArticle = useMemo(() => {
    if (!articles.length) return null;
    const defaultSlug = campaign?.CampaignWikiHomeSlug;
    if (defaultSlug) {
      const found = articles.find((a) => a.ArticleSlug === defaultSlug);
      if (found) return found;
    }
    return articles[0];
  }, [articles, campaign]);

  // Search results combining Title, Subtitle headings, and Tags
  const searchResults = useMemo(() => {
    return searchWikiArticles(articles, searchKeyword, selectedTag);
  }, [articles, searchKeyword, selectedTag]);

  // Grouped articles by category for the directory
  const articlesByCategory = useMemo(() => {
    const map = new Map<string, WikiArticleBase[]>();

    articles.forEach((art) => {
      if (art.ArticleIsRedirect) return;
      const cats = art.ArticleCategories.length > 0 ? art.ArticleCategories : ['General'];
      cats.forEach((cat) => {
        const cleanCat = cat.replace(/^Categor[ií]a:\s*/i, '');
        if (!map.has(cleanCat)) {
          map.set(cleanCat, []);
        }
        map.get(cleanCat)!.push(art);
      });
    });

    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [articles]);

  // Alphabetical groupings (A-Z)
  const articlesAlphabetical = useMemo(() => {
    const nonRedirects = articles.filter((a) => !a.ArticleIsRedirect);
    const groups = new Map<string, WikiArticleBase[]>();

    nonRedirects.forEach((art) => {
      const firstChar = art.ArticleTitle.charAt(0).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const key = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(art);
    });

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [articles]);

  const hasSearchFilter = searchKeyword.trim().length > 0 || selectedTag !== null;

  return (
    <div className="wiki-home-view">
      {/* ---------------- 1. HERO & BRANDING ---------------- */}
      <header className="wiki-home-hero">
        <div className="hero-badge">
          <i className="fas fa-database me-2" />
          <span>Base de Datos de Lore // Portal Enciclopédico</span>
        </div>

        <h1 className="hero-title">
          {campaign?.CampaignTitle || 'Archivo Multiverse'}
        </h1>

        <p className="hero-description">
          Bienvenido al centro oficial de documentación, lore, facciones, personajes y crónicas de{' '}
          <strong>{campaign?.CampaignTitle || 'la campaña'}</strong>. Utiliza el buscador para localizar
          conceptos, subtítulos de reglamentos o etiquetas de facciones.
        </p>

        {/* Quick stats chips */}
        <div className="hero-stats-row">
          <div className="stat-chip">
            <i className="fas fa-book-bookmark text-info" />
            <span>
              <strong>{articles.filter((a) => !a.ArticleIsRedirect).length}</strong> Expedientes
            </span>
          </div>
          <div className="stat-chip">
            <i className="fas fa-tags text-warning" />
            <span>
              <strong>{categories.length}</strong> Categorías
            </span>
          </div>
          {campaign?.CampaignGameMaster && (
            <div className="stat-chip">
              <i className="fas fa-user-shield text-danger" />
              <span>
                DM: <strong>{campaign.CampaignGameMaster}</strong>
              </span>
            </div>
          )}
          {campaign?.CampaignSystem && (
            <div className="stat-chip">
              <i className="fas fa-dice-d20 text-success" />
              <span>{campaign.CampaignSystem}</span>
            </div>
          )}
        </div>

        {onNewArticle && (
          <div className="hero-action-row mt-3">
            <button
              type="button"
              className="btn-create-article-hero"
              onClick={onNewArticle}
              title="Redactar un nuevo artículo o documento para esta campaña"
            >
              <i className="fas fa-file-circle-plus me-2" />
              <span>+ Redactar Nuevo Artículo</span>
            </button>
          </div>
        )}
      </header>

      {/* ---------------- 2. SEARCH & TAG FILTER BAR ---------------- */}
      <section className="wiki-search-portal-section">
        <div className="search-portal-input-container">
          <i className="fas fa-search search-icon" />
          <input
            type="text"
            className="search-portal-input"
            placeholder="Buscar por títulos, subtítulos de sección (ej: Hardcore, Facciones), etiquetas o palabras clave..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            aria-label="Buscar palabras clave en la Wiki"
          />
          {searchKeyword && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchKeyword('')}
              title="Borrar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tags / Categories Quick Filters */}
        <div className="wiki-tags-filter-bar">
          <span className="tags-label">
            <i className="fas fa-filter me-1" />
            Filtrar:
          </span>

          <button
            type="button"
            className={`filter-pill ${selectedTag === null ? 'active' : ''}`}
            onClick={() => setSelectedTag(null)}
          >
            Todas ({articles.filter((a) => !a.ArticleIsRedirect).length})
          </button>

          {categories.map((cat) => {
            const cleanName = cat.CategoryName.replace(/^Categor[ií]a:\s*/i, '');
            const isSelected = selectedTag === cat.CategoryName;
            return (
              <button
                key={cat.CategoryID}
                type="button"
                className={`filter-pill ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedTag(isSelected ? null : cat.CategoryName)}
              >
                {cleanName}
                <span className="pill-count">{cat.ArticleCount}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------- 3. CONDITIONAL BODY: SEARCH RESULTS OR HOME PORTAL ---------------- */}
      {hasSearchFilter ? (
        <section className="wiki-search-results-section">
          <div className="results-header">
            <h2 className="results-heading">
              <i className="fas fa-list-check me-2 text-info" />
              Resultados de Búsqueda ({searchResults.length})
            </h2>
            {selectedTag && (
              <span className="active-tag-indicator">
                Categoría: <strong>{selectedTag.replace(/^Categor[ií]a:\s*/i, '')}</strong>
                <button type="button" onClick={() => setSelectedTag(null)}>
                  ✕
                </button>
              </span>
            )}
          </div>

          {searchResults.length > 0 ? (
            <div className="results-grid">
              {searchResults.map((match) => {
                const art = match.article;
                const targetUrl = match.matchedSubtitleSlug
                  ? `/wiki/${campaignID}/${art.ArticleSlug}#${match.matchedSubtitleSlug}`
                  : `/wiki/${campaignID}/${art.ArticleSlug}`;

                return (
                  <article key={`${art.ArticleID}-${match.matchType}`} className="search-result-card">
                    <div className="result-card-top">
                      {/* Match type badge */}
                      {match.matchType === 'SUBTITLE' && (
                        <span className="match-type-pill match-subtitle">
                          <i className="fas fa-heading me-1" />
                          Subtítulo: <strong>"{match.matchedSubtitle}"</strong>
                        </span>
                      )}
                      {match.matchType === 'TAG' && (
                        <span className="match-type-pill match-tag">
                          <i className="fas fa-tag me-1" />
                          Etiqueta: <strong>{match.matchedTag}</strong>
                        </span>
                      )}
                      {match.matchType === 'TITLE' && (
                        <span className="match-type-pill match-title">
                          <i className="fas fa-book me-1" />
                          Título
                        </span>
                      )}
                      {match.matchType === 'CONTENT' && (
                        <span className="match-type-pill match-content">
                          <i className="fas fa-align-left me-1" />
                          Contenido
                        </span>
                      )}

                      <span className="result-meta-id">{art.ArticleID}</span>
                    </div>

                    <h3 className="result-card-title">
                      <Link to={targetUrl}>{art.ArticleTitle}</Link>
                    </h3>

                    <p className="result-card-snippet">{match.snippet}</p>

                    <div className="result-card-footer">
                      <div className="result-categories">
                        {art.ArticleCategories.map((c) => (
                          <span key={c} className="cat-badge">
                            {c.replace(/^Categor[ií]a:\s*/i, '')}
                          </span>
                        ))}
                      </div>

                      <Link to={targetUrl} className="btn-read-result">
                        <span>Leer</span>
                        <i className="fas fa-arrow-right ms-1" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="search-empty-state">
              <i className="fas fa-folder-open empty-icon" />
              <h3>Sin coincidencias en los archivos</h3>
              <p>
                No se encontraron expedientes con el término <strong>"{searchKeyword}"</strong>
                {selectedTag ? ` en la categoría seleccionada` : ''}.
              </p>
              <button
                type="button"
                className="btn-reset-search"
                onClick={() => {
                  setSearchKeyword('');
                  setSelectedTag(null);
                }}
              >
                Limpiar búsqueda y ver todos los artículos
              </button>
            </div>
          )}
        </section>
      ) : (
        /* ---------------- DEFAULT PORTAL HOME VIEW ---------------- */
        <>
          {/* Spotlight Featured Article */}
          {featuredArticle && (
            <section className="wiki-spotlight-section">
              <div className="spotlight-card">
                <div className="spotlight-content">
                  <div className="spotlight-tag">
                    <i className="fas fa-star text-warning me-1" />
                    Expediente Principal Recomendado
                  </div>
                  <h2 className="spotlight-title">{featuredArticle.ArticleTitle}</h2>
                  <p className="spotlight-excerpt">
                    {generateExcerpt(featuredArticle.ArticleContent, 280)}
                  </p>
                  <div className="spotlight-actions">
                    <Link
                      to={`/wiki/${campaignID}/${featuredArticle.ArticleSlug}`}
                      className="btn-spotlight-read"
                    >
                      <i className="fas fa-book-open me-2" />
                      Explorar Expediente Completo
                    </Link>
                  </div>
                </div>

                {featuredArticle.ArticleInfobox && (
                  <div className="spotlight-infobox-preview">
                    <div className="infobox-preview-header">
                      <i className="fas fa-info-circle me-1" />
                      Ficha Rápida
                    </div>
                    <ul className="infobox-preview-list">
                      {featuredArticle.ArticleInfobox.Properties.slice(0, 4).map((prop, idx) => (
                        <li key={idx}>
                          <span className="prop-key">{prop.Key}:</span>
                          <span className="prop-val">{prop.Value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ---------------- 4. COMPLETE DIRECTORY (WIKIPEDIA STYLE) ---------------- */}
          <section className="wiki-directory-section">
            <div className="directory-header">
              <div className="directory-title-wrap">
                <h2>
                  <i className="fas fa-compass me-2 text-warning" />
                  Directorio General de Artículos
                </h2>
                <p>Navega a través de todos los expedientes ordenados por categoría temática o de forma alfabética.</p>
              </div>

              <div className="directory-mode-toggle">
                <button
                  type="button"
                  className={`btn-mode ${directoryMode === 'CATEGORIES' ? 'active' : ''}`}
                  onClick={() => setDirectoryMode('CATEGORIES')}
                >
                  <i className="fas fa-layer-group me-1" />
                  Por Categorías
                </button>
                <button
                  type="button"
                  className={`btn-mode ${directoryMode === 'ALPHABETICAL' ? 'active' : ''}`}
                  onClick={() => setDirectoryMode('ALPHABETICAL')}
                >
                  <i className="fas fa-arrow-down-a-z me-1" />
                  Índice A-Z
                </button>
              </div>
            </div>

            {/* View Mode: By Categories */}
            {directoryMode === 'CATEGORIES' && (
              <div className="category-directory-grid">
                {articlesByCategory.map(([catName, catArticles]) => (
                  <div key={catName} className="category-group-card">
                    <div className="category-group-header">
                      <h3>
                        <i className="fas fa-folder me-2 text-info" />
                        {catName}
                      </h3>
                      <span className="category-count-badge">{catArticles.length} artículos</span>
                    </div>

                    <ul className="category-articles-list">
                      {catArticles.map((art) => (
                        <li key={art.ArticleID}>
                          <Link to={`/wiki/${campaignID}/${art.ArticleSlug}`} className="article-item-link">
                            <i className="far fa-file-lines me-2 text-muted" />
                            <span className="article-name">{art.ArticleTitle}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* View Mode: Alphabetical A-Z */}
            {directoryMode === 'ALPHABETICAL' && (
              <div className="alphabetical-directory-container">
                {articlesAlphabetical.map(([letter, groupArticles]) => (
                  <div key={letter} className="alpha-letter-block">
                    <div className="letter-header">
                      <span className="letter-char">{letter}</span>
                      <span className="letter-line" />
                    </div>

                    <ul className="alpha-articles-list">
                      {groupArticles.map((art) => (
                        <li key={art.ArticleID}>
                          <Link to={`/wiki/${campaignID}/${art.ArticleSlug}`} className="alpha-article-link">
                            <span className="art-title">{art.ArticleTitle}</span>
                            <span className="art-cat">
                              {art.ArticleCategories[0]?.replace(/^Categor[ií]a:\s*/i, '') || 'General'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
