import { describe, it, expect } from 'vitest';
import { computeCategoryAverages } from './mappingMath.js';

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
});
