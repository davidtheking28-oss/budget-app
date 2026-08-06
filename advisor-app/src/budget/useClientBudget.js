import { useCallback, useEffect, useReducer } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

const EMPTY = { transactions: [], budgets: {}, goals: [], subscriptions: [], loans: [], payments: [], fixed_expenses: [], insurances: [], assets: [] };

// The client app merges cloud data with its own local copy using last-write-wins on a
// per-item `u` timestamp, and only forgets an item it still holds locally if a tombstone
// exists in sync_meta.del (see _mergeArrays / _mergeBudgets in index.html). Advisor writes
// must speak the same protocol, or the client silently reverts every edit and resurrects
// every deletion on its next sync.
const DEL_KEY = {
  transactions: 'tx', goals: 'goals', subscriptions: 'subs', loans: 'loans',
  payments: 'payments', fixed_expenses: 'fixed', insurances: 'insurances',
};

function emptyDel() {
  return { tx: {}, goals: {}, subs: {}, loans: {}, payments: {}, fixed: {}, insurances: {}, budgets: {} };
}

export function mergeSyncMeta(a, b) {
  const out = { del: { ...emptyDel() }, bu: {} };
  for (const src of [a, b]) {
    if (!src || typeof src !== 'object') continue;
    for (const [k, v] of Object.entries(src.del || {})) {
      out.del[k] = { ...(out.del[k] || {}) };
      for (const [id, ts] of Object.entries(v || {})) {
        if (!(id in out.del[k]) || ts > out.del[k][id]) out.del[k][id] = ts;
      }
    }
    for (const [c, ts] of Object.entries(src.bu || {})) {
      if (!(c in out.bu) || ts > out.bu[c]) out.bu[c] = ts;
    }
  }
  return out;
}

export function stampSync(prev, patch, now = Date.now()) {
  const out = { ...patch };
  const prevMeta = prev?.sync_meta || {};
  const meta = { del: { ...emptyDel(), ...(prevMeta.del || {}) }, bu: { ...(prevMeta.bu || {}) } };
  let touched = false;

  for (const [key, delKey] of Object.entries(DEL_KEY)) {
    if (!Array.isArray(out[key])) continue;
    touched = true;
    const before = new Map((prev?.[key] || []).filter(it => it && it.id != null).map(it => [String(it.id), it]));
    out[key] = out[key].map(it => {
      if (!it || it.id == null) return it;
      const old = before.get(String(it.id));
      const same = old && JSON.stringify({ ...old, u: 0 }) === JSON.stringify({ ...it, u: 0 });
      return same ? it : { ...it, u: now };
    });
    const after = new Set(out[key].filter(it => it && it.id != null).map(it => String(it.id)));
    meta.del[delKey] = { ...(meta.del[delKey] || {}) };
    for (const id of before.keys()) if (!after.has(id)) meta.del[delKey][id] = now;
  }

  if (out.budgets && typeof out.budgets === 'object' && !Array.isArray(out.budgets)) {
    touched = true;
    const before = prev?.budgets || {};
    for (const c of new Set([...Object.keys(before), ...Object.keys(out.budgets)])) {
      if (before[c] !== out.budgets[c]) meta.bu[c] = now;
      if (out.budgets[c] == null && before[c] != null) meta.del.budgets[c] = now;
    }
  }

  return touched ? { ...out, sync_meta: meta } : out;
}

const STALE_MS = 30000;

const cache = new Map();
const listeners = new Map();
const inflight = new Map();
const generation = new Map();
const channels = new Map();

function emit(clientUserId) {
  const set = listeners.get(clientUserId);
  if (set) for (const fn of set) fn();
}

function setEntry(clientUserId, entry) {
  cache.set(clientUserId, entry);
  emit(clientUserId);
}

function subscribe(clientUserId, fn) {
  let set = listeners.get(clientUserId);
  if (!set) { set = new Set(); listeners.set(clientUserId, set); }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) listeners.delete(clientUserId);
  };
}

// any local write invalidates in-flight reads so they can't overwrite it with stale data
function invalidate(clientUserId) {
  generation.set(clientUserId, (generation.get(clientUserId) || 0) + 1);
  inflight.delete(clientUserId);
}

function fetchEntry(clientUserId) {
  const pending = inflight.get(clientUserId);
  if (pending) return pending;
  const gen = generation.get(clientUserId) || 0;
  const promise = supabase
    .from('budget_data')
    .select('*')
    .eq('user_id', clientUserId)
    .maybeSingle()
    .then(({ data: row, error }) => {
      if (inflight.get(clientUserId) === promise) inflight.delete(clientUserId);
      if ((generation.get(clientUserId) || 0) !== gen) return;
      if (error) { setEntry(clientUserId, { data: null, error, ts: Date.now() }); return; }
      setEntry(clientUserId, { data: row || { user_id: clientUserId, ...EMPTY }, error: null, ts: Date.now() });
    });
  inflight.set(clientUserId, promise);
  return promise;
}

function retainChannel(clientUserId) {
  let entry = channels.get(clientUserId);
  if (!entry) {
    const channel = supabase
      .channel(`budget_data:${clientUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_data', filter: `user_id=eq.${clientUserId}` }, () => {
        invalidate(clientUserId);
        fetchEntry(clientUserId);
      })
      .subscribe();
    entry = { channel, count: 0 };
    channels.set(clientUserId, entry);
  }
  entry.count++;
  return () => {
    entry.count--;
    if (entry.count === 0 && channels.get(clientUserId) === entry) {
      channels.delete(clientUserId);
      supabase.removeChannel(entry.channel);
    }
  };
}

export function useClientBudget(clientUserId, advisorId) {
  const [, rerender] = useReducer(n => n + 1, 0);
  const entry = clientUserId ? cache.get(clientUserId) : null;

  useEffect(() => {
    if (!clientUserId) return;
    const unsubscribe = subscribe(clientUserId, rerender);
    const releaseChannel = retainChannel(clientUserId);
    const cached = cache.get(clientUserId);
    if (!cached || Date.now() - cached.ts > STALE_MS) fetchEntry(clientUserId);
    return () => { unsubscribe(); releaseChannel(); };
  }, [clientUserId]);

  const reload = useCallback(() => {
    if (!clientUserId) return;
    invalidate(clientUserId);
    cache.delete(clientUserId);
    emit(clientUserId);
    return fetchEntry(clientUserId);
  }, [clientUserId]);

  const save = useCallback(async (patchOrFn) => {
    if (!clientUserId) return;
    const prev = cache.get(clientUserId)?.data || { user_id: clientUserId, ...EMPTY };
    const rawPatch = typeof patchOrFn === 'function' ? patchOrFn(prev) : patchOrFn;
    const patch = stampSync(prev, rawPatch);
    const next = { ...prev, ...patch };
    invalidate(clientUserId);
    setEntry(clientUserId, { data: next, error: null, ts: Date.now() });
    // re-fetch the latest row and shallow-merge object-typed patch fields onto it, so a
    // concurrent edit to a sibling key in the same jsonb column isn't silently clobbered
    const { data: freshRow } = await supabase
      .from('budget_data')
      .select('*')
      .eq('user_id', clientUserId)
      .maybeSingle();
    const mergedPatch = {};
    for (const key of Object.keys(patch)) {
      const freshVal = freshRow?.[key];
      const patchVal = patch[key];
      if (key === 'sync_meta') {
        // union tombstones/budget stamps with whatever landed since, so a concurrent
        // deletion by the client isn't dropped and then resurrected
        mergedPatch[key] = mergeSyncMeta(freshVal, patchVal);
        continue;
      }
      mergedPatch[key] = (freshVal && typeof freshVal === 'object' && !Array.isArray(freshVal) &&
        patchVal && typeof patchVal === 'object' && !Array.isArray(patchVal))
        ? { ...freshVal, ...patchVal }
        : patchVal;
    }
    const { error } = await supabase
      .from('budget_data')
      .upsert({ user_id: clientUserId, updated_by: advisorId, updated_at: new Date().toISOString(), ...mergedPatch }, { onConflict: 'user_id' });
    if (error) {
      // Roll back but leave `error` null: the cache is shared across tabs, and a failed
      // write must not replace every screen's valid data with a full-page error. The
      // toast carries the failure; `error` stays reserved for a failed read.
      if (cache.get(clientUserId)?.data === next) setEntry(clientUserId, { data: prev, error: null, ts: Date.now() });
      toast('שמירה נכשלה, נסה שוב', 'error');
      return false;
    }
    return true;
  }, [clientUserId, advisorId]);

  return {
    data: entry?.data ?? null,
    loading: !!clientUserId && !entry,
    error: entry?.error ?? null,
    save,
    reload
  };
}
