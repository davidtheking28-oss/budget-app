import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ state: [], cursor: 0, pending: [], payloads: [] }));
vi.mock('react', () => ({
  useCallback: fn => fn,
  useEffect: () => {},
  useRef: initial => {
    const index = harness.cursor++;
    if (!(index in harness.state)) harness.state[index] = { current: initial };
    return harness.state[index];
  },
  useState: initial => {
    const index = harness.cursor++;
    if (!(index in harness.state)) harness.state[index] = initial;
    return [harness.state[index], value => {
      harness.state[index] = typeof value === 'function' ? value(harness.state[index]) : value;
    }];
  }
}));
vi.mock('../supabaseClient.js', () => ({
  supabase: { from: () => ({ update: payload => {
    harness.payloads.push(payload);
    return {
      eq() { return this; },
      then(resolve, reject) { return new Promise((done, fail) => harness.pending.push({ done, fail })).then(resolve, reject); }
    };
  } }) }
}));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('./bizSync.js', () => ({
  saveBusinessPatch: (_db, _advisor, id, patch) => {
    harness.payloads?.push({ data: { ...harness.saved[id], ...patch } });
    return new Promise((resolve, reject) => {
      const finish = result => {
        if (result.error) { resolve(result); return; }
        harness.saved[id] = { ...harness.saved[id], ...patch };
        resolve({ data: harness.saved[id], error: null });
      };
      harness.pending.push({ done: finish, fail: reject });
    });
  }
}));

import { useBizRecords } from './useBizRecords.js';

beforeEach(() => {
  harness.saved = { first: { amount: 100, receipt: false }, second: { amount: 200, receipt: false } };
  harness.cursor = 0;
  harness.pending = [];
  harness.payloads = [];
  harness.state = [[{ id: 'first', data: { amount: 100, receipt: false } }]];
});

const sent = n => vi.waitFor(() => expect(harness.pending).toHaveLength(n));

describe('ordered saves to one business record', () => {
  it('sends rapid edits in order and merges separate fields', async () => {
    const { update } = useBizRecords('advisor', 'finance_entry');
    const first = update('first', { amount: 300 });
    const second = update('first', { receipt: true });
    await sent(1);
    expect(harness.state[0][0].data).toEqual({ amount: 300, receipt: true });
    harness.pending[0].done({ error: null });
    expect(await first).toBe(true);
    await sent(2);
    expect(harness.payloads[1].data).toEqual({ amount: 300, receipt: true });
    harness.pending[1].done({ error: null });
    expect(await second).toBe(true);
    expect(harness.state[0][0].data).toEqual({ amount: 300, receipt: true });
  });

  it('does not carry a failed edit into the next save', async () => {
    const { update } = useBizRecords('advisor', 'finance_entry');
    const first = update('first', { amount: 300 });
    const second = update('first', { receipt: true });
    await sent(1);
    harness.pending[0].done({ error: { message: 'failed' } });
    expect(await first).toBe(false);
    await sent(2);
    expect(harness.payloads[1].data).toEqual({ amount: 100, receipt: true });
    harness.pending[1].done({ error: null });
    expect(await second).toBe(true);
    expect(harness.state[0][0].data).toEqual({ amount: 100, receipt: true });
  });

  it('restores confirmed data after both pending saves fail', async () => {
    const { update } = useBizRecords('advisor', 'finance_entry');
    const first = update('first', { amount: 300 });
    const second = update('first', { amount: 400 });
    await sent(1);
    harness.pending[0].done({ error: { message: 'failed' } });
    expect(await first).toBe(false);
    await sent(2);
    harness.pending[1].done({ error: { message: 'failed' } });
    expect(await second).toBe(false);
    expect(harness.state[0][0].data).toEqual({ amount: 100, receipt: false });
  });

  it('continues after a rejected request', async () => {
    const { update } = useBizRecords('advisor', 'finance_entry');
    const first = update('first', { amount: 300 });
    const second = update('first', { amount: 400 });
    await sent(1);
    harness.pending[0].fail(new Error('offline'));
    expect(await first).toBe(false);
    await sent(2);
    harness.pending[1].done({ error: null });
    expect(await second).toBe(true);
    expect(harness.state[0][0].data.amount).toBe(400);
  });
});
