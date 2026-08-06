import { describe, it, expect } from 'vitest';
import { stampSync, mergeSyncMeta } from './useClientBudget.js';

// Faithful copies of the client app's merge logic (index.html _mergeArrays / _mergeBudgets),
// so these tests fail if the advisor ever stops speaking the same sync protocol.
function clientMergeArrays(local, cloud, del) {
  const m = new Map();
  (cloud || []).forEach(it => { if (it && it.id != null) m.set(String(it.id), it); });
  (local || []).forEach(it => {
    if (!it || it.id == null) return;
    const id = String(it.id), ex = m.get(id);
    if (!ex || (it.u || 0) >= (ex.u || 0)) m.set(id, it);
  });
  del && Object.entries(del).forEach(([id, ts]) => {
    const it = m.get(id);
    if (it && (it.u || 0) <= ts) m.delete(id);
  });
  return [...m.values()];
}

function clientMergeBudgets(local, cloud, localBu, cloudBu, delMeta, mergedBu) {
  const cats = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);
  const out = {};
  cats.forEach(c => {
    const lt = (localBu && localBu[c]) || 0, ct = (cloudBu && cloudBu[c]) || 0;
    if (local && local[c] != null && (lt >= ct || cloud == null || cloud[c] == null)) out[c] = local[c];
    else if (cloud && cloud[c] != null) out[c] = cloud[c];
  });
  delMeta && Object.entries(delMeta).forEach(([c, ts]) => {
    if ((mergedBu[c] || 0) <= ts) delete out[c];
  });
  return out;
}

describe('advisor edits survive the client merge', () => {
  it('an edited subscription is not reverted by the client local copy', () => {
    const clientTs = 1000;
    const prev = { subscriptions: [{ id: 1, name: 'Netflix', amount: 55, u: clientTs }] };
    const patch = { subscriptions: [{ id: 1, name: 'Netflix', amount: 70, u: clientTs }] };

    const stamped = stampSync(prev, patch, 2000);
    expect(stamped.subscriptions[0].u).toBe(2000);

    const clientLocal = prev.subscriptions;
    const merged = clientMergeArrays(clientLocal, stamped.subscriptions, stamped.sync_meta.del.subs);
    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(70);
  });

  it('an untouched item keeps its timestamp so concurrent client edits are not clobbered', () => {
    const prev = { subscriptions: [{ id: 1, name: 'A', amount: 10, u: 1000 }, { id: 2, name: 'B', amount: 20, u: 1000 }] };
    const patch = { subscriptions: [{ id: 1, name: 'A', amount: 99, u: 1000 }, { id: 2, name: 'B', amount: 20, u: 1000 }] };

    const stamped = stampSync(prev, patch, 2000);
    expect(stamped.subscriptions[0].u).toBe(2000);
    expect(stamped.subscriptions[1].u).toBe(1000);

    // client edited item 2 meanwhile; its newer local copy must win
    const clientLocal = [{ id: 1, name: 'A', amount: 10, u: 1000 }, { id: 2, name: 'B', amount: 55, u: 3000 }];
    const merged = clientMergeArrays(clientLocal, stamped.subscriptions, stamped.sync_meta.del.subs);
    expect(merged.find(x => x.id === 1).amount).toBe(99);
    expect(merged.find(x => x.id === 2).amount).toBe(55);
  });

  it('a deleted transaction stays deleted instead of resurrecting', () => {
    const prev = { transactions: [{ id: 'a', amount: 10, u: 1000 }, { id: 'b', amount: 20, u: 1000 }] };
    const patch = { transactions: [{ id: 'a', amount: 10, u: 1000 }] };

    const stamped = stampSync(prev, patch, 2000);
    expect(stamped.sync_meta.del.tx.b).toBe(2000);

    const clientLocal = prev.transactions;
    const merged = clientMergeArrays(clientLocal, stamped.transactions, stamped.sync_meta.del.tx);
    expect(merged.map(t => t.id)).toEqual(['a']);
  });

  it('a budget change wins and a removed category stays removed', () => {
    const prev = { budgets: { 'מזון לבית': 500, 'פארם': 200 } };
    const patch = { budgets: { 'מזון לבית': 800 } };

    const stamped = stampSync(prev, patch, 2000);
    expect(stamped.sync_meta.bu['מזון לבית']).toBe(2000);
    expect(stamped.sync_meta.del.budgets['פארם']).toBe(2000);

    const merged = clientMergeBudgets(
      prev.budgets, stamped.budgets,
      { 'מזון לבית': 1000, 'פארם': 1000 }, stamped.sync_meta.bu,
      stamped.sync_meta.del.budgets, stamped.sync_meta.bu,
    );
    expect(merged['מזון לבית']).toBe(800);
    expect(merged['פארם']).toBeUndefined();
  });

  it('leaves patches that touch no synced collection alone', () => {
    const out = stampSync({}, { assets: [{ id: 1 }] });
    expect(out.sync_meta).toBeUndefined();
  });
});

describe('mergeSyncMeta', () => {
  it('unions tombstones and keeps the newest timestamp', () => {
    const a = { del: { tx: { x: 100, y: 500 } }, bu: { cat: 10 } };
    const b = { del: { tx: { y: 200, z: 300 } }, bu: { cat: 50 } };
    const out = mergeSyncMeta(a, b);
    expect(out.del.tx).toEqual({ x: 100, y: 500, z: 300 });
    expect(out.bu.cat).toBe(50);
  });

  it('tolerates missing/!object inputs', () => {
    const out = mergeSyncMeta(null, undefined);
    expect(out.del.tx).toEqual({});
    expect(out.bu).toEqual({});
  });
});
