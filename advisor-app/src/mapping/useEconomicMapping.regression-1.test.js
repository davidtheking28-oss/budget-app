import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ effects: [], events: [], pending: [], denied: false, slow: false, writes: 0, readOffline: false, writeOffline: false }));
vi.mock('react', () => ({ useCallback: fn => fn, useReducer: () => [0, () => {}], useEffect: fn => state.effects.push(fn) }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../supabaseClient.js', () => ({ supabase: {
  from: () => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: () => state.readOffline ? Promise.reject(new TypeError('Failed to fetch')) : state.slow ? new Promise(resolve => state.pending.push(resolve)) : Promise.resolve(state.denied ? { data: null, error: { message: 'denied' } } : { data: { transactions: [{ id: 'private' }] }, error: null }),
      upsert: async () => { state.writes++; if (state.writeOffline) throw new TypeError('Failed to fetch'); return { error: null }; }
    };
    return query;
  },
  channel: () => {
    const channel = { on: (_type, config, callback) => { state.events.push({ config, callback }); return channel; }, subscribe: () => channel };
    return channel;
  },
  removeChannel: () => {}
} }));

beforeEach(() => {
  vi.resetModules();
  Object.assign(state, { effects: [], events: [], pending: [], denied: false, slow: false, writes: 0, readOffline: false, writeOffline: false });
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

async function setup() {
  const { useEconomicMapping: readMapping } = await import('./useEconomicMapping.js');
  readMapping('client', 'advisor');
  state.effects[0]();
  return () => readMapping('client', 'advisor');
}
const revoke = () => state.events.find(event => event.config.table === 'advisor_clients').callback({ eventType: 'UPDATE', new: { status: 'revoked' } });

describe('economic mapping access revocation', () => {
  it('removes cached data immediately and blocks another save', async () => {
    const current = await setup();
    await vi.waitFor(() => expect(current().data?.transactions).toHaveLength(1));
    revoke();
    expect(current().data).toBeNull();
    expect(current().error.message).toBe('access_revoked');
    expect(await current().save({ transactions: [] })).toBe(false);
    expect(state.writes).toBe(0);
  });

  it('does not restore private data from an older in-flight read', async () => {
    state.slow = true;
    const current = await setup();
    revoke();
    state.pending[0]({ data: { transactions: [{ id: 'private' }] }, error: null });
    await Promise.resolve();
    expect(current().data).toBeNull();
    expect(current().error.message).toBe('access_revoked');
  });

  it('rechecks access when returning online even if an event was missed', async () => {
    const current = await setup();
    await vi.waitFor(() => expect(current().data).not.toBeNull());
    state.denied = true;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(current().error?.message).toBe('denied'));
    expect(current().data).toBeNull();
  });
});

describe('economic mapping offline recovery', () => {
  it('rolls back a rejected network write and permits a successful retry', async () => {
    const current = await setup();
    await vi.waitFor(() => expect(current().data?.transactions).toHaveLength(1));
    state.writeOffline = true;
    await expect(current().save({ transactions: [{ id: 'unsaved' }] })).resolves.toBe(false);
    expect(current().data.transactions).toEqual([{ id: 'private' }]);
    state.writeOffline = false;
    expect(await current().save({ transactions: [{ id: 'saved' }] })).toBe(true);
    expect(current().data.transactions).toEqual([{ id: 'saved' }]);
  });

  it('reports a rejected network read and reloads after reconnection', async () => {
    state.readOffline = true;
    const current = await setup();
    await vi.waitFor(() => expect(current().error?.message).toBe('Failed to fetch'));
    expect(current().loading).toBe(false);
    state.readOffline = false;
    await current().reload();
    expect(current().error).toBeNull();
    expect(current().data.transactions).toEqual([{ id: 'private' }]);
  });
});
