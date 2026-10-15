import { describe, it, expect } from 'vitest';
import { taskMatches, lastHeldMeeting, meetingChanges } from './workflow.js';

describe('daily work and meeting preparation', () => {
  it('does not mix completed documents or future tasks into overdue work', () => {
    const today = '2026-10-15';
    const rows = [
      { id: 'old', due_date: '2026-10-14', task_kind: 'document' },
      { id: 'today', due_date: today },
      { id: 'future', due_date: '2026-10-16' },
      { id: 'done', due_date: '2026-10-12', task_kind: 'document', done: true },
      { id: 'undated', task_kind: 'document' }
    ];
    expect(rows.filter(t => taskMatches(t, 'overdue', today)).map(t => t.id)).toEqual(['old']);
    expect(rows.filter(t => taskMatches(t, 'today', today)).map(t => t.id)).toEqual(['today']);
    expect(rows.filter(t => taskMatches(t, 'documents', today)).map(t => t.id)).toEqual(['old', 'undated']);
  });
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
