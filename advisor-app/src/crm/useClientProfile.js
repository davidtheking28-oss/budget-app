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
      .select('id, phone, background')
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

  async function save({ phone, background }) {
    if (!profile) return false;
    setProfile(prev => ({ ...prev, phone, background }));
    const { error } = await supabase
      .from('advisor_clients')
      .update({ phone: phone || null, background: background || null })
      .eq('id', profile.id)
      .eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בשמירת הפרטים', 'error'); reload(); return false; }
    toast('הפרטים נשמרו', 'success');
    return true;
  }

  return { profile, loading, error, reload, save };
}
