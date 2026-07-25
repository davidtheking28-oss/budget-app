import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

const EMPTY = { transactions: [], budgets: {}, goals: [], subscriptions: [], loans: [], payments: [], fixed_expenses: [], insurances: [] };

export function useClientBudget(clientUserId, advisorId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const dataRef = useRef(null);

  const reload = useCallback(async () => {
    if (!clientUserId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const { data: row, error } = await supabase
      .from('budget_data')
      .select('*')
      .eq('user_id', clientUserId)
      .maybeSingle();
    if (requestId !== requestIdRef.current) return;
    if (error) { setError(error); setLoading(false); return; }
    const next = row || { user_id: clientUserId, ...EMPTY };
    dataRef.current = next;
    setData(next);
    setError(null);
    setLoading(false);
  }, [clientUserId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!clientUserId) return;
    const channel = supabase
      .channel(`budget_data:${clientUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_data', filter: `user_id=eq.${clientUserId}` }, () => {
        reload();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientUserId, reload]);

  const save = useCallback(async (patchOrFn) => {
    if (!clientUserId) return;
    const prev = dataRef.current || EMPTY;
    const patch = typeof patchOrFn === 'function' ? patchOrFn(prev) : patchOrFn;
    const next = { ...prev, ...patch };
    dataRef.current = next;
    setData(next);
    // invalidate any in-flight reload so it can't overwrite this optimistic update with stale data
    ++requestIdRef.current;
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
      setError(error);
      if (dataRef.current === next) { dataRef.current = prev; setData(prev); }
      toast('שמירה נכשלה, נסה שוב', 'error');
      return false;
    }
    return true;
  }, [clientUserId, advisorId]);

  return { data, loading, error, save, reload };
}
