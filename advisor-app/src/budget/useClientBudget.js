import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

const EMPTY = { transactions: [], budgets: {}, goals: [], subscriptions: [], loans: [], payments: [], fixed_expenses: [] };

export function useClientBudget(clientUserId, advisorId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!clientUserId) return;
    setLoading(true);
    const { data: row, error } = await supabase
      .from('budget_data')
      .select('*')
      .eq('user_id', clientUserId)
      .maybeSingle();
    if (error) { setError(error); setLoading(false); return; }
    setData(row || { user_id: clientUserId, ...EMPTY });
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

  const save = useCallback(async (patch) => {
    if (!clientUserId) return;
    const prev = data;
    const next = { ...(data || EMPTY), ...patch };
    setData(next);
    const { error } = await supabase
      .from('budget_data')
      .upsert({ user_id: clientUserId, updated_by: advisorId, ...patch }, { onConflict: 'user_id' });
    if (error) {
      setError(error);
      setData(prev);
      toast('שמירה נכשלה, נסה שוב', 'error');
    }
  }, [clientUserId, advisorId, data]);

  return { data, loading, error, save, reload };
}
