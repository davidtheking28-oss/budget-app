import { describe, it, expect } from 'vitest';
import { monthSummary, effectiveIncome, budgetCarry, effectiveLimit } from './budgetMath.js';

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

describe('budget rollover parity with the client app', () => {
  const mkData = (tx, rollover) => ({
    budgets: { 'מזון לבית': 1000 },
    transactions: tx,
    settings: { budgetRollover: rollover },
  });

  it('is inert when the client has rollover disabled', () => {
    const data = mkData([{ type: 'income', cat: 'שכר', amount: 5000, date: '2026-01-05' }], false);
    expect(budgetCarry(data, 'מזון לבית', 2026, 1)).toBe(0);
    expect(effectiveLimit(data, 'מזון לבית', 2026, 1)).toBe(1000);
  });

  it('carries an unused surplus into the next month', () => {
    const data = mkData([{ type: 'income', cat: 'שכר', amount: 5000, date: '2026-01-05' }], true);
    expect(effectiveLimit(data, 'מזון לבית', 2026, 1)).toBe(2000);
  });

  it('does not charge an overspend twice', () => {
    // Jan unused (+1000) -> Feb limit 2000; spending 1500 in Feb is legal
    const data = mkData([
      { type: 'income', cat: 'שכר', amount: 5000, date: '2026-01-05' },
      { type: 'expense', cat: 'מזון לבית', amount: 1500, date: '2026-02-10' },
    ], true);
    expect(effectiveLimit(data, 'מזון לבית', 2026, 2)).toBe(1500);
  });

  it('compounds a surplus across several months', () => {
    const data = mkData([
      { type: 'income', cat: 'שכר', amount: 5000, date: '2026-01-05' },
      { type: 'income', cat: 'שכר', amount: 5000, date: '2026-02-05' },
    ], true);
    expect(effectiveLimit(data, 'מזון לבית', 2026, 2)).toBe(3000);
  });

  it('does not flag over-budget when the carry covers the spend', () => {
    const data = mkData([
      { type: 'income', cat: 'שכר', amount: 5000, date: '2026-01-05' },
      { type: 'expense', cat: 'מזון לבית', amount: 1200, date: '2026-02-10' },
    ], true);
    expect(monthSummary(data, 2026, 1).overCats).toEqual([]);
  });

  it('still flags a genuine overspend', () => {
    const data = mkData([{ type: 'expense', cat: 'מזון לבית', amount: 1200, date: '2026-02-10' }], false);
    const over = monthSummary(data, 2026, 1).overCats;
    expect(over).toHaveLength(1);
    expect(over[0].over).toBe(200);
  });
});

describe('totalBudget reflects the effective ceiling', () => {
  it('equals the nominal budget when rollover is off', () => {
    const data = { budgets: { 'מזון לבית': 1000 }, transactions: [], settings: {} };
    expect(monthSummary(data, 2026, 1).totalBudget).toBe(1000);
  });

  it('includes the carry when rollover is on, so projections do not false-alarm', () => {
    const data = {
      budgets: { 'מזון לבית': 1000 },
      transactions: [{ type: 'income', cat: 'שכר', amount: 5000, date: '2026-01-05' }],
      settings: { budgetRollover: true },
    };
    const s = monthSummary(data, 2026, 1);
    expect(s.totalBudget).toBe(2000);
    expect(s.remaining).toBe(2000);
  });
});
