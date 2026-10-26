/**
 * Pure data models for Sci-Fi Lore Wiki conforming to Constitution_Brendup.md.
 * Models contain zero methods and only define typed properties.
 */

export type WikiInfoboxType = 'CHARACTER' | 'FACTION' | 'LOCATION' | 'ORGANIZATION' | 'GENERAL';

export interface WikiInfoboxProperty {
  Key: string;
  Value: string;
  IsLink?: boolean | null;
  TargetSlug?: string | null;
}

export interface WikiInfoboxBase {
  InfoboxType: WikiInfoboxType;
  Title: string;
  ImageUrl: string | null;
  ImageCaption: string | null;
  Properties: WikiInfoboxProperty[];
}

export interface WikiArticleBase {
  ArticleID: string;
  CampaignID: string;
  ArticleSlug: string;
  ArticleTitle: string;
  ArticleSubtitle: string | null;
  ArticleCategories: string[];
  ArticleContent: string;
  ArticleInfobox: WikiInfoboxBase | null;
  ArticleAliases: string[];
  ArticleRelatedSlugs: string[];
  ArticleIsRedirect: boolean;
  ArticleRedirectTarget: string | null;
  LastModified: string | null;
}

export interface WikiArticleInsert extends WikiArticleBase {}

export interface WikiArticleUpdate extends WikiArticleBase {}

export interface WikiArticleFind {
  CampaignID: string;
  ArticleSlug: string;
}

export interface WikiArticleFilter {
  CampaignID: string;
  Category: string | null;
  SearchQuery: string | null;
}

export interface WikiCategoryBase {
  CategoryID: string;
  CategoryName: string;
  ArticleCount: number;
}

export interface WikiHeading {
  level: number;
  text: string;
  slug: string;
}

export interface WikiSearchResultMatch {
  article: WikiArticleBase;
  matchType: 'TITLE' | 'SUBTITLE' | 'TAG' | 'CONTENT';
  matchedSubtitle?: string;
  matchedSubtitleSlug?: string;
  matchedTag?: string;
  snippet?: string;
}
