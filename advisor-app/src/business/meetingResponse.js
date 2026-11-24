import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import { notifyMeetingInstant } from '../crm/useClientCrm.js';

export async function respondToMeeting(advisorId, meetingId, status) {
  let error;
  try { ({ error } = await supabase.from('advisor_meetings').update({ status }).eq('id', meetingId).eq('advisor_id', advisorId).select().single()); } catch (err) { error = err; }
  if (error) { toast('שגיאה בעדכון הפגישה', 'error'); return false; }
  if (status !== 'confirmed') { toast('הפגישה נדחתה', 'success'); return true; }
  const sent = await notifyMeetingInstant(meetingId, 'confirmed');
  toast(sent > 0 ? 'הפגישה אושרה והלקוח קיבל התראה' : sent === 0 ? 'הפגישה אושרה. ללקוח לא מופעלות התראות, כדאי לעדכן אותו בעצמך' : 'הפגישה אושרה', 'success');
  return true;
}
