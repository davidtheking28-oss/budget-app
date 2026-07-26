import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useIsAdvisor(userId) {
  const [isAdvisor, setIsAdvisor] = useState(null);

  useEffect(() => {
    if (!userId) { setIsAdvisor(null); return; }
    let cancelled = false;
    supabase
      .from('advisors')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setIsAdvisor(!!data); });
    return () => { cancelled = true; };
  }, [userId]);

  return isAdvisor;
}
