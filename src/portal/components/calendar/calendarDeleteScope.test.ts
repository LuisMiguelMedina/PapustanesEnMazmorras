import { describe, expect, it } from 'vitest';
import {
  isRecurringEvent,
  resolveDeleteOccurrence,
  shouldOfferSeriesDeleteChoice,
} from './calendarDeleteScope';
import { CalendarEvent } from '../../models/Calendar/CalendarModels';

const baseEvent: CalendarEvent = {
  id: 'evt_1',
  title: 'Test',
  date: '2026-10-10',
  time: '20:00',
  authorTag: 'PAPUSTANES',
  categoryTag: 'CAMPAÑA',
  colorVariant: '#005bb5',
  textColor: '#ffffff',
  recurrence: 'WEEKLY',
};

describe('calendarDeleteScope', () => {
  it('detecta eventos recurrentes', () => {
    expect(isRecurringEvent(baseEvent)).toBe(true);
    expect(isRecurringEvent({ ...baseEvent, recurrence: 'NONE' })).toBe(false);
  });

  it('ofrece elección serie/ocurrencia solo si hay recurrencia', () => {
    expect(shouldOfferSeriesDeleteChoice(baseEvent)).toBe(true);
    expect(shouldOfferSeriesDeleteChoice({ ...baseEvent, recurrence: 'NONE' })).toBe(false);
    expect(
      shouldOfferSeriesDeleteChoice(
        { ...baseEvent, recurrence: 'NONE' },
        { event: baseEvent, instanceDate: '2026-10-17', isRecurringInstance: true },
      ),
    ).toBe(true);
  });

  it('usa editingOccurrence cuando coincide con el evento', () => {
    const occ = {
      event: baseEvent,
      instanceDate: '2026-10-17',
      isRecurringInstance: true,
    };
    expect(resolveDeleteOccurrence(baseEvent, occ, '2026-10-10')).toEqual(occ);
  });

  it('arma ocurrencia desde formDate si no hay editingOccurrence', () => {
    const resolved = resolveDeleteOccurrence(baseEvent, null, '2026-10-17');
    expect(resolved.instanceDate).toBe('2026-10-17');
    expect(resolved.isRecurringInstance).toBe(true);
  });
});
