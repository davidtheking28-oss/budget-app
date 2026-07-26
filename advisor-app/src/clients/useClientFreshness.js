import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

// budget_data already records updated_at/updated_by on every write, but the
// advisor side never read them — so the advisor had no way to tell whether the
// client has touched their budget since the last meeting.
export function useClientFreshness(clientUserId) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!clientUserId) { setInfo(null); return; }
    let cancelled = false;
    supabase
      .from('budget_data')
      .select('updated_at, updated_by')
      .eq('user_id', clientUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setInfo(data?.updated_at
          ? { updatedAt: data.updated_at, byClient: data.updated_by === clientUserId }
          : null);
      });
    return () => { cancelled = true; };
  }, [clientUserId]);

  return info;
}

export function relativeTime(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 31) {
    const w = Math.floor(days / 7);
    return w === 1 ? 'לפני שבוע' : `לפני ${w} שבועות`;
  }
  const m = Math.floor(days / 30);
  return m === 1 ? 'לפני חודש' : `לפני ${m} חודשים`;
}

export const STALE_DAYS = 14;

export function isStale(iso) {
  const then = new Date(iso).getTime();
  return Number.isFinite(then) && (Date.now() - then) / 86400000 >= STALE_DAYS;
}
