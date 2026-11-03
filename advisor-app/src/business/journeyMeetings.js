import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import { MEETINGS } from './journeyMath.js';

export async function scheduleJourneyMeeting(advisorId, clientId, journey, key, date) {
  let meetingId = journey.meetings[key].meetingId || null;
  if (!date) {
    if (meetingId) {
      const { error } = await supabase.from('advisor_meetings').delete().eq('id', meetingId).eq('advisor_id', advisorId);
      if (error) { toast('שגיאה בעדכון הפגישה', 'error'); return null; }
      meetingId = null;
    }
  } else {
    const scheduledAt = new Date(date + 'T10:00:00').toISOString();
    const title = MEETINGS.find(m => m.key === key).title;
    if (meetingId) {
      const { error } = await supabase.from('advisor_meetings').update({ scheduled_at: scheduledAt, notes: title, status: 'pending' }).eq('id', meetingId).eq('advisor_id', advisorId);
      if (error) { toast('שגיאה בעדכון הפגישה', 'error'); return null; }
    } else {
      const { data, error } = await supabase.from('advisor_meetings').insert({ advisor_id: advisorId, client_id: clientId, scheduled_at: scheduledAt, notes: title, for_client: true }).select().single();
      if (error) { toast('שגיאה בקביעת הפגישה', 'error'); return null; }
      meetingId = data.id;
    }
  }
  return { ...journey, meetings: { ...journey.meetings, [key]: { ...journey.meetings[key], date, meetingId } } };
}
