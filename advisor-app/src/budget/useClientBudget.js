import { useCallback, useEffect, useReducer } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

const EMPTY = { transactions: [], budgets: {}, goals: [], subscriptions: [], loans: [], payments: [], fixed_expenses: [], insurances: [], assets: [] };

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
    const patch = typeof patchOrFn === 'function' ? patchOrFn(prev) : patchOrFn;
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
      mergedPatch[key] = (freshVal && typeof freshVal === 'object' && !Array.isArray(freshVal) &&
        patchVal && typeof patchVal === 'object' && !Array.isArray(patchVal))
        ? { ...freshVal, ...patchVal }
        : patchVal;
    }
    const { error } = await supabase
      .from('budget_data')
      .upsert({ user_id: clientUserId, updated_by: advisorId, ...mergedPatch }, { onConflict: 'user_id' });
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
