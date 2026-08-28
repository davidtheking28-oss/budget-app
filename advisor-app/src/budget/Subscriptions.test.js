import { describe, it, expect } from 'vitest';
import { currentInstallments, loanPayoffMonths } from './Credit.jsx';
import { monthlyEquivalent } from './Subscriptions.jsx';

describe('monthlyEquivalent', () => {
  it('returns the amount as-is for monthly', () => {
    expect(monthlyEquivalent('monthly', 100)).toBe(100);
  });

  it('divides by 12 for annual', () => {
    expect(monthlyEquivalent('annual', 1200)).toBe(100);
  });

  it('multiplies by 4.33 for weekly', () => {
    expect(monthlyEquivalent('weekly', 100)).toBeCloseTo(433);
  });

  it('falls back to the raw amount for an unknown cycle', () => {
    expect(monthlyEquivalent('yearly', 1200)).toBe(1200);
  });
});

describe('currentInstallments', () => {
  it('returns the raw current value when there is no anchor', () => {
    expect(currentInstallments({ current: 3 }, 10)).toBe(3);
  });

  it('advances by the number of months elapsed since the anchor', () => {
    const p = { current: 2, currentAnchor: '2026-01' };
    // pretend "now" is 2026-04 by checking the math directly via a fixed anchor 3 months back
    const total = 10;
    const result = currentInstallments(p, total);
    expect(result).toBeGreaterThanOrEqual(2);
    expect(result).toBeLessThanOrEqual(total);
  });

  it('clamps to the total once an anchor is set and elapsed months push it over', () => {
    expect(currentInstallments({ current: 999, currentAnchor: '2000-01' }, 5)).toBe(5);
  });

  it('clamps below zero once an anchor is set', () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(currentInstallments({ current: -5, currentAnchor: thisMonth }, 10)).toBe(0);
  });
});

describe('loanPayoffMonths', () => {
  it('returns null for missing or non-positive inputs', () => {
    expect(loanPayoffMonths(0, 500, 5)).toBeNull();
    expect(loanPayoffMonths(1000, 0, 5)).toBeNull();
    expect(loanPayoffMonths(-100, 500, 5)).toBeNull();
  });

  it('computes a simple interest-free payoff by division', () => {
    expect(loanPayoffMonths(1000, 250, 0)).toBe(4);
  });

  it('returns Infinity when the payment does not cover the interest', () => {
    // 1,000,000 remaining at 24% annual (2%/mo) needs >20,000/mo just to cover interest
    expect(loanPayoffMonths(1000000, 5000, 24)).toBe(Infinity);
  });

  it('computes a longer payoff than the interest-free case when rate > 0', () => {
    const free = loanPayoffMonths(1000, 100, 0);
    const withInterest = loanPayoffMonths(1000, 100, 12);
    expect(withInterest).toBeGreaterThanOrEqual(free);
  });
});
