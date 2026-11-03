import { describe, expect, it } from 'vitest';
import { cashflow, currentStage, emptyJourney, journeyAttention, journeyProgress, nextMeeting, readJourney, syncJourneyMeetings } from './journeyMath.js';

describe('journeyMath', () => {
  it('counts fifteen steps and starts at zero', () => {
    expect(journeyProgress(null)).toEqual({ done: 0, total: 15, rate: 0 });
  });

  it('counts onboarding, meetings, followups and recommendation', () => {
    const j = emptyJourney();
    j.onboarding = { whatsapp: true, questionnaire: true };
    j.meetings.m1.done = true;
    j.meetings.m2.followups[0] = true;
    j.recommendation.received = true;
    expect(journeyProgress(j).done).toBe(5);
  });

  it('names the current stage', () => {
    expect(currentStage(null)).toBe('קליטה: לפני פגישה 1');
    const j = emptyJourney();
    j.onboarding = { whatsapp: true, questionnaire: true, uploaded: true, docsOk: true };
    expect(currentStage(j)).toBe('פגישה 1: מיפוי');
    j.meetings.m1.done = true;
    expect(currentStage(j)).toBe('אחרי פגישה 1');
    expect(nextMeeting(j).title).toBe('פגישה 2: בניית תוכנית כלכלית');
  });

  it('finishes after the last meeting and recommendation', () => {
    const j = emptyJourney();
    Object.values(j.meetings).forEach(m => { m.done = true; });
    expect(currentStage(j)).toBe('בקשת המלצה');
    j.recommendation.received = true;
    expect(currentStage(j)).toBe('התהליך הושלם');
    expect(nextMeeting(j)).toBeNull();
  });

  it('computes cashflow from text amounts', () => {
    expect(cashflow({ income: '12,000', expenses: '9500' })).toBe(2500);
    expect(cashflow({})).toBe(0);
  });

  it('lists what still needs handling', () => {
    expect(journeyAttention(null)).toHaveLength(3);
    expect(journeyAttention({ onboarding: { whatsapp: true, questionnaire: true, uploaded: true, docsOk: true } })).toEqual([]);
  });

  it('tolerates partial stored data', () => {
    const j = readJourney({ meetings: { m2: { done: true } } });
    expect(j.meetings.m2.followups).toHaveLength(3);
    expect(j.meetings.m1.tasks).toEqual([]);
  });
});


describe('journey and booked meetings synchronization', () => {
  const now = new Date('2026-11-03T15:00:00Z');
  const appointments = [{ id: 'first', scheduled_at: '2026-11-03T11:00:00Z', status: 'pending', for_client: true }, { id: 'next', scheduled_at: '2026-11-07T13:00:00Z', status: 'pending', for_client: true }];
  it('keeps the held first meeting and shows the booked second meeting as awaiting confirmation', () => {
    const raw = emptyJourney();raw.meetings.m1.done = true;
    const journey = syncJourneyMeetings(raw, appointments, now);
    expect(currentStage(journey)).toBe('אחרי פגישה 1');
    expect(journey.meetings.m1.meetingId).toBe('first');
    expect(nextMeeting(journey)).toMatchObject({ title: 'פגישה 2: בניית תוכנית כלכלית', date: '2026-11-07', status: 'pending' });
    expect(raw.meetings.m1.date).toBe('');
  });
  it('does not mark a meeting as held merely because its date passed', () => {
    const journey = syncJourneyMeetings(null, appointments, now);
    expect(journey.meetings.m1.done).toBe(false);
    expect(currentStage(journey)).toBe('קליטה: לפני פגישה 1');
  });
  it('tracks confirmation and rescheduling of the same appointment', () => {
    const raw = emptyJourney();raw.meetings.m1.done = true;
    const first = syncJourneyMeetings(raw, appointments, now);
    const next = syncJourneyMeetings(first, [appointments[0], { ...appointments[1], scheduled_at: '2026-11-08T13:00:00Z', status: 'confirmed' }], now);
    expect(nextMeeting(next)).toMatchObject({ date: '2026-11-08', status: 'confirmed' });
    expect(next.meetings.m2.meetingId).toBe('next');
  });
  it('clears a deleted booking and does not offer a declined appointment as scheduled', () => {
    const raw = emptyJourney();raw.meetings.m1.done = true;
    const first = syncJourneyMeetings(raw, appointments, now);
    expect(nextMeeting(syncJourneyMeetings(first, [appointments[0]], now)).date).toBe('');
    expect(nextMeeting(syncJourneyMeetings(first, [appointments[0], { ...appointments[1], status: 'declined' }], now))).toMatchObject({ date: '', status: 'declined' });
  });
});
