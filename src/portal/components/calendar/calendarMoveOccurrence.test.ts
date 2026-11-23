import { describe, expect, it } from 'vitest';
import {
  buildOneOffFromOccurrence,
  duplicateOccurrenceAsEvent,
  shiftSeriesAnchorAndSkips,
} from './calendarMoveOccurrence';
import { CalendarEvent } from '../../models/Calendar/CalendarModels';

const series: CalendarEvent = {
  id: 'evt_series',
  title: 'ELIXIR',
  date: '2026-11-07',
  time: '20:00',
  authorTag: 'PAC',
  categoryTag: 'CAMPAÑA',
  colorVariant: '#7ed957',
  textColor: '#000',
  recurrence: 'WEEKLY',
  skippedOccurrenceDates: ['2026-11-14'],
};

describe('calendarMoveOccurrence', () => {
  it('one-off no hereda skippedOccurrenceDates', () => {
    const one = buildOneOffFromOccurrence(series, '2026-11-20', 'evt_new');
    expect(one.recurrence).toBe('NONE');
    expect(one.date).toBe('2026-11-20');
    expect(one.skippedOccurrenceDates).toEqual([]);
  });

  it('duplicar crea evento único en la misma fecha', () => {
    const dup = duplicateOccurrenceAsEvent(series, '2026-11-21', 'evt_dup');
    expect(dup.id).toBe('evt_dup');
    expect(dup.date).toBe('2026-11-21');
    expect(dup.recurrence).toBe('NONE');
    expect(dup.title).toBe('ELIXIR');
  });

  it('mover serie desplaza skips con el ancla', () => {
    const moved = shiftSeriesAnchorAndSkips(series, '2026-11-21', '2026-11-28');
    expect(moved.date).toBe('2026-11-14');
    expect(moved.skippedOccurrenceDates).toContain('2026-11-21');
  });
});