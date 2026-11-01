import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import { saveBusinessPatch, loadBusinessRecords } from './bizSync.js';

export function useBizRecords(advisorId, kind, period = null) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const updates = useRef(new Map());

  const reload = useCallback(async () => {
    if (!advisorId) return;
    setLoading(true);
    const { data, error: err } = await loadBusinessRecords(supabase, advisorId, kind, period);
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

  function update(id, patch) {
    const current = records.find(r => r.id === id);
    if (!current) return Promise.resolve(false);
    let entry = updates.current.get(id);
    if (!entry) {
      entry = { confirmed: current.data, changes: [], running: Promise.resolve() };
      updates.current.set(id, entry);
    }
    const change = { patch };
    entry.changes.push(change);
    const refresh = () => setRecords(prev => prev.map(r => r.id === id ? {
      ...r, data: entry.changes.reduce((data, pending) => ({ ...data, ...pending.patch }), entry.confirmed)
    } : r));
    refresh();
    const run = async () => {

      let failed = false;
      try {
        const { data, error: err } = await saveBusinessPatch(supabase, advisorId, id, patch);
        failed = !!err;
        if (!failed) entry.confirmed = data;
      } catch { failed = true; }
      entry.changes = entry.changes.filter(pending => pending !== change);
      refresh();
      if (!entry.changes.length) updates.current.delete(id);
      if (failed) toast('שגיאה בשמירה', 'error');
      return !failed;
    };
    const saved = entry.running.then(run, run);
    entry.running = saved;
    return saved;
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
