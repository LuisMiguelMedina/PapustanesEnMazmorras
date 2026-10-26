/**
 * DataAccess layer for Sci-Fi Lore Wiki conforming to Constitution_Brendup.md.
 * All classes and methods are strictly static, adhere to transactional responses,
 * and contain zero unhandled throw statements.
 */

import { BTTF_CATEGORIES_SEED, BTTF_WIKI_SEED } from '../data/bttf-wiki.seed';
import {
  EONES_CATEGORIES_SEED,
  EONES_WIKI_SEED,
  GOLDEN_21_CATEGORIES_SEED,
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
   * Helper to retrieve all articles for a specific campaign, including seeds and fallbacks.
   */
  private static getArticlesForCampaign(campaignID: string): WikiArticleBase[] {
    if (campaignID === 'bttf') {
      return [...BTTF_WIKI_SEED];
    }
    if (campaignID === 'golden-21') {
      return [...GOLDEN_21_WIKI_SEED];
    }
    if (campaignID === 'cronicas-eones') {
      return [...EONES_WIKI_SEED];
    }

    // Dynamic fallback for any campaign registered in CampaignDataAccess
    const campRes = CampaignDataAccess.Find({ CampaignID: campaignID });
    if (campRes.CodeNumber === 302 && campRes.Result) {
      const camp = campRes.Result;
      const defaultSlug = camp.CampaignWikiHomeSlug || camp.CampaignSlug || camp.CampaignID;
      return [
        {
          ArticleID: `art_${camp.CampaignID}_overview`,
          CampaignID: camp.CampaignID,
          ArticleSlug: defaultSlug,
          ArticleTitle: camp.CampaignTitle,
          ArticleSubtitle: camp.CampaignSystem,
          ArticleCategories: ['Categoría:Expedientes'],
          ArticleContent: `## ${camp.CampaignTitle}\n\n${camp.CampaignDescription}\n\n### Expediente de Campaña\n\n- **Sistema**: ${camp.CampaignSystem}\n- **Game Master**: ${camp.CampaignGameMaster}\n- **Fecha de Inicio**: ${camp.CampaignStartDate || 'Por anunciar'}\n- **Jugadores**: ${camp.CampaignPlayerCount ?? 'TBD'}\n- **Sesiones**: ${camp.CampaignSessionCount ?? 0}\n\n> [!NOTE]\n> La documentación y crónicas de este universo se encuentran en recopilación por el Game Master.`,
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
          ArticleAliases: [camp.CampaignID, camp.CampaignSlug],
          ArticleRelatedSlugs: [],
          ArticleIsRedirect: false,
          ArticleRedirectTarget: null,
          LastModified: 'Reciente',
        },
      ];
    }

    return [];
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

      // Check if user has local custom edits (e.g. inserted PDFs from editor)
      let resolvedArticle = article;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const overrideKey = `wiki_override_${find.CampaignID}_${canonicalSlug}`;
          const saved = localStorage.getItem(overrideKey);
          if (saved) {
            resolvedArticle = {
              ...article,
              ArticleContent: saved,
              LastModified: 'Modificado por el Usuario',
            };
          }
        }
      } catch {
        // Fallback gracefully to default seed
      }

      return {
        CodeNumber: 302,
        CodeName: 'Found',
        Message: 'Article found successfully.',
        ErrorNumber: null,
        ServerName: 'local-portal',
        Result: resolvedArticle,
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
   * Lists available wiki categories for a campaign.
   */
  public static ListCategories(campaignID: string): ResponseObject<WikiCategoryBase[]> {
    try {
      let categories: WikiCategoryBase[] = [];
      if (campaignID === 'bttf') {
        categories = BTTF_CATEGORIES_SEED;
      } else if (campaignID === 'golden-21') {
        categories = GOLDEN_21_CATEGORIES_SEED;
      } else if (campaignID === 'cronicas-eones') {
        categories = EONES_CATEGORIES_SEED;
      } else {
        categories = [
          {
            CategoryID: 'categoria-expedientes',
            CategoryName: 'Categoría:Expedientes',
            ArticleCount: 1,
          },
        ];
      }

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
      return true;
    } catch {
      return false;
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
