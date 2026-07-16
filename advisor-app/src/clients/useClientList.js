import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { monthSummary } from '../budget/budgetMath.js';
import { computeHealthScore } from '../budget/insights.js';

export function useClientList(advisorId) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!advisorId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);

    const { data: roster, error } = await supabase
      .from('advisor_clients')
      .select('id, client_id, client_email')
      .eq('advisor_id', advisorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (requestId !== requestIdRef.current) return;
    if (error) { setError(error); setLoading(false); return; }
    setError(null);
    if (!roster || !roster.length) { setClients([]); setLoading(false); return; }

    const clientIds = roster.map(c => c.client_id);
    const now = new Date();

    const [{ data: budgetRows }, { data: taskRows }] = await Promise.all([
      supabase.from('budget_data').select('user_id, transactions, budgets').in('user_id', clientIds),
      supabase.from('advisor_tasks').select('client_id').eq('advisor_id', advisorId).eq('done', false).in('client_id', clientIds)
    ]);

    const budgetByUser = {};
    (budgetRows || []).forEach(r => { budgetByUser[r.user_id] = r; });
    const openTaskCounts = {};
    (taskRows || []).forEach(r => { openTaskCounts[r.client_id] = (openTaskCounts[r.client_id] || 0) + 1; });

    const merged = roster.map(c => {
      const budgetRow = budgetByUser[c.client_id];
      const summary = budgetRow ? monthSummary(budgetRow, now.getFullYear(), now.getMonth()) : null;
      return {
        ...c,
        remaining: summary ? summary.remaining : null,
        hasOverage: summary ? summary.overCats.length > 0 : false,
        openTasks: openTaskCounts[c.client_id] || 0,
        healthScore: budgetRow ? computeHealthScore(budgetRow, now.getFullYear(), now.getMonth()) : null
      };
    });

    if (requestId !== requestIdRef.current) return;
    setClients(merged);
    setLoading(false);
  }, [advisorId]);

  useEffect(() => { load(); }, [load]);

  return { clients, loading, error, reload: load };
}
