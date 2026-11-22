import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { summarizeSigns } from './agreementSigns.js';

export const AGREEMENTS_CHANGED = 'advisor-agreements-changed';

const EMPTY = summarizeSigns([], []);

export function useAgreementSigns(advisorId) {
  const [summary, setSummary] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!advisorId) return;
    const [{ data: agreements, error }, { data: views, error: viewsError }] = await Promise.all([
      supabase.from('client_agreements').select('id, user_id'),
      supabase.from('client_agreement_views').select('agreement_id').eq('advisor_id', advisorId),
    ]);
    if (!error && !viewsError) setSummary(summarizeSigns(agreements, views));
  }, [advisorId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener('focus', load);
    window.addEventListener(AGREEMENTS_CHANGED, load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener(AGREEMENTS_CHANGED, load);
    };
  }, [load]);

  return summary;
}
