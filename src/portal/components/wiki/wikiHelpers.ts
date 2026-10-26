import { WikiArticleBase, WikiHeading, WikiSearchResultMatch } from '../../models/Wiki/WikiModels';

/**
 * Normalizes text into a URL and anchor friendly slug.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Cleans wiki-specific and markdown markup from text to produce human-readable plain text.
 */
export function cleanWikiMarkup(text: string): string {
  return text
    .replace(/\{\{[Ii]nfobox[\s\S]*?\}\}/gi, '')
    .replace(/#REDIRECCI[OÓ]N\s*\[\[.*?\]\]/gi, '')
    .replace(/\{\{ORDENAR:.*?\}\}/gi, '')
    .replace(/\{\{TagHSR\|(.*?)\|(.*?)\}\}/gi, '$2')
    .replace(/\{\{.*?\}\}/gi, '')
    .replace(/<mainpage-leftcolumn-start\s*\/>/gi, '')
    .replace(/<center><inputbox>[\s\S]*?<\/inputbox><\/center>/gi, '')
    .replace(/\[\[Categor[ií]a:.*?\]\]/gi, '')
    .replace(/\[\[Category:.*?\]\]/gi, '')
    .replace(/\[\[(?:[^\]|]+)\|([^\]]+)\]\]/gi, '$1')
    .replace(/\[\[([^\]]+)\]\]/gi, '$1')
    .replace(/<[^>]+>/gi, ' ')
    .replace(/====(.*?)====/gi, '$1')
    .replace(/===(.*?)===/gi, '$1')
    .replace(/==(.*?)==/gi, '$1')
    .replace(/####\s+/g, '')
    .replace(/###\s+/g, '')
    .replace(/##\s+/g, '')
    .replace(/#\s+/g, '')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/\*\*/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\|.*\|/g, '')
    .replace(/\ufffd+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts hierarchical section headings from wiki article markdown content.
 */
export function extractHeadings(content: string): WikiHeading[] {
  const lines = content.split('\n');
  const headings: WikiHeading[] = [];
  const seenSlugs = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let level = 0;
    let headingText = '';

    if (line.startsWith('====') && line.endsWith('====')) {
      level = 4;
      headingText = line.replace(/====/g, '').trim();
    } else if (line.startsWith('===') && line.endsWith('===')) {
      level = 3;
      headingText = line.replace(/===/g, '').trim();
    } else if (line.startsWith('==') && line.endsWith('==')) {
      level = 2;
      headingText = line.replace(/==/g, '').trim();
    } else if (line.startsWith('#### ')) {
      level = 4;
      headingText = line.substring(5).trim();
    } else if (line.startsWith('### ')) {
      level = 3;
      headingText = line.substring(4).trim();
    } else if (line.startsWith('## ')) {
      level = 2;
      headingText = line.substring(3).trim();
    } else if (/^\d+\.\d+\.\d+\.?\s+[A-Za-z0-9]/.test(line)) {
      level = 4;
      headingText = line.trim();
    } else if (/^\d+\.\d+\.?\s+[A-Za-z0-9]/.test(line)) {
      level = 3;
      headingText = line.trim();
    } else if (/^\d+\.\s+[A-Z]/.test(line) && line.length < 80) {
      level = 2;
      headingText = line.trim();
    }

    if (level >= 2 && headingText) {
      // Clean inline formatting in heading text like ''' or **
      const cleanText = headingText.replace(/['*]/g, '').trim();
      let slug = slugify(cleanText);
      if (!slug) slug = `seccion-${headings.length + 1}`;

      // Avoid duplicate slugs
      if (seenSlugs.has(slug)) {
        let counter = 2;
        while (seenSlugs.has(`${slug}-${counter}`)) {
          counter++;
        }
        slug = `${slug}-${counter}`;
      }
      seenSlugs.add(slug);

      headings.push({
        level,
        text: cleanText,
        slug,
      });
    }
  }

  return headings;
}

/**
 * Generates a clean text excerpt for card previews or search snippets.
 */
export function generateExcerpt(content: string, maxLength: number = 180): string {
  const plain = cleanWikiMarkup(content);
  if (!plain) return 'Expediente clasificado de la base de datos de lore.';
  if (plain.length <= maxLength) return plain;
  return plain.substring(0, maxLength).trim() + '…';
}

/**
 * Finds a relevant snippet in article content matching the query term.
 */
export function findSnippetContext(content: string, query: string, snippetLength: number = 140): string {
  const plain = cleanWikiMarkup(content);
  const lowerPlain = plain.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const idx = lowerPlain.indexOf(lowerQuery);

  if (idx === -1) {
    return generateExcerpt(content, snippetLength);
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(plain.length, idx + query.length + snippetLength - 40);
  let snippet = plain.substring(start, end).trim();

  if (start > 0) snippet = '…' + snippet;
  if (end < plain.length) snippet = snippet + '…';

  return snippet;
}

/**
 * Advanced multi-target search across article titles, section subtitles, categories/tags, and content.
 */
export function searchWikiArticles(
  articles: WikiArticleBase[],
  rawQuery: string,
  categoryFilter?: string | null,
): WikiSearchResultMatch[] {
  let list = articles.filter((a) => !a.ArticleIsRedirect);

  if (categoryFilter) {
    const cf = categoryFilter.toLowerCase();
    list = list.filter((a) => a.ArticleCategories.some((c) => c.toLowerCase().includes(cf)));
  }

  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return list.map((article) => ({
      article,
      matchType: 'TITLE',
      snippet: generateExcerpt(article.ArticleContent, 160),
    }));
  }

  const matches: WikiSearchResultMatch[] = [];

  for (const article of list) {
    const titleLower = article.ArticleTitle.toLowerCase();
    const aliasMatch = article.ArticleAliases.some((al) => al.toLowerCase().includes(query));

    // 1. Title or Alias match
    if (titleLower.includes(query) || aliasMatch) {
      matches.push({
        article,
        matchType: 'TITLE',
        snippet: generateExcerpt(article.ArticleContent, 160),
      });
      continue;
    }

    // 2. Subtitle / Section Heading match
    const headings = extractHeadings(article.ArticleContent);
    const matchedHeading = headings.find((h) => h.text.toLowerCase().includes(query));
    if (matchedHeading) {
      matches.push({
        article,
        matchType: 'SUBTITLE',
        matchedSubtitle: matchedHeading.text,
        matchedSubtitleSlug: matchedHeading.slug,
        snippet: findSnippetContext(article.ArticleContent, query, 140),
      });
      continue;
    }

    // 3. Category / Tag match
    const matchedCategory = article.ArticleCategories.find((cat) => cat.toLowerCase().includes(query));
    if (matchedCategory) {
      matches.push({
        article,
        matchType: 'TAG',
        matchedTag: matchedCategory,
        snippet: generateExcerpt(article.ArticleContent, 160),
      });
      continue;
    }

    // 4. Content match
    if (article.ArticleContent.toLowerCase().includes(query)) {
      matches.push({
        article,
        matchType: 'CONTENT',
        snippet: findSnippetContext(article.ArticleContent, query, 150),
      });
    }
  }

  // Sort matches: TITLE first, then SUBTITLE, then TAG, then CONTENT
  const scoreMap = { TITLE: 4, SUBTITLE: 3, TAG: 2, CONTENT: 1 };
  return matches.sort((a, b) => scoreMap[b.matchType] - scoreMap[a.matchType]);
}
