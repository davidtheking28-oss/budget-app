import { expect, it } from 'vitest';
import { bookingAnnouncement } from './bookingAnnouncement.js';

it('names the client and asks the advisor to approve', () => {
  const text = bookingAnnouncement({ scheduled_at: new Date(2026, 10, 29, 12).toISOString() }, 'מאסס גיא');
  expect(text).toContain('בקשת פגישה חדשה');
  expect(text).toContain('מאסס גיא');
  expect(text).toContain('12:00');
});
it('falls back to a generic client name', () => {
  expect(bookingAnnouncement({ scheduled_at: new Date(2026, 10, 29, 9).toISOString() }, undefined)).toContain('לקוח');
});
