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
      setSession(session);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading, isRecovery, clearRecovery: () => setIsRecovery(false) };
}
