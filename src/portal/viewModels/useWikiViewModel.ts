/**
 * ViewModel for Sci-Fi Lore Wiki conforming to Constitution_Brendup.md MVVM architecture.
 * Encapsulates presentation logic, consumes WikiDataAccess & CampaignDataAccess,
 * exposes reactive state and actions for categories, articles, search, and navigation.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CampaignDataAccess } from '../dataAccess/CampaignDataAccess';
import { WikiDataAccess } from '../dataAccess/WikiDataAccess';
import { CampaignBase } from '../models/Campaigns/CampaignModels';
import { WikiArticleBase, WikiCategoryBase } from '../models/Wiki/WikiModels';

export interface WikiViewModelResult {
  campaign: CampaignBase | null;
  categories: WikiCategoryBase[];
  articles: WikiArticleBase[];
  currentArticle: WikiArticleBase | null;
  selectedCategory: string | null;
  searchQuery: string;
  searchResults: WikiArticleBase[];
  isLoading: boolean;
  errorMessage: string | null;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  resolveCanonicalSlug: (slugOrAlias: string) => string;
  refresh: () => void;
}

export function useWikiViewModel(
  campaignID: string = 'bttf',
  activeSlug?: string | null,
): WikiViewModelResult {
  const [campaign, setCampaign] = useState<CampaignBase | null>(null);
  const [categories, setCategories] = useState<WikiCategoryBase[]>([]);
  const [articles, setArticles] = useState<WikiArticleBase[]>([]);
  const [currentArticle, setCurrentArticle] = useState<WikiArticleBase | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCategories = useCallback(() => {
    const catRes = WikiDataAccess.ListCategories(campaignID);
    if (catRes.CodeNumber === 200 && catRes.Result) {
      setCategories(catRes.Result);
    } else {
      setCategories([]);
    }
  }, [campaignID]);

  // Load campaign and categories once per campaignID
  useEffect(() => {
    const campRes = CampaignDataAccess.Find({ CampaignID: campaignID });
    if (campRes.CodeNumber === 302 && campRes.Result) {
      setCampaign(campRes.Result);
    } else {
      setCampaign(null);
    }

    fetchCategories();
  }, [campaignID, fetchCategories]);

  // Load articles list according to category filter
  const fetchArticles = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);

    const artRes = WikiDataAccess.List({
      CampaignID: campaignID,
      Category: selectedCategory,
      SearchQuery: null,
    });

    if (artRes.CodeNumber === 200 && artRes.Result) {
      setArticles(artRes.Result);
    } else {
      setArticles([]);
      setErrorMessage(artRes.Message || 'No se pudieron cargar los artículos.');
    }

    setIsLoading(false);
  }, [campaignID, selectedCategory]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleRefresh = useCallback(() => {
    fetchArticles();
    fetchCategories();
  }, [fetchArticles, fetchCategories]);

  // Resolve and load active article
  useEffect(() => {
    if (!activeSlug || activeSlug === 'home') {
      setCurrentArticle(null);
      setErrorMessage(null);
      return;
    }

    const findRes = WikiDataAccess.Find({ CampaignID: campaignID, ArticleSlug: activeSlug });
    if (findRes.CodeNumber === 302 && findRes.Result) {
      setCurrentArticle(findRes.Result);
      setErrorMessage(null);
    } else {
      setCurrentArticle(null);
      setErrorMessage(`El artículo '${activeSlug}' no existe en la base de datos.`);
    }
  }, [campaignID, activeSlug]);

  // Search results computed via DataAccess
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      return [];
    }
    const res = WikiDataAccess.List({
      CampaignID: campaignID,
      Category: null,
      SearchQuery: searchQuery,
    });
    return res.CodeNumber === 200 && res.Result ? res.Result : [];
  }, [campaignID, searchQuery]);

  const resolveCanonicalSlug = useCallback(
    (slugOrAlias: string) => {
      return WikiDataAccess.ResolveAlias(campaignID, slugOrAlias);
    },
    [campaignID],
  );

  return {
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
    refresh: handleRefresh,
  };
}
