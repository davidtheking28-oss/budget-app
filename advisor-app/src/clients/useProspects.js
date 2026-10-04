import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function useProspects(advisorId) {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!advisorId) return;
    setLoading(true);
    const { data, error } = await supabase.from('advisor_prospects').select('*').eq('advisor_id', advisorId).order('contacted_at', { ascending: false });
    if (error) { setError(error); setLoading(false); return; }
    setError(null);
    setProspects(data || []);
    setLoading(false);
  }, [advisorId]);

  useEffect(() => { reload(); }, [reload]);

  async function addProspect(row) {
    if (!row.name?.trim()) return false;
    const { data, error } = await supabase.from('advisor_prospects').insert({ advisor_id: advisorId, ...row, name: row.name.trim() }).select().single();
    if (error) { toast('שגיאה בהוספת המתעניין', 'error'); return false; }
    toast('המתעניין נוסף', 'success');
    setProspects(prev => [data, ...prev]);
    return true;
  }

  async function updateProspect(id, patch) {
    const before = prospects;
    setProspects(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    const { error } = await supabase.from('advisor_prospects').update(patch).eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בשמירה', 'error'); setProspects(before); return false; }
    return true;
  }

  async function deleteProspect(id) {
    const removed = prospects.find(p => p.id === id);
    const { error } = await supabase.from('advisor_prospects').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setProspects(prev => prev.filter(p => p.id !== id));
    toast('המתעניין נמחק', 'success', removed ? {
      label: 'בטל',
      onClick: async () => {
        const { id: _oldId, created_at: _createdAt, ...rest } = removed;
        const { data, error: reErr } = await supabase.from('advisor_prospects').insert({ advisor_id: advisorId, ...rest }).select().single();
        if (reErr) { toast('שגיאה בשחזור', 'error'); return; }
        setProspects(prev => [data, ...prev]);
      }
    } : undefined);
  }

  return { prospects, loading, error, reload, addProspect, updateProspect, deleteProspect };
}
