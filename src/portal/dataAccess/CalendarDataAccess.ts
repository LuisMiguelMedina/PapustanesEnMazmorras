/**
 * CalendarDataAccess conforming to project architecture standards.
 * Connects directly to Firebase Realtime Database at path `calendar/events`.
 * Provides real-time event subscription, CRUD operations, and Google Calendar sync utilities.
 */

import { ref, set, remove, onValue, off, DatabaseReference } from 'firebase/database';
import { db } from '../firebase';
import { CalendarEvent, CalendarEventTag, DEFAULT_TAGS } from '../models/Calendar/CalendarModels';
import { ResponseObject } from '../models/Common/TransactionModels';
import { INITIAL_CALENDAR_EVENTS } from '../data/calendar.seed';
import { sanitizeCalendarEventForFirebase } from './calendarEventFirebase';

const FIREBASE_CALENDAR_PATH = 'calendar/events';
const LOCAL_STORAGE_BACKUP_KEY = 'mom_calendar_events_backup';
const FIREBASE_TAGS_PATH = 'calendar/tags';
const LOCAL_STORAGE_TAGS_KEY = 'mom_calendar_tags';

export class CalendarDataAccess {
  /**
   * Subscribes in real time to all calendar events from Firebase RTDB.
   * If the database is initially empty, seeds the official manual calendar data.
   */
  public static SubscribeEvents(
    onEventsUpdated: (events: CalendarEvent[]) => void,
    onError?: (message: string) => void,
  ): () => void {
    const calendarDbRef: DatabaseReference = ref(db, FIREBASE_CALENDAR_PATH);

    const unsubscribe = onValue(
      calendarDbRef,
      (snapshot) => {
        try {
          const data = snapshot.val() as Record<string, CalendarEvent> | null;

          if (!data || Object.keys(data).length === 0) {
            // Seed default events if database is empty
            const seedMap: Record<string, CalendarEvent> = {};
            INITIAL_CALENDAR_EVENTS.forEach((evt) => {
              seedMap[evt.id] = evt;
            });

            set(calendarDbRef, seedMap).catch((e) => {
              console.warn('Could not seed initial calendar to Firebase:', e);
            });

            onEventsUpdated(INITIAL_CALENDAR_EVENTS);
            try {
              localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(INITIAL_CALENDAR_EVENTS));
            } catch {
              // Ignore storage errors
            }
            return;
          }

          const eventsList: CalendarEvent[] = Object.values(data);
          onEventsUpdated(eventsList);

          try {
            localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(eventsList));
          } catch {
            // Ignore storage errors
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error processing calendar data';
          console.error('Calendar onValue error:', msg);
          if (onError) onError(msg);
        }
      },
      (error) => {
        console.warn('Firebase RTDB error, falling back to cached seed:', error.message);
        // Fallback to local storage or initial seed
        try {
          const cached = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
          if (cached) {
            onEventsUpdated(JSON.parse(cached));
            return;
          }
        } catch {
          // Ignore
        }
        onEventsUpdated(INITIAL_CALENDAR_EVENTS);
        if (onError) onError(error.message);
      },
    );

    return () => {
      off(calendarDbRef);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }

  /**
   * Creates or updates a calendar event in Firebase RTDB.
   * Validates mandatory fields: Title, Date, and Time.
   */
  public static async SaveEvent(event: CalendarEvent): Promise<ResponseObject<CalendarEvent>> {
    try {
      if (!event.title || !event.title.trim()) {
        return {
          CodeNumber: 400,
          CodeName: 'BadRequest',
          Message: 'El título del evento es obligatorio.',
          ErrorNumber: 400,
          ServerName: 'local-portal',
          Result: null,
        };
      }

      if (!event.date || !event.date.trim()) {
        return {
          CodeNumber: 400,
          CodeName: 'BadRequest',
          Message: 'La fecha del evento es obligatoria.',
          ErrorNumber: 400,
          ServerName: 'local-portal',
          Result: null,
        };
      }

      if (!event.time || !event.time.trim()) {
        return {
          CodeNumber: 400,
          CodeName: 'BadRequest',
          Message: 'La hora del evento es estrictamente obligatoria.',
          ErrorNumber: 400,
          ServerName: 'local-portal',
          Result: null,
        };
      }

      const id = event.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const eventToSave: CalendarEvent = sanitizeCalendarEventForFirebase({
        ...event,
        id,
        updatedAt: Date.now(),
      });

      const eventRef = ref(db, `${FIREBASE_CALENDAR_PATH}/${id}`);
      await set(eventRef, eventToSave);

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: 'Evento guardado exitosamente.',
        ErrorNumber: null,
        ServerName: 'firebase-rtdb',
        Result: eventToSave,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el evento en Firebase';
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: msg,
        ErrorNumber: 500,
        ServerName: 'firebase-rtdb',
        Result: null,
      };
    }
  }

  /**
   * Deletes an event by ID from Firebase RTDB.
   */
  public static async DeleteEvent(eventId: string): Promise<ResponseObject<boolean>> {
    try {
      if (!eventId) {
        return {
          CodeNumber: 400,
          CodeName: 'BadRequest',
          Message: 'ID de evento no especificado.',
          ErrorNumber: 400,
          ServerName: 'local-portal',
          Result: false,
        };
      }

      const eventRef = ref(db, `${FIREBASE_CALENDAR_PATH}/${eventId}`);
      await remove(eventRef);

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: 'Evento eliminado correctamente.',
        ErrorNumber: null,
        ServerName: 'firebase-rtdb',
        Result: true,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el evento de Firebase';
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: msg,
        ErrorNumber: 500,
        ServerName: 'firebase-rtdb',
        Result: false,
      };
    }
  }

  /**
   * Generates a standard RFC 5545 iCalendar (.ics) string with all events and recurrences.
   * Can be imported or subscribed to in Google Calendar, Apple Calendar, or Outlook.
   */
  public static GenerateIcsCalendar(events: CalendarEvent[], calendarName?: string): string {
    const calName = calendarName || 'Papustanes en Mazmorras - Calendario de Campañas';
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Papustanes en Mazmorras//TTRPG Community Calendar//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calName}`,
      'X-WR-TIMEZONE:America/Mexico_City',
      'X-WR-CALDESC:Calendario canónico de partidas y eventos de rol de Papustanes en Mazmorras',
    ];

    events.forEach((evt) => {
      // Parse date: YYYY-MM-DD
      const dateParts = evt.date.split('-');
      if (dateParts.length !== 3) return;
      const year = dateParts[0];
      const month = dateParts[1].padStart(2, '0');
      const day = dateParts[2].padStart(2, '0');

      // Extract hours and minutes (e.g. "20:00" or "19:30 - 22:30")
      const timeMatch = evt.time.match(/(\d{1,2}):(\d{2})/);
      const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '20';
      const minute = timeMatch ? timeMatch[2].padStart(2, '0') : '00';

      const dtStart = `${year}${month}${day}T${hour}${minute}00`;
      // Default duration 3 hours for TTRPG session
      const endHourNum = (parseInt(hour, 10) + 3) % 24;
      const endHour = String(endHourNum).padStart(2, '0');
      const dtEnd = `${year}${month}${day}T${endHour}${minute}00`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${evt.id}@multiverseofmadness.com`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${evt.title} [${evt.authorTag}]`);
      lines.push(
        `DESCRIPTION:${evt.description || ''}\\nOrganizador: ${evt.authorTag}\\nCategoría: ${evt.categoryTag}\\nHora: ${evt.time}`,
      );
      lines.push('LOCATION:Servidor Foundry VTT');

      if (evt.recurrence === 'WEEKLY') {
        lines.push('RRULE:FREQ=WEEKLY;INTERVAL=1');
      } else if (evt.recurrence === 'BIWEEKLY') {
        lines.push('RRULE:FREQ=WEEKLY;INTERVAL=2');
      } else if (evt.recurrence === 'MONTHLY') {
        lines.push('RRULE:FREQ=MONTHLY;INTERVAL=1');
      }

      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Generates a direct Google Calendar URL to add a specific event instance with 1 click.
   */
  public static GetGoogleCalendarDirectUrl(event: CalendarEvent, targetDate?: string): string {
    const dateStr = targetDate || event.date;
    const cleanDate = dateStr.replace(/-/g, '');

    const timeMatch = event.time.match(/(\d{1,2}):(\d{2})/);
    const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '20';
    const minute = timeMatch ? timeMatch[2].padStart(2, '0') : '00';

    const endHourNum = (parseInt(hour, 10) + 3) % 24;
    const endHour = String(endHourNum).padStart(2, '0');

    const dates = `${cleanDate}T${hour}${minute}00/${cleanDate}T${endHour}${minute}00`;
    const title = `${event.title} [${event.authorTag}]`;
    const details = `${event.description || 'Partida de rol en Papustanes en Mazmorras'}\nOrganizador: ${event.authorTag}\nHora: ${event.time}`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: dates,
      details: details,
      location: 'Foundry VTT (Papustanes en Mazmorras)',
    });

    if (event.recurrence === 'WEEKLY') {
      params.append('recur', 'RRULE:FREQ=WEEKLY;INTERVAL=1');
    } else if (event.recurrence === 'BIWEEKLY') {
      params.append('recur', 'RRULE:FREQ=WEEKLY;INTERVAL=2');
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /**
   * Subscribes in real time to all calendar tags from Firebase RTDB.
   * If the database path is initially empty, seeds DEFAULT_TAGS.
   */
  public static SubscribeTags(
    onTagsUpdated: (tags: CalendarEventTag[]) => void,
    onError?: (message: string) => void,
  ): () => void {
    const tagsDbRef: DatabaseReference = ref(db, FIREBASE_TAGS_PATH);

    const unsubscribe = onValue(
      tagsDbRef,
      (snapshot) => {
        try {
          const data = snapshot.val() as Record<string, CalendarEventTag> | null;

          if (!data || Object.keys(data).length === 0) {
            const seedMap: Record<string, CalendarEventTag> = {};
            DEFAULT_TAGS.forEach((tag) => {
              seedMap[tag.id] = tag;
            });

            set(tagsDbRef, seedMap).catch((e) => {
              console.warn('Could not seed initial calendar tags to Firebase:', e);
            });

            onTagsUpdated(DEFAULT_TAGS);
            try {
              localStorage.setItem(LOCAL_STORAGE_TAGS_KEY, JSON.stringify(DEFAULT_TAGS));
            } catch {
              // Ignore storage errors
            }
            return;
          }

          const tagsList: CalendarEventTag[] = Object.values(data);
          onTagsUpdated(tagsList);

          try {
            localStorage.setItem(LOCAL_STORAGE_TAGS_KEY, JSON.stringify(tagsList));
          } catch {
            // Ignore storage errors
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error al procesar etiquetas de Firebase';
          console.error('Error processing tags from Firebase:', err);
          onError?.(msg);
        }
      },
      (error) => {
        console.warn('Firebase RTDB tags connection error:', error.message);
        try {
          const backup = localStorage.getItem(LOCAL_STORAGE_TAGS_KEY);
          if (backup) {
            onTagsUpdated(JSON.parse(backup));
          } else {
            onTagsUpdated(DEFAULT_TAGS);
          }
        } catch {
          onTagsUpdated(DEFAULT_TAGS);
        }
        onError?.(error.message);
      },
    );

    return () => {
      unsubscribe();
      off(tagsDbRef);
    };
  }

  /**
   * Saves or updates a calendar tag in Firebase RTDB and local storage.
   */
  public static async SaveTag(tag: CalendarEventTag): Promise<ResponseObject<CalendarEventTag>> {
    try {
      if (!tag.label || !tag.label.trim()) {
        return {
          CodeNumber: 400,
          CodeName: 'BadRequest',
          Message: 'El nombre de la etiqueta es obligatorio.',
          ErrorNumber: 400,
          ServerName: 'local-portal',
          Result: null,
        };
      }

      const id = tag.id || tag.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
      const tagToSave: CalendarEventTag = {
        ...tag,
        id,
        label: tag.label.trim().toUpperCase(),
        color: tag.color || '#5814e5',
        textColor: tag.textColor || '#ffffff',
        category: tag.category || 'AUTHOR',
      };

      const tagRef = ref(db, `${FIREBASE_TAGS_PATH}/${id}`);
      await set(tagRef, tagToSave);

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: 'Etiqueta guardada exitosamente.',
        ErrorNumber: null,
        ServerName: 'firebase-rtdb',
        Result: tagToSave,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar la etiqueta en Firebase';
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: msg,
        ErrorNumber: 500,
        ServerName: 'firebase-rtdb',
        Result: null,
      };
    }
  }

  /**
   * Deletes a calendar tag from Firebase RTDB.
   */
  public static async DeleteTag(tagId: string): Promise<ResponseObject<boolean>> {
    try {
      const tagRef = ref(db, `${FIREBASE_TAGS_PATH}/${tagId}`);
      await remove(tagRef);

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: 'Etiqueta eliminada exitosamente.',
        ErrorNumber: null,
        ServerName: 'firebase-rtdb',
        Result: true,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la etiqueta de Firebase';
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: msg,
        ErrorNumber: 500,
        ServerName: 'firebase-rtdb',
        Result: false,
      };
    }
  }

  /**
   * Resets calendar tags back to DEFAULT_TAGS.
   */
  public static async ResetDefaultTags(): Promise<ResponseObject<CalendarEventTag[]>> {
    try {
      const tagsDbRef = ref(db, FIREBASE_TAGS_PATH);
      const seedMap: Record<string, CalendarEventTag> = {};
      DEFAULT_TAGS.forEach((tag) => {
        seedMap[tag.id] = tag;
      });

      await set(tagsDbRef, seedMap);
      try {
        localStorage.setItem(LOCAL_STORAGE_TAGS_KEY, JSON.stringify(DEFAULT_TAGS));
      } catch {
        // Ignore storage errors
      }

      return {
        CodeNumber: 200,
        CodeName: 'OK',
        Message: 'Etiquetas restablecidas a valores predeterminados.',
        ErrorNumber: null,
        ServerName: 'firebase-rtdb',
        Result: DEFAULT_TAGS,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al restablecer etiquetas';
      return {
        CodeNumber: 500,
        CodeName: 'InternalServerError',
        Message: msg,
        ErrorNumber: 500,
        ServerName: 'firebase-rtdb',
        Result: null,
      };
    }
  }
}
