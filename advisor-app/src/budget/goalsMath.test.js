import { describe, it, expect } from 'vitest';
import { monthsToTarget, baselineMonthlySaving, savingsSeries } from './goalsMath.js';

describe('goalsMath', () => {
  it('rounds months up and handles no saving', () => {
    expect(monthsToTarget(10000, 1500)).toBe(7);
    expect(monthsToTarget(0, 0)).toBe(0);
    expect(monthsToTarget(500, 0)).toBe(Infinity);
  });
  it('averages goal deposits of the last three months', () => {
    const today = new Date(2026, 9, 18);
    const tx = [
      { goalTx: true, type: 'expense', date: '2026-10-01', amount: 900 },
      { goalTx: true, type: 'expense', date: '2026-08-25', amount: 600 },
      { goalTx: true, type: 'expense', date: '2026-01-01', amount: 5000 },
      { goalTx: true, type: 'income', date: '2026-10-02', amount: 700 },
      { type: 'expense', date: '2026-10-03', amount: 800 },
    ];
    expect(baselineMonthlySaving(tx, today)).toBe(500);
  });
  it('caps the series at the target', () => {
    expect(savingsSeries(1000, 600, 2000, 3)).toEqual([1000, 1600, 2000, 2000]);
  });
});
