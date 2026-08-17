import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function usePendingInvites(advisorId) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!advisorId) return;
    setLoading(true);
    const { data } = await supabase
      .from('advisor_clients')
      .select('id, client_id, client_email, invited_email, created_at')
      .eq('advisor_id', advisorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setInvites(data || []);
    setLoading(false);
  }, [advisorId]);

  useEffect(() => { load(); }, [load]);

  return { invites, loading, reload: load };
}
