import { describe, test, expect } from 'vitest';
import { expandEvents } from '../lib/rruleParser';

describe('rruleParser — expandEvents', () => {
  const viewStart = new Date('2026-07-06T00:00:00Z');
  const viewEnd = new Date('2026-07-19T23:59:59Z');

  test('expands weekly event within bounded window', () => {
    const events = [{
      id: '1',
      title: 'Trash Day',
      rrule: 'FREQ=WEEKLY;BYDAY=TU',
      start_time: '2026-07-07T08:00:00Z',
    }];
    const result = expandEvents(events, viewStart, viewEnd);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(3);
    result.forEach(e => {
      expect(e.isRecurring).toBe(true);
      const d = new Date(e.start_time);
      expect(d >= viewStart).toBe(true);
      expect(d <= viewEnd).toBe(true);
    });
  });

  test('does NOT expand beyond view window', () => {
    const events = [{
      id: '2',
      title: 'Weekly Meeting',
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      start_time: '2026-01-05T10:00:00Z',
    }];
    const narrowStart = new Date('2026-07-13T00:00:00Z');
    const narrowEnd = new Date('2026-07-13T23:59:59Z');
    const result = expandEvents(events, narrowStart, narrowEnd);
    expect(result.length).toBe(1);
    const d = new Date(result[0].start_time);
    expect(d.getDay()).toBe(1);
  });

  test('handles empty recurrence_rule gracefully', () => {
    const events = [{
      id: '3',
      title: 'One-time Event',
      rrule: null,
      start_time: '2026-07-10T15:00:00Z',
    }];
    const result = expandEvents(events, viewStart, viewEnd);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('One-time Event');
  });

  test('excludes non-recurring events outside window', () => {
    const events = [{
      id: '4',
      title: 'Past Event',
      rrule: null,
      start_time: '2026-06-01T10:00:00Z',
    }];
    const result = expandEvents(events, viewStart, viewEnd);
    expect(result.length).toBe(0);
  });

  test('skips someday events', () => {
    const events = [{
      id: '5',
      title: 'Someday Event',
      rrule: null,
      is_someday: true,
      start_time: '2026-07-10T10:00:00Z',
    }];
    const result = expandEvents(events, viewStart, viewEnd);
    expect(result.length).toBe(0);
  });

  test('handles invalid rrule string gracefully', () => {
    const events = [{
      id: '6',
      title: 'Bad Rule',
      rrule: 'INVALID_RULE_STRING',
      start_time: '2026-07-10T10:00:00Z',
    }];
    const result = expandEvents(events, viewStart, viewEnd);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Bad Rule');
  });
});
