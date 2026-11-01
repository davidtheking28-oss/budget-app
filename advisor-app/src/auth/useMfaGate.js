import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useMfaGate(userId) {
  const [state, setState] = useState({ status: 'loading', factorId: null });

  const check = useCallback(async () => {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal || aal.nextLevel !== 'aal2' || aal.currentLevel === 'aal2') { setState({ status: 'ok', factorId: null }); return; }
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    setState(factor ? { status: 'challenge', factorId: factor.id } : { status: 'ok', factorId: null });
  }, []);

  useEffect(() => {
    if (!userId) { setState({ status: 'loading', factorId: null }); return; }
    check();
  }, [userId, check]);

  return { ...state, refresh: check };
}
