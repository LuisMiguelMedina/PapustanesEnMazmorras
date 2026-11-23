import { describe, expect, it } from 'vitest';
import { sanitizeCalendarEventForFirebase } from './calendarEventFirebase';
import { CalendarEvent } from '../models/Calendar/CalendarModels';

const base: CalendarEvent = {
  id: 'evt_1',
  title: 'Test',
  date: '2026-11-21',
  time: '20:30',
  authorTag: 'AZUL',
  categoryTag: 'CAMPAÑA',
  colorVariant: '#38b6ff',
  textColor: '#000',
  recurrence: 'WEEKLY',
};

describe('sanitizeCalendarEventForFirebase', () => {
  it('elimina skippedOccurrenceDates indefinido en serie', () => {
    const out = sanitizeCalendarEventForFirebase({ ...base, skippedOccurrenceDates: undefined });
    expect(out.skippedOccurrenceDates).toEqual([]);
    expect(Object.values(out).every((v) => v !== undefined)).toBe(true);
  });

  it('quita skippedOccurrenceDates en eventos únicos', () => {
    const out = sanitizeCalendarEventForFirebase({
      ...base,
      recurrence: 'NONE',
      skippedOccurrenceDates: undefined,
    });
    expect('skippedOccurrenceDates' in out).toBe(false);
  });

  it('quita visualStyleId indefinido', () => {
    const out = sanitizeCalendarEventForFirebase({ ...base, visualStyleId: undefined });
    expect('visualStyleId' in out).toBe(false);
  });
});