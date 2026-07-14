import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const EMPTY = { transactions: [], budgets: {}, goals: [], subscriptions: [], loans: [], fixed_expenses: [] };

export function useClientBudget(clientUserId) {
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

  const save = useCallback(async (patch) => {
    if (!clientUserId) return;
    const next = { ...(data || EMPTY), ...patch };
    setData(next);
    const { error } = await supabase
      .from('budget_data')
      .upsert({ user_id: clientUserId, ...patch }, { onConflict: 'user_id' });
    if (error) setError(error);
  }, [clientUserId, data]);

  return { data, loading, error, save, reload };
}
