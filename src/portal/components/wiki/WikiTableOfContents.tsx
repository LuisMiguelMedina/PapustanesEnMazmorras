import { FC, useState, useEffect } from 'react';
import { WikiHeading } from '../../models/Wiki/WikiModels';
import './WikiTableOfContents.scss';

export interface WikiTableOfContentsProps {
  headings: WikiHeading[];
}

interface NumberedHeading extends WikiHeading {
  numberPrefix: string;
}

export const WikiTableOfContents: FC<WikiTableOfContentsProps> = ({ headings }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [activeSlug, setActiveSlug] = useState<string>('');

  // Calculate hierarchical numbering (e.g., 1, 1.1, 1.2, 2, 2.1)
  const numberedHeadings: NumberedHeading[] = [];
  let h2Count = 0;
  let h3Count = 0;
  let h4Count = 0;

  for (const h of headings) {
    if (h.level === 2) {
      h2Count++;
      h3Count = 0;
      h4Count = 0;
      numberedHeadings.push({ ...h, numberPrefix: `${h2Count}` });
    } else if (h.level === 3) {
      h3Count++;
      h4Count = 0;
      const prefix = h2Count > 0 ? `${h2Count}.${h3Count}` : `${h3Count}`;
      numberedHeadings.push({ ...h, numberPrefix: prefix });
    } else {
      h4Count++;
      const prefix =
        h2Count > 0
          ? `${h2Count}.${h3Count > 0 ? h3Count : 1}.${h4Count}`
          : `${h3Count > 0 ? h3Count : 1}.${h4Count}`;
      numberedHeadings.push({ ...h, numberPrefix: prefix });
    }
  }

  // Active section tracking via IntersectionObserver or scroll position
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0.1,
      },
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.slug);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  if (headings.length < 2) {
    return null; // Don't show TOC for very short articles without sections
  }

  const handleScrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    const targetEl = document.getElementById(slug);
    if (targetEl) {
      const yOffset = -80; // Account for top navbar
      const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
      setActiveSlug(slug);
      // Update hash without jump
      window.history.pushState(null, '', `#${slug}`);
    }
  };

  return (
    <nav className="wiki-toc-box" aria-label="Tabla de Contenidos">
      <div className="toc-header">
        <div className="toc-title">
          <i className="fas fa-list-ol me-2 text-warning" />
          <span>Índice de Contenido</span>
        </div>
        <button
          type="button"
          className="btn-toggle-toc"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Mostrar índice completo' : 'Ocultar índice'}
        >
          [{isCollapsed ? 'mostrar' : 'ocultar'}]
        </button>
      </div>

      {!isCollapsed && (
        <ul className="toc-list">
          {numberedHeadings.map((h) => {
            const isActive = activeSlug === h.slug;
            return (
              <li key={h.slug} className={`toc-item level-${h.level} ${isActive ? 'active' : ''}`}>
                <a
                  href={`#${h.slug}`}
                  onClick={(e) => handleScrollToSection(e, h.slug)}
                  className="toc-link"
                >
                  <span className="toc-number">{h.numberPrefix}</span>
                  <span className="toc-label">{h.text}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
};
