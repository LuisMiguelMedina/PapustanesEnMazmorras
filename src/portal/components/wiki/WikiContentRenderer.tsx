import { FC, ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { slugify } from './wikiHelpers';
import { WikiPdfViewer } from './WikiPdfViewer';
import './WikiContentRenderer.scss';

export interface WikiContentRendererProps {
  content: string;
  campaignID: string;
  categories: string[];
  resolveSlug: (target: string) => string;
}

type RenderElement =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'pdf'; url: string; title: string; caption?: string };

export const WikiContentRenderer: FC<WikiContentRendererProps> = ({
  content,
  campaignID,
  categories,
  resolveSlug,
}) => {
  const renderedElements = useMemo<RenderElement[]>(() => {
    // 1. Clean content of infoboxes, redirects, and meta templates
    const clean = content
      .replace(/\{\{[Ii]nfobox[\s\S]*?\}\}/gi, '')
      .replace(/#REDIRECCI[OÓ]N\s*\[\[.*?\]\]/gi, '')
      .replace(/\{\{ORDENAR:.*?\}\}/gi, '')
      .replace(/<mainpage-leftcolumn-start\s*\/>/gi, '')
      .replace(/<center><inputbox>[\s\S]*?<\/inputbox><\/center>/gi, '')
      .replace(/\[\[Categor[ií]a:.*?\]\]/gi, '')
      .replace(/\[\[Category:.*?\]\]/gi, '')
      .replace(/\ufffd+/g, ' ');

    const lines = clean.split('\n');
    const elements: RenderElement[] = [];

    let inBlockquote = false;
    let blockquoteBuffer: string[] = [];

    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let currentRow: string[] = [];

    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

    const flushList = () => {
      if (currentList && currentList.items.length > 0) {
        elements.push(currentList);
        currentList = null;
      }
    };

    const flushTable = () => {
      if (currentRow.length > 0) {
        tableRows.push(currentRow);
        currentRow = [];
      }
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        elements.push({
          type: 'table',
          headers: tableHeaders,
          rows: tableRows,
        });
      }
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();

      if (!line) {
        flushList();
        continue;
      }

      // Wikitable handling: {| ... |}
      if (line.startsWith('{|')) {
        flushList();
        inTable = true;
        tableHeaders = [];
        tableRows = [];
        currentRow = [];
        continue;
      }

      if (inTable) {
        if (line.startsWith('|}')) {
          flushTable();
          continue;
        }
        if (line.startsWith('|-')) {
          if (currentRow.length > 0) {
            tableRows.push(currentRow);
            currentRow = [];
          }
          continue;
        }
        if (line.startsWith('!')) {
          const headerText = line.substring(1).trim();
          const headers = headerText.split('!!').map((h) => h.trim());
          tableHeaders.push(...headers);
          continue;
        }
        if (line.startsWith('|')) {
          const cellText = line.substring(1).trim();
          const cells = cellText.split('||').map((c) => c.trim());
          currentRow.push(...cells);
          continue;
        }
        continue;
      }

      // Markdown Table handling: | Col | Col |
      if (line.startsWith('|') && line.endsWith('|') && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (/^\|(?:\s*[:-]+[-| :]*)\|$/.test(nextLine)) {
          flushList();
          const headers = line
            .slice(1, -1)
            .split('|')
            .map((h) => h.trim());
          const rows: string[][] = [];
          i += 1; // skip separator line
          while (
            i + 1 < lines.length &&
            lines[i + 1].trim().startsWith('|') &&
            lines[i + 1].trim().endsWith('|')
          ) {
            i += 1;
            const rowLine = lines[i].trim();
            const cells = rowLine
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());
            rows.push(cells);
          }
          elements.push({
            type: 'table',
            headers,
            rows,
          });
          continue;
        }
      }

      // Blockquote handling: <blockquote>...</blockquote>
      if (line.toLowerCase().includes('<blockquote>') || inBlockquote) {
        flushList();
        if (!inBlockquote) {
          inBlockquote = true;
        }
        const stripped = line.replace(/<\/?blockquote>/gi, '').trim();
        if (stripped) {
          blockquoteBuffer.push(stripped);
        }
        if (line.toLowerCase().includes('</blockquote>')) {
          inBlockquote = false;
          elements.push({ type: 'blockquote', text: blockquoteBuffer.join(' ') });
          blockquoteBuffer = [];
        }
        continue;
      }

      // Markdown blockquote: > quote
      if (line.startsWith('>')) {
        flushList();
        elements.push({ type: 'blockquote', text: line.replace(/^>\s*/, '').trim() });
        continue;
      }

      // Bullet lists: *, -
      if (/^[\*\-]\s+/.test(line)) {
        const itemText = line.replace(/^[\*\-]\s+/, '').trim();
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [itemText] };
        } else {
          currentList.items.push(itemText);
        }
        continue;
      }

      // Numbered/Roman lists: I. or 1.
      if (/^([0-9]+\.|[IVXLCDM]+\.)\s+/.test(line) && !/^\d+\.\d+/.test(line)) {
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [line] };
        } else {
          currentList.items.push(line);
        }
        continue;
      }

      flushList();

      // PDF Embed Directives: {{PDF|url|title|caption}} or {{pdf|url|title}}
      const pdfTemplateMatch = line.match(/^\{\{pdf\|(.*?)\}\}$/i);
      if (pdfTemplateMatch) {
        const parts = pdfTemplateMatch[1].split('|').map((s) => s.trim());
        const pdfUrl = parts[0] || '';
        const pdfTitle = parts[1] || '';
        const pdfCaption = parts[2] || undefined;
        if (pdfUrl) {
          elements.push({ type: 'pdf', url: pdfUrl, title: pdfTitle, caption: pdfCaption });
          continue;
        }
      }

      // Custom bracket format: [pdf:url title]
      const bracketPdfMatch = line.match(/^\[pdf:(\S+)(?:\s+(.*?))?\]$/i);
      if (bracketPdfMatch) {
        elements.push({
          type: 'pdf',
          url: bracketPdfMatch[1].trim(),
          title: bracketPdfMatch[2]?.trim() || '',
        });
        continue;
      }

      // Standalone markdown link to .pdf: [Title](url.pdf)
      const mdPdfMatch = line.match(/^\[(.*?)\]\(((?:https?:\/\/|\/|\w)[^)]*?\.pdf(?:\?[^)]*)?)\)$/i);
      if (mdPdfMatch) {
        elements.push({
          type: 'pdf',
          url: mdPdfMatch[2].trim(),
          title: mdPdfMatch[1].trim(),
        });
        continue;
      }

      // Headings
      if (line.startsWith('====') && line.endsWith('====')) {
        elements.push({ type: 'h4', text: line.replace(/====/g, '').trim() });
      } else if (line.startsWith('===') && line.endsWith('===')) {
        elements.push({ type: 'h3', text: line.replace(/===/g, '').trim() });
      } else if (line.startsWith('==') && line.endsWith('==')) {
        elements.push({ type: 'h2', text: line.replace(/==/g, '').trim() });
      } else if (line.startsWith('#### ')) {
        elements.push({ type: 'h4', text: line.substring(5).trim() });
      } else if (line.startsWith('### ')) {
        elements.push({ type: 'h3', text: line.substring(4).trim() });
      } else if (line.startsWith('## ')) {
        elements.push({ type: 'h2', text: line.substring(3).trim() });
      } else if (line.startsWith('# ')) {
        elements.push({ type: 'h2', text: line.substring(2).trim() });
      } else if (/^\d+\.\d+\.\d+\.?\s+[A-Za-z0-9]/.test(line)) {
        elements.push({ type: 'h4', text: line.trim() });
      } else if (/^\d+\.\d+\.?\s+[A-Za-z0-9]/.test(line)) {
        elements.push({ type: 'h3', text: line.trim() });
      } else if (/^\d+\.\s+[A-Z]/.test(line) && line.length < 80) {
        elements.push({ type: 'h2', text: line.trim() });
      } else {
        elements.push({ type: 'p', text: line });
      }
    }

    flushList();
    if (inTable) flushTable();

    return elements;
  }, [content]);

  // Helper to parse formatting (bold, italic, wiki links, code, spans, line breaks) in text
  const parseInlineMarkup = (text: string): ReactNode => {
    const tokenRegex =
      /(\[\[(?:[^\]|]+)(?:\|[^\]]+)?\]\]|<span\s+style="[^"]*">.*?<\/span>|`[^`]+`|'''[\s\S]+?'''|\*\*[\s\S]+?\*\*|''[\s\S]+?''|\*(?!\s)[\s\S]+?(?<!\s)\*|<br\s*\/?>)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const nodes: ReactNode[] = [];
    let keyIdx = 0;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.substring(lastIndex, match.index));
      }

      const token = match[0];
      if (token.startsWith('[[')) {
        const inner = token.substring(2, token.length - 2);
        const parts = inner.split('|');
        const targetRaw = parts[0].trim();
        const label = parts[1] ? parts[1].trim() : targetRaw;
        const targetSlug = resolveSlug(slugify(targetRaw));
        nodes.push(
          <Link
            key={`link-${keyIdx++}`}
            to={`/wiki/${campaignID}/${targetSlug}`}
            className="wiki-internal-link"
          >
            {label}
          </Link>,
        );
      } else if (token.startsWith('<span')) {
        const colorMatch = /color:\s*([^;"]+)/i.exec(token);
        const contentMatch = />(.*?)<\/span>/i.exec(token);
        const color = colorMatch ? colorMatch[1].trim() : undefined;
        const innerContent = contentMatch ? contentMatch[1] : '';
        nodes.push(
          <span
            key={`span-${keyIdx++}`}
            style={color ? { color, fontWeight: 600 } : undefined}
          >
            {parseInlineMarkup(innerContent)}
          </span>,
        );
      } else if (token.startsWith('`')) {
        nodes.push(
          <code key={`code-${keyIdx++}`} className="wiki-inline-code">
            {token.substring(1, token.length - 1)}
          </code>,
        );
      } else if (token.startsWith("'''")) {
        nodes.push(
          <strong key={`bold-${keyIdx++}`}>
            {token.substring(3, token.length - 3)}
          </strong>,
        );
      } else if (token.startsWith('**')) {
        nodes.push(
          <strong key={`bold-${keyIdx++}`}>
            {token.substring(2, token.length - 2)}
          </strong>,
        );
      } else if (token.startsWith("''")) {
        nodes.push(
          <em key={`italic-${keyIdx++}`}>
            {token.substring(2, token.length - 2)}
          </em>,
        );
      } else if (token.startsWith('*')) {
        nodes.push(
          <em key={`italic-${keyIdx++}`}>
            {token.substring(1, token.length - 1)}
          </em>,
        );
      } else if (/^<br\s*\/?>$/i.test(token)) {
        nodes.push(<br key={`br-${keyIdx++}`} />);
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      nodes.push(text.substring(lastIndex));
    }

    return nodes;
  };

  return (
    <article className="wiki-rendered-content">
      {renderedElements.map((el, index) => {
        switch (el.type) {
          case 'h2': {
            const cleanText = el.text.replace(/['*]/g, '').trim();
            const headingSlug = slugify(cleanText);
            return (
              <h2 key={index} id={headingSlug} className="wiki-heading wiki-heading-h2">
                <a href={`#${headingSlug}`} className="heading-anchor" aria-hidden="true" title="Enlace directo a esta sección">
                  #
                </a>
                <span>{parseInlineMarkup(el.text)}</span>
              </h2>
            );
          }
          case 'h3': {
            const cleanText = el.text.replace(/['*]/g, '').trim();
            const headingSlug = slugify(cleanText);
            return (
              <h3 key={index} id={headingSlug} className="wiki-heading wiki-heading-h3">
                <a href={`#${headingSlug}`} className="heading-anchor" aria-hidden="true" title="Enlace directo a esta sección">
                  #
                </a>
                <span>{parseInlineMarkup(el.text)}</span>
              </h3>
            );
          }
          case 'h4': {
            const cleanText = el.text.replace(/['*]/g, '').trim();
            const headingSlug = slugify(cleanText);
            return (
              <h4 key={index} id={headingSlug} className="wiki-heading wiki-heading-h4">
                <a href={`#${headingSlug}`} className="heading-anchor" aria-hidden="true" title="Enlace directo a esta sección">
                  #
                </a>
                <span>{parseInlineMarkup(el.text)}</span>
              </h4>
            );
          }
          case 'blockquote':
            return <blockquote key={index}>{parseInlineMarkup(el.text)}</blockquote>;
          case 'ul':
            return (
              <ul key={index}>
                {el.items.map((item, iIdx) => (
                  <li key={iIdx}>{parseInlineMarkup(item)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={index}>
                {el.items.map((item, iIdx) => (
                  <li key={iIdx}>{parseInlineMarkup(item)}</li>
                ))}
              </ol>
            );
          case 'table':
            return (
              <div key={index} className="wiki-table-container">
                <table className="wiki-table">
                  {el.headers.length > 0 && (
                    <thead>
                      <tr>
                        {el.headers.map((h, hi) => (
                          <th key={hi}>{parseInlineMarkup(h)}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {el.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{parseInlineMarkup(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'pdf':
            return (
              <WikiPdfViewer
                key={index}
                url={el.url}
                title={el.title}
                caption={el.caption}
              />
            );
          case 'p':
          default:
            return <p key={index}>{parseInlineMarkup(el.text)}</p>;
        }
      })}

      {categories.length > 0 && (
        <div className="wiki-category-tags">
          <span className="tag-title">
            <i className="fas fa-tags me-1" />
            Categorías:
          </span>
          {categories.map((cat) => (
            <span key={cat} className="category-badge">
              {cat}
            </span>
          ))}
        </div>
      )}
    </article>
  );
};
