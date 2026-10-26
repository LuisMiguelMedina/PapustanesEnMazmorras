import { FC, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cleanWikiMarkup } from './wikiHelpers';
import './WikiAudioNarrator.scss';

export interface WikiAudioNarratorProps {
  content: string;
  articleTitle: string;
  onActiveIndexChange?: (index: number | null) => void;
}

export interface NarratorSegment {
  id: string;
  type: 'title' | 'heading' | 'paragraph' | 'quote';
  rawText: string;
  speechText: string;
}

/**
 * Parses article markdown into clean narrative segments suitable for TTS audio book reading,
 * strictly omitting technical infoboxes, name-value columns, data tables, metadata, and HTML widgets.
 */
export function extractNarrativeSegments(content: string, articleTitle: string): NarratorSegment[] {
  const segments: NarratorSegment[] = [];

  // Add the article title as the opening announcement
  segments.push({
    id: 'seg-title',
    type: 'title',
    rawText: articleTitle,
    speechText: `${articleTitle}.`,
  });

  // 1. Remove infoboxes, redirections, and sorting directives
  let clean = content
    .replace(/\{\{[Ii]nfobox[\s\S]*?\}\}/gi, '')
    .replace(/#REDIRECCI[OÓ]N\s*\[\[.*?\]\]/gi, '')
    .replace(/\{\{ORDENAR:.*?\}\}/gi, '')
    .replace(/<mainpage-leftcolumn-start\s*\/>/gi, '')
    .replace(/<center><inputbox>[\s\S]*?<\/inputbox><\/center>/gi, '')
    .replace(/\[\[Categor[ií]a:.*?\]\]/gi, '')
    .replace(/\[\[Category:.*?\]\]/gi, '')
    .replace(/<div\s+style="[^"]*">[\s\S]*?<\/div>/gi, '') // remove HTML tag boxes & columns
    .replace(/<tabber>[\s\S]*?<\/tabber>/gi, ''); // remove tabber metadata

  const lines = clean.split('\n');
  let inTable = false;
  let inBlockquote = false;
  let blockquoteBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    // Skip wikitables ({| ... |}) and markdown tables (| Col | Col |)
    if (line.startsWith('{|')) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (line.startsWith('|}')) {
        inTable = false;
      }
      continue;
    }
    if (line.startsWith('|') && line.endsWith('|')) {
      continue;
    }

    // Skip technical key-value properties (e.g. "TIPO: Campaña", "SISTEMA: D&D 5E")
    if (/^[A-ZÁÉÍÓÚ\s]{3,20}:\s+[^\n]{1,60}$/.test(line)) {
      continue;
    }

    // Skip PDF widget directives and raw links
    if (
      /^\{\{pdf\|/i.test(line) ||
      /^\[pdf:/i.test(line) ||
      /^\[.*?\]\(.*?\.pdf(?:\?.*?)?\)$/i.test(line)
    ) {
      continue;
    }

    // Blockquote handling
    if (line.toLowerCase().includes('<blockquote>') || inBlockquote) {
      if (!inBlockquote) inBlockquote = true;
      const stripped = line.replace(/<\/?blockquote>/gi, '').trim();
      if (stripped) blockquoteBuffer.push(stripped);
      if (line.toLowerCase().includes('</blockquote>')) {
        inBlockquote = false;
        const quoteText = cleanWikiMarkup(blockquoteBuffer.join(' '));
        if (quoteText.length > 10) {
          segments.push({
            id: `seg-quote-${segments.length}`,
            type: 'quote',
            rawText: blockquoteBuffer.join(' '),
            speechText: quoteText,
          });
        }
        blockquoteBuffer = [];
      }
      continue;
    }

    if (line.startsWith('>')) {
      const quoteText = cleanWikiMarkup(line.replace(/^>\s*/, '').trim());
      if (quoteText.length > 8) {
        segments.push({
          id: `seg-quote-${segments.length}`,
          type: 'quote',
          rawText: line,
          speechText: quoteText,
        });
      }
      continue;
    }

    // Headings: Announce sections naturally
    let headingText = '';
    if (line.startsWith('====') && line.endsWith('====')) {
      headingText = line.replace(/====/g, '').trim();
    } else if (line.startsWith('===') && line.endsWith('===')) {
      headingText = line.replace(/===/g, '').trim();
    } else if (line.startsWith('==') && line.endsWith('==')) {
      headingText = line.replace(/==/g, '').trim();
    } else if (line.startsWith('#### ')) {
      headingText = line.substring(5).trim();
    } else if (line.startsWith('### ')) {
      headingText = line.substring(4).trim();
    } else if (line.startsWith('## ')) {
      headingText = line.substring(3).trim();
    }

    if (headingText) {
      const cleanHeading = cleanWikiMarkup(headingText);
      // Skip trivial headings like "Relaciones", "Trivia" if short
      if (cleanHeading && !/^trivia$/i.test(cleanHeading)) {
        segments.push({
          id: `seg-heading-${segments.length}`,
          type: 'heading',
          rawText: headingText,
          speechText: `${cleanHeading}.`,
        });
      }
      continue;
    }

    // Bullet lists: Only include if they form descriptive narrative sentences
    if (/^[\*\-]\s+/.test(line)) {
      const itemText = line.replace(/^[\*\-]\s+/, '').trim();
      const cleanItem = cleanWikiMarkup(itemText);
      // Skip very short bullets like single names or links
      if (cleanItem.length > 25 && !cleanItem.includes(': ')) {
        segments.push({
          id: `seg-p-${segments.length}`,
          type: 'paragraph',
          rawText: line,
          speechText: cleanItem,
        });
      }
      continue;
    }

    // Regular narrative paragraphs
    const cleanParagraph = cleanWikiMarkup(line);

    // Filter out metadata, short codes, or orphaned punctuation
    if (cleanParagraph.length >= 20) {
      // Clean pronunciation of common abbreviations
      const speechPrepared = cleanParagraph
        .replace(/\bDM\b/g, 'Dungeon Master')
        .replace(/\bPC's\b/gi, 'personajes jugadores')
        .replace(/\bNPC\b/gi, 'personaje no jugador')
        .replace(/\bBTTF\b/gi, 'Back to the future')
        .replace(/\bD&D\b/gi, 'Calabozos y Dragones')
        .replace(/\b5E\b/g, 'Quinta Edición');

      segments.push({
        id: `seg-p-${segments.length}`,
        type: 'paragraph',
        rawText: line,
        speechText: speechPrepared,
      });
    }
  }

  return segments;
}

export const WikiAudioNarrator: FC<WikiAudioNarratorProps> = ({
  content,
  articleTitle,
  onActiveIndexChange,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(1.4); // Miku vocaloid high-pitch
  const [rate, setRate] = useState<number>(1.04); // Energetic anime cadence
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Extract clean narrative segments for this article
  const segments = useMemo(() => {
    return extractNarrativeSegments(content, articleTitle);
  }, [content, articleTitle]);

  // Load browser voices and pick the best feminine/vocaloid match
  useEffect(() => {
    if (!isSpeechSupported) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);

      // Prioritize Spanish female voices (Sabina, Helena, Paulina, Laura, Monica, etc.)
      const femaleSpanish = voices.find(
        (v) =>
          v.lang.startsWith('es') &&
          /sabina|helena|paulina|laura|monica|rosa|dalia|elvira|female|femenin/i.test(v.name),
      );

      // Fallback: Any Spanish voice
      const anySpanish = voices.find((v) => v.lang.startsWith('es'));

      // Fallback: Japanese or cute voice
      const anyJapanese = voices.find((v) => v.lang.startsWith('ja'));

      const best = femaleSpanish || anySpanish || anyJapanese || voices[0] || null;
      setSelectedVoice(best);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeechSupported]);

  // Stop speech when content or article changes
  useEffect(() => {
    if (isSpeechSupported) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentIdx(0);
      onActiveIndexChange?.(null);
    }
  }, [content, articleTitle, isSpeechSupported]);

  // Speak a specific segment index
  const speakSegment = useCallback(
    (index: number) => {
      if (!isSpeechSupported || index >= segments.length) {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentIdx(0);
        onActiveIndexChange?.(null);
        return;
      }

      window.speechSynthesis.cancel();
      const segment = segments[index];
      const utterance = new SpeechSynthesisUtterance(segment.speechText);

      utterance.pitch = pitch;
      utterance.rate = rate;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        const next = index + 1;
        if (next < segments.length) {
          setCurrentIdx(next);
          onActiveIndexChange?.(next);
          speakSegment(next);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentIdx(0);
          onActiveIndexChange?.(null);
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled') {
          console.warn('TTS error:', e);
          setIsPlaying(false);
          setIsPaused(false);
          onActiveIndexChange?.(null);
        }
      };

      utteranceRef.current = utterance;
      setCurrentIdx(index);
      onActiveIndexChange?.(index);
      setIsPlaying(true);
      setIsPaused(false);

      window.speechSynthesis.speak(utterance);
    },
    [isSpeechSupported, segments, pitch, rate, selectedVoice, onActiveIndexChange],
  );

  const handlePlay = () => {
    if (!isSpeechSupported) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      speakSegment(currentIdx);
    }
  };

  const handlePause = () => {
    if (!isSpeechSupported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (!isSpeechSupported) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIdx(0);
    onActiveIndexChange?.(null);
  };

  const handleNext = () => {
    if (currentIdx + 1 < segments.length) {
      speakSegment(currentIdx + 1);
    } else {
      handleStop();
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      speakSegment(currentIdx - 1);
    } else {
      speakSegment(0);
    }
  };

  if (!isSpeechSupported || segments.length === 0) {
    return null;
  }

  const currentSegment = segments[currentIdx];

  return (
    <div className={`wiki-audio-narrator-bar ${isPlaying ? 'is-playing' : ''}`}>
      <div className="narrator-left">
        {/* Miku Hologram Avatar */}
        <div className="miku-avatar-badge" title="Hatsune Miku Vocaloid TTS Reader">
          <div className="miku-halo-ring" />
          <span className="miku-code">01</span>
          <i className="fas fa-headphones miku-icon" />
        </div>

        <div className="narrator-info">
          <div className="narrator-brand">
            <span className="brand-tag">VOCALOID TTS // MIKU ENGINE</span>
            {isPlaying && (
              <span className="audio-equalizer-bars">
                <span className="eq-bar bar-1" />
                <span className="eq-bar bar-2" />
                <span className="eq-bar bar-3" />
                <span className="eq-bar bar-4" />
              </span>
            )}
          </div>
          <div className="narrator-current-text">
            {isPlaying || isPaused ? (
              <span className="playing-label">
                Párrafo {currentIdx + 1} de {segments.length}:{' '}
                <strong className="snippet-preview">"{currentSegment?.speechText.substring(0, 55)}…"</strong>
              </span>
            ) : (
              <span className="idle-label">
                Modo Audiolibro: Escuchar narración continua del lore
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="narrator-controls">
        <button
          type="button"
          className="btn-narrator-step"
          onClick={handlePrev}
          disabled={currentIdx === 0}
          title="Párrafo anterior"
        >
          <i className="fas fa-backward-step" />
        </button>

        {isPlaying ? (
          <button
            type="button"
            className="btn-narrator-main is-pause"
            onClick={handlePause}
            title="Pausar lectura"
          >
            <i className="fas fa-pause" />
            <span className="btn-text">Pausar</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn-narrator-main is-play"
            onClick={handlePlay}
            title="Escuchar artículo con voz de Miku"
          >
            <i className="fas fa-play" />
            <span className="btn-text">{isPaused ? 'Reanudar' : 'Escuchar Lore'}</span>
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            type="button"
            className="btn-narrator-stop"
            onClick={handleStop}
            title="Detener audiolibro"
          >
            <i className="fas fa-stop" />
          </button>
        )}

        <button
          type="button"
          className="btn-narrator-step"
          onClick={handleNext}
          disabled={currentIdx >= segments.length - 1}
          title="Siguiente párrafo"
        >
          <i className="fas fa-forward-step" />
        </button>

        <button
          type="button"
          className={`btn-narrator-settings ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(!showSettings)}
          title="Ajustes de voz Miku (Tono / Velocidad)"
        >
          <i className="fas fa-sliders" />
        </button>
      </div>

      {/* Voice Configuration Dropdown */}
      {showSettings && (
        <div className="narrator-settings-popover">
          <div className="settings-row">
            <label>
              <span>Tono Vocaloid (Pitch Agudo):</span>
              <strong>{pitch.toFixed(2)}x</strong>
            </label>
            <input
              type="range"
              min="1.0"
              max="1.8"
              step="0.05"
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
            />
          </div>

          <div className="settings-row">
            <label>
              <span>Velocidad de Lectura:</span>
              <strong>{rate.toFixed(2)}x</strong>
            </label>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
            />
          </div>

          {availableVoices.length > 0 && (
            <div className="settings-row">
              <label>Voz Sintética Base:</label>
              <select
                value={selectedVoice?.name || ''}
                onChange={(e) => {
                  const v = availableVoices.find((voice) => voice.name === e.target.value);
                  if (v) setSelectedVoice(v);
                }}
              >
                {availableVoices
                  .filter((v) => v.lang.startsWith('es') || v.lang.startsWith('ja'))
                  .map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
