import { describe, it, expect, vi } from 'vitest';
import { stampSync } from './useClientBudget.js';
import { updateItem, removeItem } from './itemHelpers.js';
import { getMonthTx } from './monthUtils.js';
import { filterMonthTx, txPatchFromForm } from './txHelpers.js';

vi.mock('../toast.js', () => ({ toast: vi.fn() }));
import { toast } from '../toast.js';

function fakeStore(initial) {
  const store = { data: initial };
  store.save = async fn => {
    const patch = stampSync(store.data, fn(store.data), 5000);
    store.data = { ...store.data, ...patch };
    return true;
  };
  return store;
}

const tx = (id, over = {}) => ({ id, type: 'expense', cat: 'מזון לבית', desc: id, amount: 10, date: '2026-10-05', recurring: false, u: 1000, ...over });

describe('advisor transaction delete and edit', () => {
  it('delete writes a tombstone and undo re-inserts the same object', async () => {
    const a = tx('a');
    const store = fakeStore({ transactions: [a, tx('b')] });
    await removeItem(store.save, 'transactions', 'a', 'x');
    expect(store.data.transactions.map(t => t.id)).toEqual(['b']);
    expect(store.data.sync_meta.del.tx.a).toBe(5000);

    const undo = toast.mock.calls.at(-1)[2].onClick;
    await undo();
    const back = store.data.transactions.find(t => t.id === 'a');
    expect(back).toEqual({ ...a, u: 5000 });
  });

  it('editing the original keeps the stored category when display remaps it', async () => {
    const ins = tx('i', { cat: 'בריאות', desc: 'ביטוח בריאות' });
    const store = fakeStore({ transactions: [ins] });
    expect(getMonthTx(store.data.transactions, 2026, 9)[0].cat).toBe('ביטוחים');

    await updateItem(store.save, 'transactions', 'i', { amount: 99 });
    const saved = store.data.transactions[0];
    expect(saved.cat).toBe('בריאות');
    expect(saved.amount).toBe(99);
    expect(saved.u).toBe(5000);
  });
});

describe('txHelpers', () => {
  it('validates the edit form', () => {
    const ok = { cat: 'שכר', desc: ' משכורת ', amount: '100', date: '2026-10-01' };
    expect(txPatchFromForm(ok).patch).toEqual({ cat: 'שכר', desc: 'משכורת', amount: 100, date: '2026-10-01' });
    expect(txPatchFromForm({ ...ok, desc: ' ' }).error).toBeTruthy();
    expect(txPatchFromForm({ ...ok, amount: '0' }).error).toBeTruthy();
    expect(txPatchFromForm({ ...ok, date: '' }).error).toBeTruthy();
  });

  it('filters by type and sorts newest first', () => {
    const list = [tx('a', { date: '2026-10-01' }), tx('b', { type: 'income', date: '2026-10-09' }), tx('c', { date: '2026-10-05' })];
    expect(filterMonthTx(list, 'all').map(t => t.id)).toEqual(['b', 'c', 'a']);
    expect(filterMonthTx(list, 'expense').map(t => t.id)).toEqual(['c', 'a']);
    expect(filterMonthTx(list, 'income').map(t => t.id)).toEqual(['b']);
  });
});
