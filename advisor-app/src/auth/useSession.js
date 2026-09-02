import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    let gotEvent = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!gotEvent) setSession(session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      gotEvent = true;
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
      // TOKEN_REFRESHED fires roughly hourly for an open session and never changes
      // the signed-in user — skip it so downstream effects keyed on `session`
      // (e.g. App.jsx's advisor_clients lookup) don't rerun on every refresh.
      if (event === 'TOKEN_REFRESHED') { setLoading(false); return; }
      setSession(session);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading, isRecovery, clearRecovery: () => setIsRecovery(false) };
}
