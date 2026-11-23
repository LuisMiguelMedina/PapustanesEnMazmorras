import { CalendarEvent } from '../../models/Calendar/CalendarModels';
import { shiftIsoDate, uniqueIsoDates } from './calendarDateUtils';

/** Evento único en la fecha destino (sin skips de serie). */
/** Copia puntual en la misma fecha (incluye saltar serie → evento único). */
export function duplicateOccurrenceAsEvent(
  evt: CalendarEvent,
  instanceDate: string,
  newId: string,
): CalendarEvent {
  return buildOneOffFromOccurrence({ ...evt, date: instanceDate }, instanceDate, newId);
}

export function buildOneOffFromOccurrence(
  evt: CalendarEvent,
  targetDate: string,
  newId: string,
): CalendarEvent {
  const { skippedOccurrenceDates: _skip, ...rest } = evt;
  return {
    ...rest,
    id: newId,
    date: targetDate,
    recurrence: 'NONE',
    skippedOccurrenceDates: [],
  };
}

export function shiftSeriesAnchorAndSkips(
  evt: CalendarEvent,
  occurrenceDate: string,
  targetDate: string,
): { date: string; skippedOccurrenceDates: string[] } {
  const delta = daysBetweenIsoLocal(occurrenceDate, targetDate);
  const newAnchor = shiftIsoDate(evt.date, delta);
  const shiftedSkips = (evt.skippedOccurrenceDates || []).map((d) => shiftIsoDate(d, delta));
  return {
    date: newAnchor,
    skippedOccurrenceDates: uniqueIsoDates(shiftedSkips),
  };
}

function daysBetweenIsoLocal(startIso: string, endIso: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return Math.round((parse(endIso) - parse(startIso)) / (1000 * 60 * 60 * 24));
}