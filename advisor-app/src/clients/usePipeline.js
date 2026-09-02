import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function usePipeline(advisorId) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!advisorId) return;
    setLoading(true);
    const { data, error } = await supabase.from('advisor_leads').select('*').eq('advisor_id', advisorId).order('created_at', { ascending: false });
    if (error) { setError(error); setLoading(false); return; }
    setError(null);
    setLeads(data || []);
    setLoading(false);
  }, [advisorId]);

  useEffect(() => { reload(); }, [reload]);

  async function addLead(row) {
    if (!row.name?.trim()) return false;
    const { data, error } = await supabase.from('advisor_leads').insert({ advisor_id: advisorId, ...row, name: row.name.trim() }).select().single();
    if (error) { toast('שגיאה בהוספת הלקוח', 'error'); return false; }
    toast('נוסף לצינור הטיפול', 'success');
    setLeads(prev => [data, ...prev]);
    return true;
  }

  async function setStage(id, stage) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
    const { error } = await supabase.from('advisor_leads').update({ stage }).eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בעדכון הסטטוס', 'error'); reload(); return; }
  }

  async function deleteLead(id) {
    const { error } = await supabase.from('advisor_leads').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setLeads(prev => prev.filter(l => l.id !== id));
    toast('הוסר מהצינור', 'success');
  }

  return { leads, loading, error, reload, addLead, setStage, deleteLead };
}
