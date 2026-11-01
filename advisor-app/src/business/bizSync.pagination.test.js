import { describe, expect, it } from 'vitest';
import { loadBusinessRecords } from './bizSync.js';

function source(failSecond = false) {
  const rows = Array.from({ length: 2105 }, (_, i) => ({ id: String(i), advisor_id: 'advisor', kind: 'finance_entry', period: '2026-01', data: { amount: 10 } }));
  const requests = [];
  const db = { from: () => {
    const filters = [];
    const query = {
      select: () => query,
      eq: (key, value) => { filters.push([key, value]); return query; },
      order: () => query,
      range: async (from, to) => {
        requests.push([from, to]);
        if (failSecond && from > 0) return { data: null, error: { message: 'offline' } };
        const matches = rows.filter(row => filters.every(([key, value]) => row[key] === value));
        return { data: matches.slice(from, to + 1), count: matches.length, error: null };
      }
    };
    return query;
  } };
  return { db, requests };
}

describe('complete business record loading', () => {
  it('collects all pages beyond the server row limit', async () => {
    const store = source();
    const result = await loadBusinessRecords(store.db, 'advisor', 'finance_entry');
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2105);
    expect(result.data.reduce((sum, row) => sum + row.data.amount, 0)).toBe(21050);
    expect(store.requests).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('preserves advisor and month filters', async () => {
    const store = source();
    expect((await loadBusinessRecords(store.db, 'other', 'finance_entry')).data).toEqual([]);
    expect((await loadBusinessRecords(store.db, 'advisor', 'finance_entry', '2026-02')).data).toEqual([]);
  });
  it('reports a failed later page instead of presenting incomplete totals', async () => {
    const store = source(true);
    const result = await loadBusinessRecords(store.db, 'advisor', 'finance_entry');
    expect(result.data).toBeNull();
    expect(result.error.message).toBe('offline');
  });
});
