import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useClientList(advisorId) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!advisorId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('advisor_clients')
      .select('id, client_id, client_email')
      .eq('advisor_id', advisorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setClients(error ? [] : data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [advisorId]);

  return { clients, loading };
}
