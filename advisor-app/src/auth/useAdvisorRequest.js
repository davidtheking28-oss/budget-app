import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

// Distinguishes "this is a client account, wrong app" from "you asked for
// advisor access and it's pending" — NotAdvisor.jsx used to show the same
// dead-end message for both.
export function useAdvisorRequest(userId) {
  const [status, setStatus] = useState(null); // null | 'pending' | 'approved' | 'declined' | 'none'

  useEffect(() => {
    if (!userId) { setStatus(null); return; }
    let cancelled = false;
    supabase
      .from('advisor_access_requests')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setStatus(data?.status || 'none'); });
    return () => { cancelled = true; };
  }, [userId]);

  async function submit(userIdToRequest, email) {
    const { error } = await supabase.from('advisor_access_requests').insert({ user_id: userIdToRequest, email });
    if (error) return false;
    setStatus('pending');
    return true;
  }

  return { status, submit };
}
