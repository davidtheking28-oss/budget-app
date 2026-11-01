import { describe, expect, it } from 'vitest';
import { saveBusinessPatch } from './bizSync.js';

function database() {
  let row = { id: 'record', advisor_id: 'advisor', data: { amount: 1000, receipt: false }, updated_at: '2026-01-01T00:00:00.000Z' };
  let writes = 0;
  let alwaysConflict = false;
  const db = { from: () => {
    const filters = [];
    let patch;
    const query = {
      select: () => query,
      eq: (key, value) => { filters.push([key, value]); return query; },
      is: (key, value) => { filters.push([key, value]); return query; },
      update: value => { patch = value; return query; },
      maybeSingle: async () => {
        if (!row || !filters.every(([key, value]) => row[key] === value)) return { data: null, error: null };
        if (patch) {
          writes++;
          if (alwaysConflict) return { data: null, error: null };
          row = { ...row, ...patch };
        }
        return { data: structuredClone(row), error: null };
      }
    };
    return query;
  } };
  return { db, row: () => row, remove: () => { row = null; }, conflict: () => { alwaysConflict = true; }, writes: () => writes };
}

describe('business saves across windows', () => {
  it('merges concurrent changes to separate fields without losing either', async () => {
    const store = database();
    const results = await Promise.all([
      saveBusinessPatch(store.db, 'advisor', 'record', { amount: 2500 }),
      saveBusinessPatch(store.db, 'advisor', 'record', { receipt: true })
    ]);
    expect(results.every(result => !result.error)).toBe(true);
    expect(store.row().data).toEqual({ amount: 2500, receipt: true });
  });

  it('preserves a value saved before an old window changes another field', async () => {
    const store = database();
    await saveBusinessPatch(store.db, 'advisor', 'record', { amount: 2500 });
    await saveBusinessPatch(store.db, 'advisor', 'record', { receipt: true });
    expect(store.row().data).toEqual({ amount: 2500, receipt: true });
  });

  it('does not recreate a deleted or inaccessible record', async () => {
    const store = database();
    store.remove();
    expect((await saveBusinessPatch(store.db, 'advisor', 'record', { amount: 2500 })).error.code).toBe('not_found');
    expect(store.writes()).toBe(0);
  });

  it('does not update a record belonging to another advisor', async () => {
    const store = database();
    expect((await saveBusinessPatch(store.db, 'other', 'record', { amount: 2500 })).error.code).toBe('not_found');
    expect(store.row().data.amount).toBe(1000);
  });

  it('stops retrying and reports unresolved conflicts', async () => {
    const store = database();
    store.conflict();
    expect((await saveBusinessPatch(store.db, 'advisor', 'record', { amount: 2500 })).error.code).toBe('sync_conflict');
    expect(store.writes()).toBe(4);
  });
});
