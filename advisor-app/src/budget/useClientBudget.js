import { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

const EMPTY = { transactions: [], budgets: {}, goals: [], subscriptions: [], loans: [], payments: [], fixed_expenses: [], insurances: [], assets: [], grooming: [], events: [], education: [], annualExpenses: [], mortgage_scenario: null };

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

export function mergeBudgetPatch(fresh, patch) {
  const meta = mergeSyncMeta(fresh.sync_meta, patch.sync_meta);
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'sync_meta') { out[key] = meta; continue; }
    const delKey = DEL_KEY[key];
    if (delKey && Array.isArray(value)) {
      const items = new Map();
      for (const item of [...(fresh[key] || []), ...value]) {
        if (!item || item.id == null) continue;
        const id = String(item.id), prior = items.get(id);
        if (!prior || (item.u || 0) >= (prior.u || 0)) items.set(id, item);
      }
      for (const [id, ts] of Object.entries(meta.del[delKey] || {})) {
        if ((items.get(id)?.u || 0) <= ts) items.delete(id);
      }
      out[key] = [...items.values()];
    } else if (key === 'budgets') {
      out[key] = { ...(fresh.budgets || {}) };
      for (const [cat, amount] of Object.entries(value)) {
        if (!(cat in out[key]) || (patch.sync_meta?.bu?.[cat] || 0) >= (fresh.sync_meta?.bu?.[cat] || 0)) out[key][cat] = amount;
      }
      for (const [cat, ts] of Object.entries(meta.del.budgets || {})) {
        if ((meta.bu[cat] || 0) <= ts) delete out[key][cat];
      }
    } else {
      const prior = fresh[key];
      out[key] = prior && typeof prior === 'object' && !Array.isArray(prior) && value && typeof value === 'object' && !Array.isArray(value)
        ? { ...prior, ...value } : value;
    }
  }
  return out;
}

export async function writeBudgetVersion(db, payload, previous) {
  let query;
  if (previous) {
    query = db.from('budget_data').update(payload).eq('user_id', payload.user_id);
    query = previous.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', previous.updated_at);
  } else query = db.from('budget_data').insert(payload);
  const { data, error } = await query.select('user_id').maybeSingle();
  return { error, conflict: error?.code === '23505' || (!error && !data) };
}

const STALE_MS = 30000;

// The client app keeps business-mode data in a single nested `business` jsonb column and
// personal-mode data in the top-level columns (see _doCloudSave in index.html). The advisor
// reads/writes whichever the current mode selects; every screen consumes the same shape.
export const MODES = ['personal', 'business'];
export const BudgetModeContext = createContext('personal');

const keyOf = (clientUserId, mode) => `${clientUserId}|${mode}`;

function unwrap(row, clientUserId, mode) {
  if (mode === 'business') return { user_id: clientUserId, ...EMPTY, ...(row?.business || {}) };
  return row || { user_id: clientUserId, ...EMPTY };
}

const cache = new Map();
const listeners = new Map();
const inflight = new Map();
const generation = new Map();
const channels = new Map();
const saveQueue = new Map();

// An advisor who browses many clients in one session would otherwise keep every
// client's full transaction/budget/goal set in memory forever — cap how many
// client+mode entries stay cached and evict the least-recently-touched ones that
// nobody is actively viewing.
const CACHE_CAP = 12;

function emit(key) {
  const set = listeners.get(key);
  if (set) for (const fn of set) fn();
}

function touch(key) {
  const entry = cache.get(key);
  if (entry === undefined) return;
  cache.delete(key);
  cache.set(key, entry);
}

function evictExcess() {
  if (cache.size <= CACHE_CAP) return;
  for (const key of cache.keys()) {
    if (cache.size <= CACHE_CAP) break;
    if (listeners.has(key)) continue; // still on screen somewhere
    cache.delete(key);
  }
}

function setEntry(key, entry) {
  cache.delete(key);
  cache.set(key, entry);
  evictExcess();
  emit(key);
}

function subscribe(key, fn) {
  let set = listeners.get(key);
  if (!set) { set = new Set(); listeners.set(key, set); }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) listeners.delete(key);
  };
}

// any local write invalidates in-flight reads so they can't overwrite it with stale data
function invalidate(key) {
  generation.set(key, (generation.get(key) || 0) + 1);
  inflight.delete(key);
}

function fetchEntry(clientUserId, mode) {
  const key = keyOf(clientUserId, mode);
  const pending = inflight.get(key);
  if (pending) return pending;
  const gen = generation.get(key) || 0;
  const promise = supabase
    .from('budget_data')
    .select('*')
    .eq('user_id', clientUserId)
    .maybeSingle()
    .then(({ data: row, error }) => {
      if (inflight.get(key) === promise) inflight.delete(key);
      if ((generation.get(key) || 0) !== gen) return;
      if (error) { setEntry(key, { data: null, error, ts: Date.now() }); return; }
      setEntry(key, { data: unwrap(row, clientUserId, mode), error: null, ts: Date.now() });
    });
  inflight.set(key, promise);
  return promise;
}

// A client can revoke advisor access at any time; the RLS on budget_data then blocks
// new reads, but anything already sitting in the module-level cache would otherwise
// stay on screen until the next stale re-fetch (up to STALE_MS later). Watching the
// grant row itself lets a revoke clear the cache immediately instead of waiting.
function evictClient(clientUserId) {
  for (const m of MODES) {
    const k = keyOf(clientUserId, m);
    if (!cache.has(k) && !listeners.has(k)) continue;
    invalidate(k);
    setEntry(k, { data: null, error: { message: 'access_revoked' }, ts: Date.now() });
  }
}

function retainChannel(clientUserId) {
  let entry = channels.get(clientUserId);
  if (!entry) {
    const channel = supabase
      .channel(`budget_data:${clientUserId}`)
      // one row backs both modes, so a change must refresh whichever of them is cached
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_data', filter: `user_id=eq.${clientUserId}` }, () => {
        for (const m of MODES) {
          const k = keyOf(clientUserId, m);
          if (!cache.has(k) && !listeners.has(k)) continue;
          invalidate(k);
          fetchEntry(clientUserId, m);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advisor_clients', filter: `client_id=eq.${clientUserId}` }, (payload) => {
        const status = payload.new?.status;
        if (payload.eventType === 'DELETE' || (status && status !== 'active')) evictClient(clientUserId);
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

// Runs one save to completion. Callers chain this onto saveQueue so saves to the same
// client+mode always run in order, each starting from the true prior result rather than
// a snapshot taken before an earlier queued save finished.
async function doSave(k, clientUserId, mode, advisorId, patchOrFn) {
  const prev = cache.get(k)?.data || { user_id: clientUserId, ...EMPTY };
  const rawPatch = typeof patchOrFn === 'function' ? patchOrFn(prev) : patchOrFn;
  const patch = stampSync(prev, rawPatch);
  const next = { ...prev, ...patch };
  invalidate(k);
  setEntry(k, { data: next, error: null, ts: Date.now() });
  let error = null;
  let savedBundle;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: freshRow, error: readError } = await supabase
      .from('budget_data').select('*').eq('user_id', clientUserId).maybeSingle();
    if (readError) { error = readError; break; }
    const freshBundle = mode === 'business' ? (freshRow?.business || {}) : (freshRow || {});
    const mergedPatch = mergeBudgetPatch(freshBundle, patch);
    const row = {
      user_id: clientUserId, updated_by: advisorId,
      updated_at: new Date(Math.max(Date.now(), (Date.parse(freshRow?.updated_at) || 0) + 1)).toISOString(),
    };
    if (mode === 'business') row.business = { ...freshBundle, ...mergedPatch };
    else Object.assign(row, mergedPatch);
    const result = await writeBudgetVersion(supabase, row, freshRow);
    if (result.conflict) { error = { message: 'sync conflict' }; continue; }
    error = result.error;
    savedBundle = { ...freshBundle, ...mergedPatch, user_id: clientUserId };
    break;
  }
  if (error) {
    // Roll back but leave `error` null: the cache is shared across tabs, and a failed
    // write must not replace every screen's valid data with a full-page error. The
    // toast carries the failure; `error` stays reserved for a failed read.
    if (cache.get(k)?.data === next) setEntry(k, { data: prev, error: null, ts: Date.now() });
    toast('שגיאה בשמירה, נסה שוב', 'error');
    return false;
  }
  if (cache.get(k)?.data === next) setEntry(k, { data: savedBundle, error: null, ts: Date.now() });
  return true;
}

export function useClientBudget(clientUserId, advisorId) {
  const [, rerender] = useReducer(n => n + 1, 0);
  const mode = useContext(BudgetModeContext);
  const key = clientUserId ? keyOf(clientUserId, mode) : null;
  const entry = key ? cache.get(key) : null;
  if (key && entry) touch(key);

  useEffect(() => {
    if (!clientUserId) return;
    const k = keyOf(clientUserId, mode);
    const unsubscribe = subscribe(k, rerender);
    const releaseChannel = retainChannel(clientUserId);
    const cached = cache.get(k);
    if (!cached || Date.now() - cached.ts > STALE_MS) fetchEntry(clientUserId, mode);
    return () => { unsubscribe(); releaseChannel(); };
  }, [clientUserId, mode]);

  const reload = useCallback(() => {
    if (!clientUserId) return;
    const k = keyOf(clientUserId, mode);
    invalidate(k);
    cache.delete(k);
    emit(k);
    return fetchEntry(clientUserId, mode);
  }, [clientUserId, mode]);

  const save = useCallback((patchOrFn) => {
    if (!clientUserId) return Promise.resolve(false);
    const k = keyOf(clientUserId, mode);
    const run = () => doSave(k, clientUserId, mode, advisorId, patchOrFn);
    const queued = (saveQueue.get(k) || Promise.resolve()).then(run, run);
    saveQueue.set(k, queued);
    return queued;
  }, [clientUserId, advisorId, mode]);

  return {
    data: entry?.data ?? null,
    loading: !!clientUserId && !entry,
    error: entry?.error ?? null,
    save,
    reload
  };
}
