import { describe, expect, it } from 'vitest';
import { docsMissing, docsMonths } from './clientDocuments.js';

describe('docsMonths', () => {
  it('returns the three full months before the start month', () => {
    expect(docsMonths('2026-07-15T10:00:00')).toEqual(['2026-04-01', '2026-05-01', '2026-06-01']);
  });
  it('crosses the year boundary', () => {
    expect(docsMonths('2026-01-10T10:00:00')).toEqual(['2025-10-01', '2025-11-01', '2025-12-01']);
  });
});

describe('docsMissing', () => {
  const months = ['2026-04-01', '2026-05-01', '2026-06-01'];
  it('reports everything when nothing was uploaded', () => {
    expect(docsMissing([], months)).toHaveLength(6);
  });
  it('tracks bank and credit separately', () => {
    const rows = months.map(period_month => ({ kind: 'bank', period_month }));
    expect(docsMissing(rows, months)).toEqual(['credit|2026-04-01', 'credit|2026-05-01', 'credit|2026-06-01']);
  });
  it('is empty when all six are present', () => {
    const rows = months.flatMap(period_month => [{ kind: 'bank', period_month }, { kind: 'credit', period_month }]);
    expect(docsMissing(rows, months)).toEqual([]);
  });
});
