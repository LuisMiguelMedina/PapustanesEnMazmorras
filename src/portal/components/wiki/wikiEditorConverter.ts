/**
 * Two-way converter between Wiki Markdown and Visual Rich HTML for the Wiki Editor,
 * emulating Wikifandom's Visual Editor and Source Markdown Editor modes.
 *
 * Markdown is always the canonical storage format; Visual HTML provides a
 * user-friendly WYSIWYG editing experience that automatically serializes to Markdown.
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parses inline markdown tags (bold, italic, strikethrough, code, wiki links) into HTML.
 */
export function inlineMarkdownToHtml(text: string): string {
  let res = escapeHtml(text);

  // Wiki Links: [[Target|Label]] and [[Target]]
  res = res.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const cleanTarget = target.trim();
    const cleanLabel = (label || target).trim();
    return `<a class="visual-wiki-link" data-wiki-target="${cleanTarget}" href="#wiki-${cleanTarget}">${cleanLabel}</a>`;
  });

  // Bold: '''text''' or **text**
  res = res.replace(/'''([\s\S]+?)'''/g, '<strong>$1</strong>');
  res = res.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');

  // Italic: ''text'' or *text*
  res = res.replace(/''([\s\S]+?)''/g, '<em>$1</em>');
  res = res.replace(/(^|[^\*])\*([^\*\n]+?)\*([^\*]|$)/g, '$1<em>$2</em>$3');

  // Strikethrough: ~~text~~
  res = res.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');

  // Inline code: `code`
  res = res.replace(/`([^`]+)`/g, '<code>$1</code>');

  return res;
}

/**
 * Converts Wiki Markdown into formatted Visual HTML for the rich text editor.
 */
export function markdownToVisualHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) {
    return '<p><br></p>';
  }

  const lines = markdown.split('\n');
  const htmlParts: string[] = [];

  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
  let blockquoteLines: string[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const closeList = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlParts.push('</ol>');
      inOl = false;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      htmlParts.push(`<blockquote><p>${blockquoteLines.join(' ')}</p></blockquote>`);
      inBlockquote = false;
      blockquoteLines = [];
    }
  };

  const closeTable = () => {
    if (inTable) {
      let tableHtml = '<table class="visual-editor-table"><thead><tr>';
      tableHeaders.forEach((h) => {
        tableHtml += `<th>${inlineMarkdownToHtml(h)}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';
      tableRows.forEach((row) => {
        tableHtml += '<tr>';
        row.forEach((cell) => {
          tableHtml += `<td>${inlineMarkdownToHtml(cell)}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';
      htmlParts.push(tableHtml);
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      closeList();
      closeBlockquote();
      closeTable();
      continue;
    }

    // PDF Widget Directive: {{PDF|url|title|caption}} or {{pdf|...}}
    const pdfMatch = line.match(/^\{\{pdf\|(.*?)\}\}$/i);
    if (pdfMatch) {
      closeList();
      closeBlockquote();
      closeTable();
      const parts = pdfMatch[1].split('|').map((s) => s.trim());
      const url = parts[0] || '';
      const title = parts[1] || 'Documento PDF';
      const caption = parts[2] || '';
      htmlParts.push(
        `<div class="visual-pdf-block" data-pdf-url="${escapeHtml(url)}" data-pdf-title="${escapeHtml(title)}" data-pdf-caption="${escapeHtml(caption)}" contenteditable="false"><div class="visual-pdf-header"><span class="visual-adobe-badge"><i class="fas fa-file-pdf"></i></span><div class="visual-pdf-info"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(url)}</small></div><span class="visual-pdf-action-pill"><i class="fas fa-expand me-1"></i> Lector Interactivo</span></div>${caption ? `<div class="visual-pdf-caption">${escapeHtml(caption)}</div>` : ''}</div><p><br></p>`,
      );
      continue;
    }

    // Bracket format: [pdf:url title]
    const bracketPdf = line.match(/^\[pdf:(\S+)(?:\s+(.*?))?\]$/i);
    if (bracketPdf) {
      closeList();
      closeBlockquote();
      closeTable();
      const url = bracketPdf[1].trim();
      const title = bracketPdf[2]?.trim() || 'Documento PDF';
      htmlParts.push(
        `<div class="visual-pdf-block" data-pdf-url="${escapeHtml(url)}" data-pdf-title="${escapeHtml(title)}" data-pdf-caption="" contenteditable="false"><div class="visual-pdf-header"><span class="visual-adobe-badge"><i class="fas fa-file-pdf"></i></span><div class="visual-pdf-info"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(url)}</small></div><span class="visual-pdf-action-pill"><i class="fas fa-expand me-1"></i> Lector Interactivo</span></div></div><p><br></p>`,
      );
      continue;
    }

    // Markdown Tables: | Col | Col |
    if (line.startsWith('|') && line.endsWith('|')) {
      closeList();
      closeBlockquote();
      if (!inTable) {
        if (i + 1 < lines.length && /^\|(?:\s*[:-]+[-| :]*)\|$/.test(lines[i + 1].trim())) {
          inTable = true;
          tableHeaders = line
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          i += 1; // skip divider
          continue;
        }
      } else {
        const rowCells = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        tableRows.push(rowCells);
        continue;
      }
    }

    // Headings
    if (line.startsWith('====') && line.endsWith('====')) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h4>${inlineMarkdownToHtml(line.replace(/====/g, '').trim())}</h4>`);
      continue;
    }
    if (line.startsWith('===') && line.endsWith('===')) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h3>${inlineMarkdownToHtml(line.replace(/===/g, '').trim())}</h3>`);
      continue;
    }
    if (line.startsWith('==') && line.endsWith('==')) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h2>${inlineMarkdownToHtml(line.replace(/==/g, '').trim())}</h2>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h4>${inlineMarkdownToHtml(line.substring(5).trim())}</h4>`);
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h3>${inlineMarkdownToHtml(line.substring(4).trim())}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h2>${inlineMarkdownToHtml(line.substring(3).trim())}</h2>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      closeList();
      closeTable();
      const quoteText = line.replace(/^>\s*/, '').trim();
      inBlockquote = true;
      blockquoteLines.push(inlineMarkdownToHtml(quoteText));
      continue;
    }
    if (line.toLowerCase().startsWith('<blockquote>')) {
      closeList();
      closeTable();
      inBlockquote = true;
      const stripped = line.replace(/<\/?blockquote>/gi, '').trim();
      if (stripped) blockquoteLines.push(inlineMarkdownToHtml(stripped));
      continue;
    }
    if (inBlockquote) {
      if (line.toLowerCase().includes('</blockquote>')) {
        const stripped = line.replace(/<\/?blockquote>/gi, '').trim();
        if (stripped) blockquoteLines.push(inlineMarkdownToHtml(stripped));
        closeBlockquote();
      } else {
        blockquoteLines.push(inlineMarkdownToHtml(line));
      }
      continue;
    }

    // Bullet list
    if (/^[\*\-]\s+/.test(line)) {
      closeBlockquote();
      closeTable();
      if (!inUl) {
        closeList();
        inUl = true;
        htmlParts.push('<ul>');
      }
      const itemText = line.replace(/^[\*\-]\s+/, '').trim();
      htmlParts.push(`<li>${inlineMarkdownToHtml(itemText)}</li>`);
      continue;
    }

    // Numbered list
    if (/^\d+[\.\)]\s+/.test(line)) {
      closeBlockquote();
      closeTable();
      if (!inOl) {
        closeList();
        inOl = true;
        htmlParts.push('<ol>');
      }
      const itemText = line.replace(/^\d+[\.\)]\s+/, '').trim();
      htmlParts.push(`<li>${inlineMarkdownToHtml(itemText)}</li>`);
      continue;
    }

    // Paragraph
    closeList();
    closeBlockquote();
    closeTable();
    htmlParts.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
  }

  closeList();
  closeBlockquote();
  closeTable();

  return htmlParts.join('\n');
}

/**
 * Converts Visual HTML back into clean Wiki Markdown.
 */
export function visualHtmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toUpperCase();

    // Check if it's our PDF Widget Block
    if (el.classList.contains('visual-pdf-block') || el.hasAttribute('data-pdf-url')) {
      const url = el.getAttribute('data-pdf-url') || '';
      const title = el.getAttribute('data-pdf-title') || 'Documento PDF';
      const caption = el.getAttribute('data-pdf-caption') || '';
      return caption
        ? `\n\n{{PDF|${url}|${title}|${caption}}}\n\n`
        : `\n\n{{PDF|${url}|${title}}}\n\n`;
    }

    // Wiki Link
    if (tagName === 'A' && el.hasAttribute('data-wiki-target')) {
      const target = el.getAttribute('data-wiki-target') || '';
      const label = el.textContent?.trim() || target;
      if (target === label) {
        return `[[${target}]]`;
      }
      return `[[${target}|${label}]]`;
    }

    // Inline formatting
    if (tagName === 'STRONG' || tagName === 'B') {
      const inner = Array.from(el.childNodes).map(processNode).join('');
      return inner.trim() ? `**${inner}**` : '';
    }
    if (tagName === 'EM' || tagName === 'I') {
      const inner = Array.from(el.childNodes).map(processNode).join('');
      return inner.trim() ? `*${inner}*` : '';
    }
    if (tagName === 'DEL' || tagName === 'S') {
      const inner = Array.from(el.childNodes).map(processNode).join('');
      return inner.trim() ? `~~${inner}~~` : '';
    }
    if (tagName === 'CODE') {
      return `\`${el.textContent || ''}\``;
    }

    // Headings
    if (tagName === 'H1' || tagName === 'H2') {
      const text = Array.from(el.childNodes).map(processNode).join('').trim();
      return text ? `\n\n== ${text} ==\n\n` : '';
    }
    if (tagName === 'H3') {
      const text = Array.from(el.childNodes).map(processNode).join('').trim();
      return text ? `\n\n=== ${text} ===\n\n` : '';
    }
    if (tagName === 'H4') {
      const text = Array.from(el.childNodes).map(processNode).join('').trim();
      return text ? `\n\n==== ${text} ====\n\n` : '';
    }

    // Blockquote
    if (tagName === 'BLOCKQUOTE') {
      const text = Array.from(el.childNodes).map(processNode).join('').trim();
      return text ? `\n\n> ${text.replace(/\n+/g, '\n> ')}\n\n` : '';
    }

    // Lists
    if (tagName === 'UL') {
      const items = Array.from(el.querySelectorAll(':scope > li')).map(
        (li) => `* ${Array.from(li.childNodes).map(processNode).join('').trim()}`,
      );
      return items.length > 0 ? `\n\n${items.join('\n')}\n\n` : '';
    }
    if (tagName === 'OL') {
      const items = Array.from(el.querySelectorAll(':scope > li')).map(
        (li, idx) => `${idx + 1}. ${Array.from(li.childNodes).map(processNode).join('').trim()}`,
      );
      return items.length > 0 ? `\n\n${items.join('\n')}\n\n` : '';
    }

    // Tables
    if (tagName === 'TABLE') {
      const headers = Array.from(el.querySelectorAll('th')).map(
        (th) => th.textContent?.trim() || '',
      );
      const trs = Array.from(el.querySelectorAll('tbody tr'));
      if (headers.length === 0 && trs.length === 0) return '';
      let mdTable = '\n\n';
      if (headers.length > 0) {
        mdTable += `| ${headers.join(' | ')} |\n`;
        mdTable += `| ${headers.map(() => '---').join(' | ')} |\n`;
      }
      trs.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('td')).map(
          (td) => td.textContent?.trim() || '',
        );
        mdTable += `| ${cells.join(' | ')} |\n`;
      });
      return `${mdTable}\n`;
    }

    // Paragraphs / Divs
    if (tagName === 'P' || tagName === 'DIV') {
      const content = Array.from(el.childNodes).map(processNode).join('').trim();
      return content ? `\n\n${content}\n\n` : '';
    }

    if (tagName === 'BR') {
      return '\n';
    }

    // Default: process children
    return Array.from(el.childNodes).map(processNode).join('');
  };

  const rawMd = Array.from(body.childNodes).map(processNode).join('');
  return rawMd
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
