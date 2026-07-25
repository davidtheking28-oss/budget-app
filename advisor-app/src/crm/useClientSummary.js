import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useClientSummary(advisorId, clientId) {
  const [nextMeeting, setNextMeeting] = useState(null);
  const [openTasks, setOpenTasks] = useState(0);

  const load = useCallback(async () => {
    if (!advisorId || !clientId) { setNextMeeting(null); setOpenTasks(0); return; }
    const [meetingRes, taskRes] = await Promise.all([
      supabase.from('advisor_meetings').select('scheduled_at').eq('advisor_id', advisorId).eq('client_id', clientId).gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(1),
      supabase.from('advisor_tasks').select('id', { count: 'exact', head: true }).eq('advisor_id', advisorId).eq('client_id', clientId).eq('done', false)
    ]);
    setNextMeeting(meetingRes.data?.[0]?.scheduled_at || null);
    setOpenTasks(taskRes.count || 0);
  }, [advisorId, clientId]);

  useEffect(() => {
    setNextMeeting(null);
    setOpenTasks(0);
    load();
  }, [load]);

  return { nextMeeting, openTasks, refresh: load };
}
