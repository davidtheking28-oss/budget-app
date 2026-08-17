import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useClientSummary(advisorId, clientId) {
  const [nextMeeting, setNextMeeting] = useState(null);
  const [openTasks, setOpenTasks] = useState(0);
  const [household, setHousehold] = useState(null);

  const load = useCallback(async () => {
    if (!advisorId || !clientId) { setNextMeeting(null); setOpenTasks(0); setHousehold(null); return; }
    const [meetingRes, taskRes, householdRes] = await Promise.all([
      supabase.from('advisor_meetings').select('scheduled_at').eq('advisor_id', advisorId).eq('client_id', clientId).gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(1),
      supabase.from('advisor_tasks').select('id', { count: 'exact', head: true }).eq('advisor_id', advisorId).eq('client_id', clientId).eq('done', false),
      // RLS (024_advisor_reads_household.sql) scopes this to households where the client
      // is owner or member — a client not sharing a household simply gets no row back.
      supabase.from('households').select('owner_id,member_id,owner_email,member_email').or(`owner_id.eq.${clientId},member_id.eq.${clientId}`).maybeSingle()
    ]);
    setNextMeeting(meetingRes.data?.[0]?.scheduled_at || null);
    setOpenTasks(taskRes.count || 0);
    const h = householdRes.data;
    setHousehold(h && h.member_id ? { partnerEmail: h.owner_id === clientId ? h.member_email : h.owner_email } : null);
  }, [advisorId, clientId]);

  useEffect(() => {
    setNextMeeting(null);
    setOpenTasks(0);
    setHousehold(null);
    load();
  }, [load]);

  return { nextMeeting, openTasks, household, refresh: load };
}
