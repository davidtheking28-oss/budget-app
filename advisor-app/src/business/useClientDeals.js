import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function useClientDeals(advisorId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!advisorId) return;
    setLoading(true);
    const { data: links, error: linkError } = await supabase
      .from('advisor_clients')
      .select('id, client_id, client_email, name, phone, created_at')
      .eq('advisor_id', advisorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (linkError) { setError(linkError); setLoading(false); return; }
    const { data: deals, error: dealError } = await supabase.from('advisor_client_deals').select('*').eq('advisor_id', advisorId);
    if (dealError) { setError(dealError); setLoading(false); return; }
    const byLink = Object.fromEntries((deals || []).map(d => [d.link_id, d]));
    setError(null);
    setRows((links || []).map(l => ({ ...l, deal: byLink[l.id] || null })));
    setLoading(false);
  }, [advisorId]);

  useEffect(() => { reload(); }, [reload]);

  async function saveDeal(link, patch) {
    const before = rows;
    const next = { link_id: link.id, advisor_id: advisorId, payment_status: 'unpaid', receipt_issued: false, ...(link.deal || {}), ...patch };
    setRows(prev => prev.map(r => r.id === link.id ? { ...r, deal: next } : r));
    const { error: err } = await supabase.from('advisor_client_deals').upsert({ ...next, updated_at: new Date().toISOString() });
    if (err) { toast('שגיאה בשמירה', 'error'); setRows(before); return false; }
    return true;
  }

  async function saveContact(link, patch) {
    const before = rows;
    setRows(prev => prev.map(r => r.id === link.id ? { ...r, ...patch } : r));
    const { error: err } = await supabase.from('advisor_clients').update(patch).eq('id', link.id).eq('advisor_id', advisorId);
    if (err) { toast('שגיאה בשמירה', 'error'); setRows(before); return false; }
    return true;
  }

  return { rows, loading, error, reload, saveDeal, saveContact };
}
