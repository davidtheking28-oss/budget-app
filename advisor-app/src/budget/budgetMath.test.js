import { describe, it, expect, vi, afterEach } from 'vitest';
import { monthSummary, effectiveIncome, budgetCarry, effectiveLimit, incomeSourcesFor, budgetActuals, averageMonthSummary, incomeActualsBySource } from './budgetMath.js';

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

describe('per-month income sources', () => {
  const settings = {
    incomeSources: [{ name: 'שכר', amount: '12000' }],
    incomeHistory: {
      '0000-00': [{ name: 'שכר', amount: '10000' }],
      '2026-10': [{ name: 'שכר', amount: '12000' }]
    }
  };
  const tx = d => ({ id: d, type: 'expense', cat: 'מזון', amount: 50, date: d });

  it('uses the latest snapshot at or before the month', () => {
    expect(incomeSourcesFor(settings, 2026, 8)[0].amount).toBe('10000');
    expect(incomeSourcesFor(settings, 2026, 9)[0].amount).toBe('12000');
    expect(incomeSourcesFor(settings, 2027, 0)[0].amount).toBe('12000');
  });

  it('falls back to the current sources when there is no history', () => {
    expect(incomeSourcesFor({ incomeSources: [{ name: 'x', amount: '5' }] }, 2020, 0)[0].amount).toBe('5');
  });

  it('a salary change does not rewrite past months in monthSummary', () => {
    const data = { settings, transactions: [tx('2026-09-05'), tx('2026-10-05')] };
    expect(monthSummary(data, 2026, 8).income).toBe(10000);
    expect(monthSummary(data, 2026, 9).income).toBe(12000);
  });
});

describe('income for a month with no activity matches the client app', () => {
  afterEach(() => vi.useRealTimers());
  const data = { settings: { incomeSources: [{ name: 'שכר', amount: '10000' }] }, transactions: [] };

  it('a past month with no transactions has no source income', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 15));
    expect(monthSummary(data, 2026, 8).income).toBe(0);
  });

  it('the current month still counts unposted sources', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 15));
    expect(monthSummary(data, 2026, 9).income).toBe(10000);
  });
});


describe('budget actuals and average month reconciliation', () => {
  const savings = 'קרן חיסכון';
  const fixture = {
    settings: { incomeSources: [{ name: 'שכר', amount: 10000 }] },
    fixed_expenses: [{ id: 'הוצאה קבועה מותאמת', amount: 800 }, { id: savings, amount: 300, savings: true }],
    transactions: [
      { type: 'expense', cat: 'הוצאה קבועה מותאמת', amount: 800, date: '2026-10-01' },
      { type: 'saving', cat: savings, amount: 300, date: '2026-10-02' },
      { type: 'expense', cat: 'מזון לבית', amount: 900, date: '2026-09-01' }
    ]
  };
  it('classifies custom fixed expenses once and includes savings transactions', () => {
    const actual = budgetActuals(fixture, fixture.transactions);
    expect(actual.fixed).toEqual({ 'הוצאה קבועה מותאמת': 800, [savings]: 300 });
    expect(actual.variable).toEqual({ 'מזון לבית': 900 });
    expect(actual.savings).toBe(300);
  });
  it('keeps zero actual income distinct from the planned income', () => {
    expect(averageMonthSummary(fixture)).toEqual({ months: 2, income: 0, fixed: 550, variable: 450, savings: 150 });
  });
  it('reconciles a one-month average with monthly actual cash flow', () => {
    const transactions = [...fixture.transactions.slice(0, 2), { type: 'income', amount: 10000, date: '2026-10-01' }];
    const actual = budgetActuals(fixture, transactions);
    const avg = averageMonthSummary({ ...fixture, transactions });
    expect(avg.income - avg.fixed - avg.variable).toBe(actual.income - 1100);
    expect(avg.savings).toBe(actual.savings);
  });
  it('returns no average when there are no recorded months', () => {
    expect(averageMonthSummary({ transactions: [] })).toBeNull();
  });
});


describe('mapping fixed expenses in average month', () => {
  it('replaces a matching recorded category instead of double counting', () => {
    const avg = averageMonthSummary({ fixed_expenses: [{ id: 'חשמל', amount: 420, linkedSource: 'mapping' }], transactions: [
      { type: 'expense', cat: 'חשמל', amount: 600, date: '2026-10-01' },
      { type: 'expense', cat: 'מזון לבית', amount: 200, date: '2026-10-02' }
    ] });
    expect(avg.fixed).toBe(420);
    expect(avg.variable).toBe(200);
    expect(avg.mappedFixed).toBe(true);
  });
  it('shows mapped fixed amounts even before any transactions exist', () => {
    expect(averageMonthSummary({ fixed_expenses: [{ id: 'משכנתא', amount: 3000, linkedSource: 'mapping' }], transactions: [] })).toMatchObject({ months: 0, income: 0, fixed: 3000, variable: 0, mappedFixed: true });
  });
});


it('cleared mapped categories do not reappear from old transactions in the combined average', () => {
  const avg = averageMonthSummary({ fixed_expenses: [{ id: 'חשמל', amount: 0, linkedSource: 'mapping' }], transactions: [{ type: 'expense', cat: 'חשמל', amount: 600, date: '2026-10-01' }] });
  expect(avg.fixed).toBe(0);
});
describe('income actuals by source',()=>{
  it('shows actual transactions rather than copying planned income',()=>{
    expect(incomeActualsBySource([],[{name:'שכר',amount:10000}])).toEqual({amounts:[0],unmatched:0});
  });
  it('sums partial income postings and ignores expenses',()=>{
    expect(incomeActualsBySource([{type:'income',desc:'שכר',amount:4000},{type:'income',desc:'שכר',amount:2500},{type:'expense',desc:'שכר',amount:900}],[{name:'שכר'}])).toEqual({amounts:[6500],unmatched:0});
  });
  it('normalizes case and spaces but does not guess a different income source',()=>{
    expect(incomeActualsBySource([{type:'income',desc:' DJ ',amount:500},{type:'income',desc:'העברה',amount:200}],[{name:'dj'},{name:'משכורת שלי'}])).toEqual({amounts:[500,0],unmatched:200});
  });
  it('never counts the same transaction twice when source names are duplicated',()=>{
    const result=incomeActualsBySource([{type:'income',desc:'שכר',amount:1000}],[{name:'שכר'},{name:'שכר'}]);
    expect(result.amounts.reduce((sum,n)=>sum+n,0)+result.unmatched).toBe(1000);
  });
});
