/**
 * DataAccess layer for Sci-Fi Lore Wiki conforming to Constitution_Brendup.md.
 * All classes and methods are strictly static, adhere to transactional responses,
 * and contain zero unhandled throw statements.
 */

import { BTTF_WIKI_SEED } from '../data/bttf-wiki.seed';
import {
  EONES_WIKI_SEED,
  GOLDEN_21_WIKI_SEED,
} from '../data/multiverse-wiki.seed';
import { ResponseObject } from '../models/Common/TransactionModels';
import {
  WikiArticleBase,
  WikiArticleFilter,
  WikiArticleFind,
  WikiCategoryBase,
} from '../models/Wiki/WikiModels';
import { CampaignDataAccess } from './CampaignDataAccess';

export class WikiDataAccess {
  /**
   * Helper to retrieve all articles for a specific campaign, merging base seeds,
   * dynamically generated fallbacks for custom campaigns, and user created/edited articles.
   */
  public static getArticlesForCampaign(campaignID: string): WikiArticleBase[] {
    let baseArticles: WikiArticleBase[] = [];

    if (campaignID === 'bttf') {
      baseArticles = [...BTTF_WIKI_SEED];
    } else if (campaignID === 'golden-21') {
      baseArticles = [...GOLDEN_21_WIKI_SEED];
    } else if (campaignID === 'cronicas-eones') {
      baseArticles = [...EONES_WIKI_SEED];
    } else {
      // Dynamic fallback for any campaign registered in CampaignDataAccess
      const campRes = CampaignDataAccess.Find({ CampaignID: campaignID });
      if (campRes.CodeNumber === 302 && campRes.Result) {
        const camp = campRes.Result;
        const defaultSlug =
          camp.CampaignWikiHomeSlug || camp.CampaignSlug || camp.CampaignID.toLowerCase();
        baseArticles = [
          {
            ArticleID: `art_${camp.CampaignID}_overview`,
            CampaignID: camp.CampaignID,
            ArticleSlug: defaultSlug,
            ArticleTitle: camp.CampaignTitle,
            ArticleSubtitle: camp.CampaignSystem,
            ArticleCategories: ['Categoría:Expedientes', 'Categoría:Lore'],
            ArticleContent: `== ${camp.CampaignTitle} ==\n\n${
              camp.CampaignDescription ||
              'Bienvenido al archivo de expedientes y crónicas de esta campaña.'
            }\n\n=== Expediente de Campaña ===\n\n- **Sistema**: ${camp.CampaignSystem}\n- **Game Master**: ${
              camp.CampaignGameMaster || 'DM'
            }\n- **Fecha de Inicio**: ${camp.CampaignStartDate || 'Por anunciar'}\n- **Jugadores**: ${
              camp.CampaignPlayerCount ?? 'TBD'
            }\n- **Sesiones**: ${camp.CampaignSessionCount ?? 0}\n\n> [!NOTE]\n> Esta campaña cuenta con su propia Wiki modular. Puede agregar nuevos artículos, redactar con el editor visual básico o en código Markdown, e insertar lectores de PDF interactivos con visor Adobe Acrobat.`,
            ArticleInfobox: {
              InfoboxType: 'GENERAL',
              Title: camp.CampaignTitle,
              ImageUrl: camp.CampaignCoverUrl,
              ImageCaption: camp.CampaignSystem,
              Properties: [
                { Key: 'Game Master', Value: camp.CampaignGameMaster },
                { Key: 'Sistema', Value: camp.CampaignSystem },
                { Key: 'Estado', Value: camp.CampaignStatus },
              ],
            },
            ArticleAliases: [camp.CampaignID, camp.CampaignSlug, 'home', 'inicio'],
            ArticleRelatedSlugs: [],
            ArticleIsRedirect: false,
            ArticleRedirectTarget: null,
            LastModified: 'Reciente',
          },
        ];
      }
    }

    // Merge custom articles from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storageKey = `wiki_custom_articles_${campaignID}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const customList: WikiArticleBase[] = JSON.parse(stored);
          if (Array.isArray(customList)) {
            const slugMap = new Map<string, WikiArticleBase>();
            baseArticles.forEach((a) => slugMap.set(a.ArticleSlug, a));
            customList.forEach((a) => slugMap.set(a.ArticleSlug, a));
            baseArticles = Array.from(slugMap.values());
          }
        }

        // Apply any single article content override
        baseArticles = baseArticles.map((art) => {
          const overrideKey = `wiki_override_${campaignID}_${art.ArticleSlug}`;
          const savedContent = localStorage.getItem(overrideKey);
          if (savedContent) {
            return {
              ...art,
              ArticleContent: savedContent,
              LastModified: 'Modificado por el Usuario',
            };
          }
          return art;
        });
      } catch {
        // Fallback gracefully
      }
    }

    return baseArticles;
  }

  /**
   * Resolves aliases and redirection targets to canonical slugs.
   */
  public static ResolveAlias(campaignID: string, slugOrAlias: string): string {
    const normalized = slugOrAlias.toLowerCase().trim();
    const articles = this.getArticlesForCampaign(campaignID);

    // Direct slug match
    const direct = articles.find((a) => a.ArticleSlug === normalized);
    if (direct) {
      if (direct.ArticleIsRedirect && direct.ArticleRedirectTarget) {
        return direct.ArticleRedirectTarget;
      }
      return direct.ArticleSlug;
    }

    // Alias or title match
    const aliased = articles.find(
      (a) =>
        a.ArticleAliases.some((al) => al.toLowerCase() === normalized) ||
        a.ArticleTitle.toLowerCase() === normalized,
    );
    if (aliased) {
      if (aliased.ArticleIsRedirect && aliased.ArticleRedirectTarget) {
        return aliased.ArticleRedirectTarget;
      }
      return aliased.ArticleSlug;
    }

    return normalized;
  }

  /**
   * Finds a wiki article by CampaignID and ArticleSlug (resolving aliases automatically).
   */
  public static Find(find: WikiArticleFind): ResponseObject<WikiArticleBase> {
    try {
      const canonicalSlug = this.ResolveAlias(find.CampaignID, find.ArticleSlug);
      const articles = this.getArticlesForCampaign(find.CampaignID);
      const article = articles.find((a) => a.ArticleSlug === canonicalSlug);

      if (!article) {
        return {
          CodeNumber: 404,
          CodeName: 'NotFound',
          Message: `Article '${find.ArticleSlug}' was not found in campaign '${find.CampaignID}'.`,
          ErrorNumber: 404,
          ServerName: 'local-portal',
          Result: null,
        };
      }

      return {
        CodeNumber: 302,
        CodeName: 'Found',
        Message: 'Article found successfully.',
        ErrorNumber: null,
        ServerName: 'local-portal',
        Result: article,
      };
    } catch {
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: 'Error retrieving wiki article.',
        ErrorNumber: 500,
        ServerName: 'local-portal',
        Result: null,
      };
    }
  }

  /**
   * Lists wiki articles for a campaign with optional category and search filters.
   */
  public static List(filter: WikiArticleFilter): ResponseObject<WikiArticleBase[]> {
    try {
      let articles = this.getArticlesForCampaign(filter.CampaignID);

      // Filter out pure redirects from general listing unless searching
      if (!filter.SearchQuery) {
        articles = articles.filter((a) => !a.ArticleIsRedirect);
      }

      if (filter.Category) {
        const catQuery = filter.Category.toLowerCase();
        articles = articles.filter((a) =>
          a.ArticleCategories.some((cat) => cat.toLowerCase().includes(catQuery)),
        );
      }

      if (filter.SearchQuery) {
        const query = filter.SearchQuery.toLowerCase().trim();
        articles = articles.filter(
          (a) =>
            a.ArticleTitle.toLowerCase().includes(query) ||
            a.ArticleContent.toLowerCase().includes(query) ||
            a.ArticleCategories.some((c) => c.toLowerCase().includes(query)) ||
            a.ArticleAliases.some((al) => al.toLowerCase().includes(query)),
        );
      }

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: `Found ${articles.length} article(s).`,
        ErrorNumber: null,
        ServerName: 'local-portal',
        Result: articles,
      };
    } catch {
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: 'Error listing wiki articles.',
        ErrorNumber: 500,
        ServerName: 'local-portal',
        Result: null,
      };
    }
  }

  /**
   * Lists available wiki categories dynamically extracted from campaign articles.
   */
  public static ListCategories(campaignID: string): ResponseObject<WikiCategoryBase[]> {
    try {
      const articles = this.getArticlesForCampaign(campaignID);
      const catCounts = new Map<string, number>();

      articles.forEach((art) => {
        if (!art.ArticleIsRedirect && art.ArticleCategories) {
          art.ArticleCategories.forEach((cat) => {
            const cleanCat = cat.trim();
            if (cleanCat) {
              catCounts.set(cleanCat, (catCounts.get(cleanCat) || 0) + 1);
            }
          });
        }
      });

      if (catCounts.size === 0) {
        catCounts.set('Categoría:Expedientes', 1);
        catCounts.set('Categoría:Lore', 1);
      }

      const categories: WikiCategoryBase[] = Array.from(catCounts.entries()).map(
        ([name, count], index) => ({
          CategoryID: `cat_${campaignID}_${index}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          CategoryName: name,
          ArticleCount: count,
        }),
      );

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: `Found ${categories.length} category/categories.`,
        ErrorNumber: null,
        ServerName: 'local-portal',
        Result: categories,
      };
    } catch {
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: 'Error listing wiki categories.',
        ErrorNumber: 500,
        ServerName: 'local-portal',
        Result: null,
      };
    }
  }

  /**
   * Creates or registers a new wiki article in the specified campaign.
   */
  public static CreateArticle(article: WikiArticleBase): ResponseObject<WikiArticleBase> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return {
          CodeNumber: 500,
          CodeName: 'InternalServerError',
          Message: 'LocalStorage no disponible.',
          ErrorNumber: 500,
          ServerName: 'local-portal',
          Result: null,
        };
      }

      const storageKey = `wiki_custom_articles_${article.CampaignID}`;
      const existing = this.getArticlesForCampaign(article.CampaignID);
      const filtered = existing.filter((a) => a.ArticleSlug !== article.ArticleSlug);
      const updatedList = [article, ...filtered];

      localStorage.setItem(storageKey, JSON.stringify(updatedList));

      return {
        CodeNumber: 201,
        CodeName: 'Created',
        Message: 'Artículo creado exitosamente.',
        ErrorNumber: null,
        ServerName: 'local-portal',
        Result: article,
      };
    } catch {
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: 'Error al crear el artículo.',
        ErrorNumber: 500,
        ServerName: 'local-portal',
        Result: null,
      };
    }
  }

  /**
   * Persists updated article markdown content into localStorage for client-side editing.
   */
  public static SaveArticleContent(
    campaignID: string,
    articleSlug: string,
    content: string,
  ): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const canonicalSlug = this.ResolveAlias(campaignID, articleSlug);
      const overrideKey = `wiki_override_${campaignID}_${canonicalSlug}`;
      localStorage.setItem(overrideKey, content);

      // Also sync into custom articles array if present
      const storageKey = `wiki_custom_articles_${campaignID}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const list: WikiArticleBase[] = JSON.parse(stored);
          const target = list.find((a) => a.ArticleSlug === canonicalSlug);
          if (target) {
            target.ArticleContent = content;
            target.LastModified = 'Modificado por el Usuario';
            localStorage.setItem(storageKey, JSON.stringify(list));
          }
        } catch {
          // ignore
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletes a wiki article from custom articles.
   */
  public static DeleteArticle(campaignID: string, articleSlug: string): ResponseObject<boolean> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return {
          CodeNumber: 500,
          CodeName: 'InternalServerError',
          Message: 'LocalStorage no disponible.',
          ErrorNumber: 500,
          ServerName: 'local-portal',
          Result: false,
        };
      }

      const canonicalSlug = this.ResolveAlias(campaignID, articleSlug);
      const storageKey = `wiki_custom_articles_${campaignID}`;
      const existing = this.getArticlesForCampaign(campaignID);
      const filtered = existing.filter((a) => a.ArticleSlug !== canonicalSlug);

      localStorage.setItem(storageKey, JSON.stringify(filtered));
      localStorage.removeItem(`wiki_override_${campaignID}_${canonicalSlug}`);

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: 'Artículo eliminado correctamente.',
        ErrorNumber: null,
        ServerName: 'local-portal',
        Result: true,
      };
    } catch {
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: 'Error al eliminar el artículo.',
        ErrorNumber: 500,
        ServerName: 'local-portal',
        Result: false,
      };
    }
  }

  /**
   * Clears custom local overrides for an article and restores the original seed content.
   */
  public static ResetArticleContent(campaignID: string, articleSlug: string): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const canonicalSlug = this.ResolveAlias(campaignID, articleSlug);
      const overrideKey = `wiki_override_${campaignID}_${canonicalSlug}`;
      localStorage.removeItem(overrideKey);
      return true;
    } catch {
      return false;
    }
  }
}
