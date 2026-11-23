import { CalendarEvent } from '../models/Calendar/CalendarModels';

/**
 * Firebase RTDB rechaza propiedades con valor `undefined`.
 * Quita opcionales indefinidos y normaliza skips de serie.
 */
export function sanitizeCalendarEventForFirebase(event: CalendarEvent): CalendarEvent {
  const base: CalendarEvent = {
    ...event,
    description: event.description?.trim() ? event.description.trim() : undefined,
    foundryUrl: event.foundryUrl?.trim() ? event.foundryUrl.trim() : undefined,
    visualStyleId: event.visualStyleId?.trim() ? event.visualStyleId.trim() : undefined,
  };

  if (base.recurrence === 'NONE') {
    delete base.skippedOccurrenceDates;
  } else {
    const skips =
      event.skippedOccurrenceDates?.filter((d) => typeof d === 'string' && d.length > 0) ?? [];
    base.skippedOccurrenceDates = skips;
  }

  const cleaned = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  }

  return cleaned as unknown as CalendarEvent;
}