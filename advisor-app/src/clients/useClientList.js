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

    const [{ data: budgetRows }, { data: taskRows }, { data: declinedRows }, { data: uploadErrorRows }] = await Promise.all([
      supabase.from('budget_data').select('user_id, transactions, budgets, updated_at').in('user_id', clientIds),
      supabase.from('advisor_tasks').select('client_id').eq('advisor_id', advisorId).eq('done', false).in('client_id', clientIds),
      supabase.from('advisor_meetings').select('client_id, decline_note').eq('advisor_id', advisorId).eq('status', 'declined').gte('scheduled_at', now.toISOString()).in('client_id', clientIds),
      supabase.from('economic_mappings').select('client_id, last_upload_error').eq('advisor_id', advisorId).not('last_upload_error', 'is', null).in('client_id', clientIds)
    ]);

    const budgetByUser = {};
    (budgetRows || []).forEach(r => { budgetByUser[r.user_id] = r; });
    const openTaskCounts = {};
    (taskRows || []).forEach(r => { openTaskCounts[r.client_id] = (openTaskCounts[r.client_id] || 0) + 1; });
    const declinedByUser = {};
    (declinedRows || []).forEach(r => { declinedByUser[r.client_id] = (declinedByUser[r.client_id] || 0) + 1; });
    const uploadErrorByUser = {};
    (uploadErrorRows || []).forEach(r => { uploadErrorByUser[r.client_id] = true; });

    const merged = roster.map(c => {
      const budgetRow = budgetByUser[c.client_id];
      const summary = budgetRow ? monthSummary(budgetRow, now.getFullYear(), now.getMonth()) : null;
      return {
        ...c,
        remaining: summary ? summary.remaining : null,
        hasOverage: summary ? summary.overCats.length > 0 : false,
        overageAmount: summary ? summary.overCats.reduce((s, x) => s + x.over, 0) : 0,
        openTasks: openTaskCounts[c.client_id] || 0,
        hasDeclinedMeeting: !!declinedByUser[c.client_id],
        hasFailedUpload: !!uploadErrorByUser[c.client_id],
        healthScore: budgetRow ? computeHealthScore(budgetRow, now.getFullYear(), now.getMonth()) : null,
        updatedAt: budgetRow?.updated_at || null
      };
    });

    if (requestId !== requestIdRef.current) return;
    setClients(merged);
    setLoading(false);
  }, [advisorId]);

  useEffect(() => { load(); }, [load]);

  return { clients, loading, error, reload: load };
}
