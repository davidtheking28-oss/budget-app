import { describe, it, expect } from 'vitest';
import { monthSummary, effectiveIncome } from './budgetMath.js';

const data = {
  budgets: { 'מזון': 1000, 'בילויים': 500 },
  transactions: [
    { type: 'expense', cat: 'מזון', amount: 1300, date: '2026-06-10' },
    { type: 'expense', cat: 'בילויים', amount: 200, date: '2026-06-12' },
    { type: 'income', cat: 'משכורת', amount: 9000, date: '2026-06-01' },
    { type: 'expense', cat: 'מזון', amount: 999, date: '2026-05-10' }
  ]
};

describe('monthSummary', () => {
  it('sums income and expense for the given month only', () => {
    const s = monthSummary(data, 2026, 5);
    expect(s.income).toBe(9000);
    expect(s.expense).toBe(1500);
    expect(s.net).toBe(7500);
  });

  it('excludes transactions from other months', () => {
    const s = monthSummary(data, 2026, 4);
    expect(s.expense).toBe(999);
    expect(s.income).toBe(0);
  });

  it('flags categories that exceed their budget', () => {
    const s = monthSummary(data, 2026, 5);
    expect(s.overCats).toHaveLength(1);
    expect(s.overCats[0]).toMatchObject({ cat: 'מזון', limit: 1000, spent: 1300, over: 300 });
  });

  it('does not flag categories under budget', () => {
    const s = monthSummary(data, 2026, 5);
    expect(s.overCats.find(o => o.cat === 'בילויים')).toBeUndefined();
  });

  it('computes remaining as totalBudget minus expense when a budget is set', () => {
    const s = monthSummary(data, 2026, 5);
    expect(s.totalBudget).toBe(1500);
    expect(s.remaining).toBe(0);
  });

  it('returns null remaining when no budget is set', () => {
    const s = monthSummary({ budgets: {}, transactions: [] }, 2026, 5);
    expect(s.remaining).toBeNull();
  });

  it('handles missing transactions/budgets gracefully', () => {
    const s = monthSummary({}, 2026, 5);
    expect(s).toMatchObject({ income: 0, expense: 0, net: 0, totalBudget: 0, overCats: [], remaining: null });
  });
});

describe('effectiveIncome', () => {
  it('sums manual income transactions when there are no income sources', () => {
    const r = effectiveIncome([{ type: 'income', amount: 9000, desc: 'משכורת' }], []);
    expect(r).toEqual({ manualIncome: 9000, unpostedIncome: 0, income: 9000 });
  });

  it('counts an income source with no matching transaction as unposted', () => {
    const r = effectiveIncome([], [{ name: 'משכורת', amount: 18400 }]);
    expect(r).toEqual({ manualIncome: 0, unpostedIncome: 18400, income: 18400 });
  });

  it('does not double-count an income source already posted as a transaction', () => {
    const r = effectiveIncome([{ type: 'income', amount: 18400, desc: 'משכורת' }], [{ name: 'משכורת', amount: 18400 }]);
    expect(r).toEqual({ manualIncome: 18400, unpostedIncome: 0, income: 18400 });
  });

  it('matches income source names case-insensitively', () => {
    const r = effectiveIncome([{ type: 'income', amount: 18400, desc: 'MASKORET' }], [{ name: 'maskoret', amount: 18400 }]);
    expect(r).toEqual({ manualIncome: 18400, unpostedIncome: 0, income: 18400 });
  });

  it('handles multiple sources with only one posted', () => {
    const r = effectiveIncome(
      [{ type: 'income', amount: 18400, desc: 'משכורת' }],
      [{ name: 'משכורת', amount: 18400 }, { name: 'שכירות', amount: 3000 }]
    );
    expect(r).toEqual({ manualIncome: 18400, unpostedIncome: 3000, income: 21400 });
  });
});
