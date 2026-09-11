import { describe, it, expect } from 'vitest';
import { countNewThisWeek } from './clientStats.js';

describe('countNewThisWeek', () => {
  it('counts only clients created within the last 7 days', () => {
    const now = new Date('2026-09-11T12:00:00Z').getTime();
    const clients = [
      { createdAt: new Date('2026-09-10T12:00:00Z').toISOString() }, // 1 day ago
      { createdAt: new Date('2026-09-01T12:00:00Z').toISOString() }, // 10 days ago
      { createdAt: null }
    ];
    expect(countNewThisWeek(clients, now)).toBe(1);
  });

  it('returns 0 for an empty list', () => {
    expect(countNewThisWeek([], Date.now())).toBe(0);
  });
});
