import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useMfaGate(userId) {
  const [state, setState] = useState({ status: 'loading', factorId: null });
  const request = useRef({ version: 0 });

  const check = useCallback(async () => {
    const tracker = request.current;
    const version = ++tracker.version;
    const publish = next => { if (tracker.version === version) setState(next); };
    publish({ status: 'loading', factorId: null });
    try {
      const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !aal) { publish({ status: 'error', factorId: null }); return; }
      if (aal.nextLevel !== 'aal2' || aal.currentLevel === 'aal2') { publish({ status: 'ok', factorId: null }); return; }
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0];
      publish(factorsError || !factor ? { status: 'error', factorId: null } : { status: 'challenge', factorId: factor.id });
    } catch {
      publish({ status: 'error', factorId: null });
    }
  }, []);

  useEffect(() => {
    const tracker = request.current;
    if (!userId) setState({ status: 'loading', factorId: null });
    else check();
    return () => { tracker.version++; };
  }, [userId, check]);

  return { ...state, refresh: check };
}
