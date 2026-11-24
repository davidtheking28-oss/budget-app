import { describe, expect, it } from 'vitest';
import { meetingConfirmedNotice, meetingEveNotice } from '../../../supabase/functions/budget-push/notices.ts';

const meeting = (over = {}) => ({ id: 'm1', scheduled_at: '2026-11-25T10:00:00Z', notes: null, status: 'confirmed', requested_by_client: true, ...over });

describe('meeting notices sent to the client', () => {
  it('announces an approved meeting with the weekday and Israel time', () => {
    const n = meetingConfirmedNotice(meeting({ scheduled_at: '2026-11-24T10:00:00Z' }));
    expect(n.kind).toBe('advisor_meeting_confirmed');
    expect(n.title).toContain('אושרה');
    expect(n.body).toContain('פגישת ייעוץ');
    expect(n.body).toContain('יום שלישי');
    expect(n.body).toContain('12:00');
  });
  it('uses a different key when an approved meeting is moved, so the new time is announced again', () => {
    expect(meetingConfirmedNotice(meeting()).key).not.toBe(meetingConfirmedNotice(meeting({ scheduled_at: '2026-11-25T11:00:00Z' })).key);
  });
  it('reminds the evening before, only for approved meetings tomorrow', () => {
    const n = meetingEveNotice(meeting({ notes: 'סקירה' }), '2026-11-25');
    expect(n.kind).toBe('advisor_meeting_eve');
    expect(n.key).toBe('m1:2026-11-25');
    expect(n.body).toBe('סקירה · מחר ב-12:00');
    expect(meetingEveNotice(meeting({ status: 'pending' }), '2026-11-25')).toBeNull();
    expect(meetingEveNotice(meeting({ status: 'declined' }), '2026-11-25')).toBeNull();
    expect(meetingEveNotice(meeting(), '2026-11-26')).toBeNull();
    expect(meetingEveNotice(meeting(), '2026-11-24')).toBeNull();
  });
  it('decides the day by Israel time, not UTC', () => {
    expect(meetingEveNotice(meeting({ scheduled_at: '2026-11-24T22:30:00Z' }), '2026-11-25')?.body).toContain('00:30');
    expect(meetingEveNotice(meeting({ scheduled_at: '2026-11-25T22:30:00Z' }), '2026-11-25')).toBeNull();
  });
});
