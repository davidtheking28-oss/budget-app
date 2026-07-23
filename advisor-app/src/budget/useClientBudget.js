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
    const { error } = await supabase
      .from('budget_data')
      .upsert({ user_id: clientUserId, updated_by: advisorId, ...patch }, { onConflict: 'user_id' });
    if (error) {
      setError(error);
      dataRef.current = prev;
      setData(prev);
      toast('שמירה נכשלה, נסה שוב', 'error');
    }
  }, [clientUserId, advisorId]);

  return { data, loading, error, save, reload };
}
