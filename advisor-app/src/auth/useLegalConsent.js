import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export const LEGAL_VERSION = '2026-10-12';

export function useLegalConsent(userId) {
  const [accepted, setAccepted] = useState(null);

  useEffect(() => {
    if (!userId) { setAccepted(null); return undefined; }
    let cancelled = false;
    setAccepted(null);
    supabase.from('legal_acceptances').select('id').eq('user_id', userId).eq('terms_version', LEGAL_VERSION).eq('privacy_version', LEGAL_VERSION).limit(1)
      .then(({ data, error }) => { if (!cancelled) setAccepted(error ? true : Boolean(data?.length)); });
    return () => { cancelled = true; };
  }, [userId]);

  return [accepted, () => setAccepted(true)];
}
