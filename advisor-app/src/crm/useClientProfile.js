import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function useClientProfile(advisorId, clientId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!advisorId || !clientId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const { data, error } = await supabase
      .from('advisor_clients')
      .select('id, name, phone, background, created_at, tags, is_vip')
      .eq('advisor_id', advisorId)
      .eq('client_id', clientId)
      .maybeSingle();
    if (requestId !== requestIdRef.current) return;
    if (error) { setError(error); setLoading(false); return; }
    setError(null);
    setProfile(data);
    setLoading(false);
  }, [advisorId, clientId]);

  useEffect(() => { reload(); }, [reload]);

  async function save({ name, phone, background }) {
    if (!profile) return false;
    setProfile(prev => ({ ...prev, name, phone, background }));
    const { error } = await supabase
      .from('advisor_clients')
      .update({ name: name || null, phone: phone || null, background: background || null })
      .eq('id', profile.id)
      .eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בשמירת הפרטים', 'error'); reload(); return false; }
    toast('הפרטים נשמרו', 'success');
    return true;
  }

  async function toggleVip() {
    if (!profile) return false;
    const is_vip = !profile.is_vip;
    setProfile(prev => ({ ...prev, is_vip }));
    const { error } = await supabase.from('advisor_clients').update({ is_vip }).eq('id', profile.id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בעדכון VIP', 'error'); reload(); return false; }
    return true;
  }

  async function addTag(tag) {
    if (!profile || !tag.trim()) return false;
    const tags = [...(profile.tags || []), tag.trim()];
    setProfile(prev => ({ ...prev, tags }));
    const { error } = await supabase.from('advisor_clients').update({ tags }).eq('id', profile.id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בהוספת תגית', 'error'); reload(); return false; }
    return true;
  }

  async function removeTag(tag) {
    if (!profile) return false;
    const tags = (profile.tags || []).filter(t => t !== tag);
    setProfile(prev => ({ ...prev, tags }));
    const { error } = await supabase.from('advisor_clients').update({ tags }).eq('id', profile.id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בהסרת תגית', 'error'); reload(); return false; }
    return true;
  }

  return { profile, loading, error, reload, save, toggleVip, addTag, removeTag };
}
