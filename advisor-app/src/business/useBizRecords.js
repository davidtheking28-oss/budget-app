import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function useBizRecords(advisorId, kind, period = null) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!advisorId) return;
    setLoading(true);
    let query = supabase.from('advisor_biz_records').select('*').eq('advisor_id', advisorId).eq('kind', kind);
    if (period) query = query.eq('period', period);
    const { data, error: err } = await query.order('created_at', { ascending: false });
    if (err) { setError(err); setLoading(false); return; }
    setError(null);
    setRecords(data || []);
    setLoading(false);
  }, [advisorId, kind, period]);

  useEffect(() => { reload(); }, [reload]);

  async function add(data, recordPeriod = period) {
    const { data: row, error: err } = await supabase.from('advisor_biz_records').insert({ advisor_id: advisorId, kind, period: recordPeriod, data }).select().single();
    if (err) { toast('שגיאה בשמירה', 'error'); return null; }
    setRecords(prev => [row, ...prev]);
    return row;
  }

  async function update(id, patch) {
    const before = records;
    const current = records.find(r => r.id === id);
    if (!current) return false;
    const next = { ...current.data, ...patch };
    setRecords(prev => prev.map(r => r.id === id ? { ...r, data: next } : r));
    const { error: err } = await supabase.from('advisor_biz_records').update({ data: next, updated_at: new Date().toISOString() }).eq('id', id).eq('advisor_id', advisorId);
    if (err) { toast('שגיאה בשמירה', 'error'); setRecords(before); return false; }
    return true;
  }

  async function remove(id, message = 'הרשומה נמחקה') {
    const removed = records.find(r => r.id === id);
    const { error: err } = await supabase.from('advisor_biz_records').delete().eq('id', id).eq('advisor_id', advisorId);
    if (err) { toast('שגיאה במחיקה', 'error'); return; }
    setRecords(prev => prev.filter(r => r.id !== id));
    toast(message, 'success', removed ? {
      label: 'בטל',
      onClick: async () => {
        const { data: row, error: reErr } = await supabase.from('advisor_biz_records').insert({ advisor_id: advisorId, kind, period: removed.period, data: removed.data }).select().single();
        if (reErr) { toast('שגיאה בשחזור', 'error'); return; }
        setRecords(prev => [row, ...prev]);
      }
    } : undefined);
  }

  return { records, loading, error, reload, add, update, remove };
}
