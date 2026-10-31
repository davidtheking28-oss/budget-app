import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const TRASH_DAYS = 30;

export function useClientApprovals(advisorId) {
  const [links, setLinks] = useState([]);
  const [archive, setArchive] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!advisorId) return;
    setLoading(true);
    const [{ data: linkRows }, { data: archiveRows }] = await Promise.all([
      supabase.from('advisor_clients').select('id, client_id, client_email, name, invited_email, status, requested_by_client, created_at').eq('advisor_id', advisorId).order('created_at', { ascending: false }),
      supabase.from('advisor_client_archive').select('id, client_email, state, created_at').eq('advisor_id', advisorId).order('created_at', { ascending: false })
    ]);
    const cutoff = Date.now() - TRASH_DAYS * 86400000;
    const expired = (archiveRows || []).filter(r => r.state === 'trashed' && new Date(r.created_at).getTime() < cutoff);
    if (expired.length) await supabase.from('advisor_client_archive').delete().eq('advisor_id', advisorId).in('id', expired.map(r => r.id));
    setLinks(linkRows || []);
    setArchive((archiveRows || []).filter(r => !expired.includes(r)));
    setLoading(false);
  }, [advisorId]);

  useEffect(() => { load(); }, [load]);

  return { links, archive, loading, reload: load };
}

export { TRASH_DAYS };
