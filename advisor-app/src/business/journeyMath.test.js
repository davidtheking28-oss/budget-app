import { describe, expect, it } from 'vitest';
import { cashflow, currentStage, emptyJourney, journeyAttention, journeyProgress, nextMeeting, readJourney } from './journeyMath.js';

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
