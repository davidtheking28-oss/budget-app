import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export async function respondToMeeting(advisorId, meetingId, status) {
  let error;
  try { ({ error } = await supabase.from('advisor_meetings').update({ status }).eq('id', meetingId).eq('advisor_id', advisorId).select().single()); } catch (err) { error = err; }
  if (error) { toast('שגיאה בעדכון הפגישה', 'error'); return false; }
  toast(status === 'confirmed' ? 'הפגישה אושרה' : 'הפגישה נדחתה', 'success');
  return true;
}
