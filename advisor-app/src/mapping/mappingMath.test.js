import { describe, it, expect } from 'vitest';
import { computeCategoryAverages, computeCashflowSummary } from './mappingMath.js';

describe('computeCategoryAverages', () => {
  it('averages a category over 3 full months', () => {
    const transactions = [
      { source_month: '2026-01', category: 'מזון לבית', amount: 900 },
      { source_month: '2026-02', category: 'מזון לבית', amount: 1100 },
      { source_month: '2026-03', category: 'מזון לבית', amount: 1000 }
    ];
    const { averages, monthsCovered } = computeCategoryAverages(transactions);
    expect(monthsCovered).toBe(3);
    expect(averages['מזון לבית']).toBeCloseTo(1000);
  });

  it('averages over 2 months when only 2 are present', () => {
    const transactions = [
      { source_month: '2026-01', category: 'דלק וחניה', amount: 200 },
      { source_month: '2026-02', category: 'דלק וחניה', amount: 400 }
    ];
    const { averages, monthsCovered } = computeCategoryAverages(transactions);
    expect(monthsCovered).toBe(2);
    expect(averages['דלק וחניה']).toBe(300);
  });

  it('divides by total months present even for a category missing from one month', () => {
    const transactions = [
      { source_month: '2026-01', category: 'בריאות', amount: 300 },
      { source_month: '2026-02', category: 'מזון לבית', amount: 500 },
      { source_month: '2026-03', category: 'בריאות', amount: 300 }
    ];
    const { averages, monthsCovered } = computeCategoryAverages(transactions);
    expect(monthsCovered).toBe(3);
    expect(averages['בריאות']).toBeCloseTo(200);
  });

  it('treats two files tagged with the same month as one month for averaging', () => {
    const transactions = [
      { source_month: '2026-06', category: 'פארם', amount: 100 },
      { source_month: '2026-06', category: 'פארם', amount: 50 }
    ];
    const { averages, monthsCovered } = computeCategoryAverages(transactions);
    expect(monthsCovered).toBe(1);
    expect(averages['פארם']).toBe(150);
  });

  it('returns empty averages for empty input without dividing by zero', () => {
    const { averages, monthsCovered } = computeCategoryAverages([]);
    expect(averages).toEqual({});
    expect(monthsCovered).toBe(1);
  });

  it('excludes income transactions from category averages', () => {
    const transactions = [
      { source_month: '2026-01', category: 'שכר', amount: 8000, type: 'income' },
      { source_month: '2026-01', category: 'מזון לבית', amount: 900, type: 'expense' }
    ];
    const { averages } = computeCategoryAverages(transactions);
    expect(averages['שכר']).toBeUndefined();
    expect(averages['מזון לבית']).toBe(900);
  });
});

describe('computeCashflowSummary', () => {
  it('averages income, expense and savings across months present', () => {
    const transactions = [
      { source_month: '2026-01', amount: 8000, type: 'income', category: 'שכר' },
      { source_month: '2026-01', amount: 900, type: 'expense', category: 'מזון לבית' },
      { source_month: '2026-01', amount: 500, type: 'expense', category: 'הוראת קבע לחסכון' },
      { source_month: '2026-02', amount: 8000, type: 'income', category: 'שכר' },
      { source_month: '2026-02', amount: 1300, type: 'expense', category: 'מזון לבית' },
      { source_month: '2026-02', amount: 500, type: 'expense', category: 'הוראת קבע לחסכון' }
    ];
    const s = computeCashflowSummary(transactions);
    expect(s.monthsCovered).toBe(2);
    expect(s.income).toBe(8000);
    expect(s.expense).toBe(1600);
    expect(s.savings).toBe(500);
    expect(s.netInAccount).toBe(6400);
    expect(s.netExcludingSavings).toBe(6900);
    expect(s.hasIncomeData).toBe(true);
  });

  it('treats transactions with no type as expense, for mappings saved before income capture existed', () => {
    const transactions = [
      { source_month: '2026-01', amount: 900, category: 'מזון לבית' }
    ];
    const s = computeCashflowSummary(transactions);
    expect(s.income).toBe(0);
    expect(s.expense).toBe(900);
    expect(s.hasIncomeData).toBe(false);
  });

  it('returns zeroes for empty input without dividing by zero', () => {
    const s = computeCashflowSummary([]);
    expect(s.monthsCovered).toBe(1);
    expect(s.income).toBe(0);
    expect(s.expense).toBe(0);
    expect(s.netInAccount).toBe(0);
  });
});
