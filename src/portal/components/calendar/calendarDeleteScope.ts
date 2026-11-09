import { CalendarEvent, CalendarEventOccurrence } from '../../models/Calendar/CalendarModels';

export function isRecurringEvent(event: CalendarEvent): boolean {
  return event.recurrence !== 'NONE';
}

/** Siempre ofrece elegir ocurrencia vs serie cuando el evento se repite. */
export function shouldOfferSeriesDeleteChoice(event: CalendarEvent): boolean {
  return isRecurringEvent(event);
}

/**
 * Ocurrencia que el usuario está viendo al eliminar (desde el grid o la fecha del formulario).
 */
export function resolveDeleteOccurrence(
  event: CalendarEvent,
  editingOccurrence: CalendarEventOccurrence | null,
  formDate: string,
): CalendarEventOccurrence {
  if (editingOccurrence && editingOccurrence.event.id === event.id) {
    return editingOccurrence;
  }
  return {
    event,
    instanceDate: formDate.trim() || event.date,
    isRecurringInstance: formDate.trim() !== event.date,
  };
}
