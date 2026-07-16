import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useClientSummary(advisorId, clientId) {
  const [nextMeeting, setNextMeeting] = useState(null);
  const [openTasks, setOpenTasks] = useState(0);

  useEffect(() => {
    setNextMeeting(null);
    setOpenTasks(0);
    if (!advisorId || !clientId) return;
    let active = true;
    Promise.all([
      supabase.from('advisor_meetings').select('scheduled_at').eq('advisor_id', advisorId).eq('client_id', clientId).gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(1),
      supabase.from('advisor_tasks').select('id', { count: 'exact', head: true }).eq('advisor_id', advisorId).eq('client_id', clientId).eq('done', false)
    ]).then(([meetingRes, taskRes]) => {
      if (!active) return;
      setNextMeeting(meetingRes.data?.[0]?.scheduled_at || null);
      setOpenTasks(taskRes.count || 0);
    });
    return () => { active = false; };
  }, [advisorId, clientId]);

  return { nextMeeting, openTasks };
}
