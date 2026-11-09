export type RecurrenceType = 'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface CalendarEventTag {
  id: string;
  label: string;
  color: string;
  textColor: string;
  category: 'TYPE' | 'AUTHOR';
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // Formato YYYY-MM-DD
  time: string; // Obligatorio! Ejemplo "18:00" o "19:30 - 22:30"
  authorTag: string; // Fred, Paco, Leo Alv, Luismi, Aldana, Bruno, Pac, Maruco
  categoryTag: string; // EVENTOS, WEAS CORTAS, CAMPAÑA
  colorVariant: string; // Color hexadecimal o CSS gradient para el pill
  textColor: string; // #000000 o #ffffff
  /** Id de `PRESET_EVENT_STYLES` cuando aplica (p. ej. degradados). */
  visualStyleId?: string;
  recurrence: RecurrenceType;
  /** Ocurrencias recurrentes omitidas (YYYY-MM-DD). */
  skippedOccurrenceDates?: string[];
  description?: string;
  foundryUrl?: string;
  updatedAt?: number;
}

export interface CalendarEventOccurrence {
  event: CalendarEvent;
  instanceDate: string; // YYYY-MM-DD de esta ocurrencia en particular
  isRecurringInstance: boolean;
}

/**
 * Etiquetas oficiales del sistema (según imagen del calendario manual).
 */
/** Categorías de evento (solo tipo; colores por defecto). */
export const DEFAULT_TAGS: CalendarEventTag[] = [
  { id: 'eventos', label: 'EVENTOS', color: '#5814e5', textColor: '#ffffff', category: 'TYPE' },
  { id: 'weas_cortas', label: 'WEAS CORTAS', color: '#f5a623', textColor: '#000000', category: 'TYPE' },
  { id: 'campana', label: 'CAMPAÑA', color: '#7c3aed', textColor: '#ffffff', category: 'TYPE' },
];

/** Organizadores / DMs (independientes del color del pill). */
export const DEFAULT_CALENDAR_AUTHORS = [
  'FRED',
  'PACO',
  'LEO ALV',
  'LUISMI',
  'ALDANA',
  'BRUNO',
  'PAC',
  'MARUCO',
] as const;

/**
 * Paleta de estilos visuales para los pills de los eventos.
 */
/** Colores por defecto del calendario (sin vincular nombres de autores). */
export const PRESET_EVENT_STYLES = [
  { id: 'cyan', label: 'Cyan', background: '#38b6ff', textColor: '#000000' },
  {
    id: 'elixir_gradient',
    label: 'Degradado oro–lima',
    background: 'linear-gradient(135deg, #f5a623 0%, #7ed957 100%)',
    textColor: '#000000',
  },
  { id: 'purple_reveil', label: 'Púrpura', background: '#7c3aed', textColor: '#ffffff' },
  { id: 'deep_halloween', label: 'Púrpura oscuro', background: '#5814e5', textColor: '#ffffff' },
  { id: 'black_ops', label: 'Negro', background: '#111111', textColor: '#ffffff' },
  { id: 'crimson', label: 'Carmesí', background: '#8b1e0f', textColor: '#ffffff' },
  { id: 'pink_bruno', label: 'Magenta', background: '#ec4899', textColor: '#ffffff' },
  { id: 'blue_luismi', label: 'Azul real', background: '#005bb5', textColor: '#ffffff' },
  { id: 'lime_pac', label: 'Lima neón', background: '#7ed957', textColor: '#000000' },
  { id: 'olive_maruco', label: 'Verde oliva', background: '#66a15e', textColor: '#ffffff' },
];
