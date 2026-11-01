import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ effects: [], events: [], pending: [], denied: false, slow: false, writes: 0 }));
vi.mock('react', () => ({ useCallback: fn => fn, useReducer: () => [0, () => {}], useEffect: fn => state.effects.push(fn) }));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../supabaseClient.js', () => ({ supabase: {
  from: () => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: () => state.slow ? new Promise(resolve => state.pending.push(resolve)) : Promise.resolve(state.denied ? { data: null, error: { message: 'denied' } } : { data: { transactions: [{ id: 'private' }] }, error: null }),
      upsert: async () => { state.writes++; return { error: null }; }
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
  Object.assign(state, { effects: [], events: [], pending: [], denied: false, slow: false, writes: 0 });
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
