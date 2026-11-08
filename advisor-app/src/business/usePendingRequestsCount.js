import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export const REQUESTS_CHANGED = 'advisor-requests-changed';

export function usePendingRequestsCount(advisorId) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!advisorId) return;
    const { count: n, error } = await supabase
      .from('advisor_clients')
      .select('id', { count: 'exact', head: true })
      .eq('advisor_id', advisorId)
      .eq('status', 'pending')
      .eq('requested_by_client', true);
    if (!error) setCount(n || 0);
  }, [advisorId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener('focus', load);
    window.addEventListener(REQUESTS_CHANGED, load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener(REQUESTS_CHANGED, load);
    };
  }, [load]);

  return count;
}
