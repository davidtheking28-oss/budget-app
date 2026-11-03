import { describe, expect, it } from 'vitest';
import { meetingEvents } from './plannerMeetings.js';

describe('weekly calendar appointments', () => {
  const clients = [{ client_id: 'c', name: 'לקוח בדיקה' }];
  const row = { id: 'm', client_id: 'c', scheduled_at: new Date(2026, 10, 7, 15, 15).toISOString(), status: 'pending', for_client: true };
  it('uses the booking local date and time and preserves pending confirmation', () => {
    expect(meetingEvents([row], clients)[0]).toMatchObject({ meetingId: 'm', date: '2026-11-07', s: '15:15', e: '16:15', n: 'פגישה · לקוח בדיקה', status: 'pending', statusLabel: 'ממתינה לאישור הלקוח' });
  });
  it('reflects rescheduling and confirmation without duplicating the appointment', () => {
    const result = meetingEvents([{ ...row, scheduled_at: new Date(2026, 10, 8, 11).toISOString(), status: 'confirmed' }], clients);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'meeting-m', date: '2026-11-08', s: '11:00', statusLabel: 'מאושרת' });
    expect(meetingEvents([], clients)).toEqual([]);
  });
  it('excludes declined and invalid bookings and distinguishes unshared appointments', () => {
    expect(meetingEvents([{ ...row, status: 'declined' }, { ...row, scheduled_at: 'invalid' }], clients)).toEqual([]);
    expect(meetingEvents([{ ...row, for_client: false }], clients)[0].statusLabel).toBe('נקבעה');
  });
  it('keeps late meetings within the calendar day', () => {
    expect(meetingEvents([{ ...row, scheduled_at: new Date(2026, 10, 7, 23, 30).toISOString() }], clients)[0].e).toBe('24:00');
  });
});
