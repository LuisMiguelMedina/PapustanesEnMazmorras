import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { CampaignBase } from '../../models/Campaigns/CampaignModels';
import { WikiArticleBase, WikiCategoryBase } from '../../models/Wiki/WikiModels';
import './WikiSidebar.scss';

export interface WikiSidebarProps {
  campaign: CampaignBase | null;
  categories: WikiCategoryBase[];
  articles: WikiArticleBase[];
  activeSlug?: string | null;
  selectedCategory: string | null;
  searchQuery: string;
  searchResults: WikiArticleBase[];
  onSearchChange: (q: string) => void;
  onSelectCategory: (cat: string | null) => void;
  onNewArticle?: () => void;
}

export const WikiSidebar: FC<WikiSidebarProps> = ({
  campaign,
  categories,
  articles,
  activeSlug,
  selectedCategory,
  searchQuery,
  searchResults,
  onSearchChange,
  onSelectCategory,
  onNewArticle,
}) => {
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);

  return (
    <aside className="wiki-sidebar" aria-label="Navegación de la Wiki">
      <div className="sidebar-header">
        <Link to="/campaigns" className="back-link">
          <i className="fas fa-arrow-left" />
          <span>Volver al Centro de Campañas</span>
        </Link>

        <div className="campaign-brand">
          <div className="brand-icon">
            <i className="fas fa-atom" />
          </div>
          <div className="brand-text">
            <h4>{campaign?.CampaignTitle || 'Multiverse Lore'}</h4>
            <span>{campaign?.CampaignSystem || 'Base de Datos de Lore'}</span>
          </div>
        </div>

        <Link
          to={`/wiki/${campaign?.CampaignID || 'bttf'}`}
          className={`sidebar-home-btn ${!activeSlug || activeSlug === 'home' ? 'active' : ''}`}
          title="Ir a la página principal de la Wiki para buscar palabras clave o explorar categorías"
        >
          <i className="fas fa-landmark me-2" />
          <span>Portal Principal / Home Wiki</span>
        </Link>

        {onNewArticle && (
          <button
            type="button"
            className="sidebar-new-article-btn"
            onClick={onNewArticle}
            title="Redactar un nuevo artículo o documento para esta Wiki"
          >
            <i className="fas fa-file-circle-plus me-2" />
            <span>+ Nuevo Artículo</span>
          </button>
        )}
      </div>

      <div className="sidebar-search-box">
        <div className="search-input-wrapper">
          <i className="fas fa-search" />
          <input
            type="text"
            placeholder="Buscar en el archivo de Lore…"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setShowSearchDropdown(e.target.value.trim().length >= 2);
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) setShowSearchDropdown(true);
            }}
          />
        </div>

        {showSearchDropdown && searchResults.length > 0 && (
          <div className="search-dropdown">
            {searchResults.map((item) => (
              <Link
                key={item.ArticleID}
                to={`/wiki/${item.CampaignID}/${item.ArticleSlug}`}
                className="dropdown-item"
                onClick={() => {
                  setShowSearchDropdown(false);
                  onSearchChange('');
                }}
              >
                <span className="item-title">{item.ArticleTitle}</span>
                <span className="item-category">
                  {item.ArticleCategories.join(', ') || 'General'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-scroll-area">
        <div className="nav-section-title">Filtrar por Categoría</div>
        <div className="category-filter-list">
          <button
            type="button"
            className={`category-pill ${selectedCategory === null ? 'active' : ''}`}
            onClick={() => onSelectCategory(null)}
          >
            Todas ({articles.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.CategoryID}
              type="button"
              className={`category-pill ${selectedCategory === cat.CategoryName ? 'active' : ''}`}
              onClick={() =>
                onSelectCategory(selectedCategory === cat.CategoryName ? null : cat.CategoryName)
              }
            >
              {cat.CategoryName}
            </button>
          ))}
        </div>

        <div className="nav-section-title">Expedientes & Artículos</div>
        <ul className="article-nav-list">
          {articles.map((art) => {
            const isActive = activeSlug === art.ArticleSlug;
            return (
              <li key={art.ArticleID}>
                <Link
                  to={`/wiki/${art.CampaignID}/${art.ArticleSlug}`}
                  className={isActive ? 'active' : ''}
                >
                  <i className={isActive ? 'fas fa-chevron-right' : 'far fa-file-lines'} />
                  <span>{art.ArticleTitle}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};
