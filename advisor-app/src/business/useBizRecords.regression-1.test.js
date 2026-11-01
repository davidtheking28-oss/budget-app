import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ state: [], cursor: 0, pending: [] }));
vi.mock('react', () => ({
  useCallback: fn => fn,
  useEffect: () => {},
  useState: initial => {
    const index = harness.cursor++;
    if (!(index in harness.state)) harness.state[index] = initial;
    return [harness.state[index], value => {
      harness.state[index] = typeof value === 'function' ? value(harness.state[index]) : value;
    }];
  }
}));
vi.mock('../supabaseClient.js', () => ({
  supabase: { from: () => ({ update: () => ({
    eq() { return this; },
    then(resolve, reject) { return new Promise(done => harness.pending.push(done)).then(resolve, reject); }
  }) }) }
}));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));

import { useBizRecords } from './useBizRecords.js';

beforeEach(() => {
  harness.cursor = 0;
  harness.pending = [];
  harness.state = [[
    { id: 'first', data: { amount: 100, receipt: false } },
    { id: 'second', data: { amount: 200, receipt: false } }
  ]];
});

describe('business record rollback during concurrent saves', () => {
  it('keeps another record whose save succeeded when an earlier request fails', async () => {
    const { update } = useBizRecords('advisor', 'finance_entry');
    const first = update('first', { receipt: true });
    const second = update('second', { receipt: true });
    await Promise.resolve();
    harness.pending[1]({ error: null });
    expect(await second).toBe(true);
    harness.pending[0]({ error: { message: 'failed' } });
    expect(await first).toBe(false);
    expect(harness.state[0]).toEqual([
      { id: 'first', data: { amount: 100, receipt: false } },
      { id: 'second', data: { amount: 200, receipt: true } }
    ]);
  });

  it('does not revert a newer successful edit to the same record', async () => {
    const { update } = useBizRecords('advisor', 'finance_entry');
    const first = update('first', { amount: 300 });
    const second = update('first', { amount: 400 });
    await Promise.resolve();
    harness.pending[1]({ error: null });
    expect(await second).toBe(true);
    harness.pending[0]({ error: { message: 'failed' } });
    expect(await first).toBe(false);
    expect(harness.state[0][0].data.amount).toBe(400);
  });
});
