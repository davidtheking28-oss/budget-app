import { describe, it, expect } from 'vitest';
import { lastHeldMeeting, meetingChanges, daysUntil } from './workflow.js';

describe('daily work and meeting preparation', () => {
  it('uses the nearest past meeting while excluding declined and future meetings', () => {
    const meetings = [
      { id: 'future', scheduled_at: '2026-10-20T10:00:00Z' },
      { id: 'declined', scheduled_at: '2026-10-14T10:00:00Z', status: 'declined' },
      { id: 'last', scheduled_at: '2026-10-10T10:00:00Z', status: 'confirmed' },
      { id: 'old', scheduled_at: '2026-10-01T10:00:00Z' }
    ];
    expect(lastHeldMeeting(meetings, new Date('2026-10-15T12:00:00Z')).id).toBe('last');
    expect(lastHeldMeeting([], new Date())).toBeNull();
  });
  it('counts movement dates strictly after the meeting day and excludes future dates', () => {
    const rows = [
      { date: '2026-10-10', type: 'expense', amount: 999 },
      { date: '2026-10-11', type: 'expense', amount: 100 },
      { date: '2026-10-15', type: 'income', amount: 500 },
      { date: '2026-10-16', type: 'expense', amount: 999 }
    ];
    const now = new Date(2026, 9, 15, 12);
    expect(meetingChanges(rows, new Date(2026, 9, 10, 10).toISOString(), now)).toEqual({ count: 2, expense: 100 });
    expect(meetingChanges(rows, null, now)).toBeNull();
  });
});

describe('meeting calendar reminders', () => {
  it('distinguishes later today from tomorrow across midnight', () => {
    const now = new Date(2026, 9, 15, 12);
    expect(daysUntil(new Date(2026, 9, 15, 23).toISOString(), now)).toBe(0);
    expect(daysUntil(new Date(2026, 9, 16, 0, 1).toISOString(), now)).toBe(1);
    expect(daysUntil(new Date(2026, 9, 15, 11).toISOString(), now)).toBe(-1);
  });
  it('counts calendar days rather than rounding a partial 24 hour interval', () => {
    const now = new Date(2026, 9, 24, 23);
    expect(daysUntil(new Date(2026, 9, 25, 23, 30).toISOString(), now)).toBe(1);
    expect(daysUntil(new Date(2026, 9, 27, 0, 1).toISOString(), now)).toBe(3);
  });
  it('does not create reminders from missing or invalid dates', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil('not-a-date')).toBeNull();
  });
});
