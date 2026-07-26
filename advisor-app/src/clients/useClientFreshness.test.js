import { describe, it, expect } from 'vitest';
import { relativeTime, isStale, STALE_DAYS } from './useClientFreshness.js';

const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();

describe('relativeTime', () => {
  it('labels today and yesterday', () => {
    expect(relativeTime(daysAgo(0))).toBe('היום');
    expect(relativeTime(daysAgo(1))).toBe('אתמול');
  });

  it('counts days within a week', () => {
    expect(relativeTime(daysAgo(3))).toBe('לפני 3 ימים');
  });

  it('switches to weeks, singular and plural', () => {
    expect(relativeTime(daysAgo(7))).toBe('לפני שבוע');
    expect(relativeTime(daysAgo(21))).toBe('לפני 3 שבועות');
  });

  it('switches to months', () => {
    expect(relativeTime(daysAgo(31))).toBe('לפני חודש');
    expect(relativeTime(daysAgo(95))).toBe('לפני 3 חודשים');
  });

  it('returns null for an unparseable date', () => {
    expect(relativeTime('not-a-date')).toBeNull();
  });
});

describe('isStale', () => {
  it('is false just under the threshold', () => {
    expect(isStale(daysAgo(STALE_DAYS - 1))).toBe(false);
  });

  it('is true at and past the threshold', () => {
    expect(isStale(daysAgo(STALE_DAYS))).toBe(true);
    expect(isStale(daysAgo(60))).toBe(true);
  });

  it('is false for an unparseable date rather than throwing', () => {
    expect(isStale('nope')).toBe(false);
  });
});
