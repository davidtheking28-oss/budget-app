import { describe, it, expect } from 'vitest';
import { computeInsights, computeHealthScore } from './insights.js';

describe('computeInsights', () => {
  it('flags an over-budget category as a danger insight', () => {
    const data = {
      budgets: { 'מזון': 1000 },
      transactions: [{ type: 'expense', cat: 'מזון', amount: 1300, date: '2020-03-10' }]
    };
    const insights = computeInsights(data, 2020, 2);
    expect(insights).toContainEqual(expect.objectContaining({ kind: 'danger' }));
  });

  it('flags a large unbudgeted category as a tip insight', () => {
    const data = {
      budgets: {},
      transactions: [{ type: 'expense', cat: 'בילויים', amount: 500, date: '2020-03-10' }]
    };
    const insights = computeInsights(data, 2020, 2);
    expect(insights).toContainEqual(expect.objectContaining({ kind: 'tip' }));
  });

  it('does not flag a small unbudgeted category', () => {
    const data = {
      budgets: {},
      transactions: [{ type: 'expense', cat: 'בילויים', amount: 50, date: '2020-03-10' }]
    };
    const insights = computeInsights(data, 2020, 2);
    expect(insights.find(i => i.kind === 'tip')).toBeUndefined();
  });

  it('returns no insights for a clean past month with no data', () => {
    const insights = computeInsights({ budgets: {}, transactions: [] }, 2020, 2);
    expect(insights).toEqual([]);
  });
});

describe('computeHealthScore', () => {
  it('scores 100 for a month with no spending and no budgets', () => {
    expect(computeHealthScore({ budgets: {}, transactions: [] }, 2026, 5)).toBe(100);
  });

  it('deducts for each over-budget category', () => {
    const data = {
      budgets: { 'מזון': 1000 },
      transactions: [
        { type: 'income', cat: 'משכורת', amount: 5000, date: '2026-06-01' },
        { type: 'expense', cat: 'מזון', amount: 1300, date: '2026-06-10' }
      ]
    };
    expect(computeHealthScore(data, 2026, 5)).toBe(88);
  });

  it('deducts heavily for negative savings rate', () => {
    const data = {
      budgets: {},
      transactions: [
        { type: 'income', cat: 'משכורת', amount: 3000, date: '2026-06-01' },
        { type: 'expense', cat: 'מזון', amount: 4000, date: '2026-06-10' }
      ]
    };
    expect(computeHealthScore(data, 2026, 5)).toBe(70);
  });

  it('never drops below 0', () => {
    const data = {
      budgets: { a: 100, b: 100, c: 100, d: 100, e: 100, f: 100, g: 100, h: 100, i: 100 },
      transactions: 'abcdefghi'.split('').map(cat => ({ type: 'expense', cat, amount: 200, date: '2026-06-10' }))
    };
    expect(computeHealthScore(data, 2026, 5)).toBeGreaterThanOrEqual(0);
  });
});
