import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function useClientCrm(advisorId, clientId) {
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!advisorId || !clientId) return;
    setLoading(true);
    const [notesRes, tasksRes, meetingsRes] = await Promise.all([
      supabase.from('advisor_notes').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('advisor_tasks').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('advisor_meetings').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('scheduled_at', { ascending: true })
    ]);
    setNotes(notesRes.data || []);
    setTasks((tasksRes.data || []).sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)));
    setMeetings(meetingsRes.data || []);
    setLoading(false);
  }, [advisorId, clientId]);

  useEffect(() => { reload(); }, [reload]);

  async function addNote(body) {
    if (!body.trim()) return;
    const { error } = await supabase.from('advisor_notes').insert({ advisor_id: advisorId, client_id: clientId, body: body.trim() });
    if (error) { toast('שגיאה בשמירת ההערה', 'error'); return; }
    toast('הערה נוספה', 'success');
    reload();
  }

  async function deleteNote(id) {
    const { error } = await supabase.from('advisor_notes').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  async function addTask(title, dueDate) {
    if (!title.trim()) return;
    const { error } = await supabase.from('advisor_tasks').insert({ advisor_id: advisorId, client_id: clientId, title: title.trim(), due_date: dueDate || null });
    if (error) { toast('שגיאה בהוספת המשימה', 'error'); return; }
    toast('משימה נוספה', 'success');
    reload();
  }

  async function toggleTask(id, done) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done } : t));
    const { error } = await supabase.from('advisor_tasks').update({ done }).eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בעדכון המשימה', 'error'); reload(); return; }
    toast(done ? 'משימה סומנה כהושלמה' : 'משימה סומנה כפתוחה', 'success');
  }

  async function deleteTask(id) {
    const { error } = await supabase.from('advisor_tasks').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function addMeeting(scheduledAt, notesText) {
    if (!scheduledAt) return;
    const { error } = await supabase.from('advisor_meetings').insert({ advisor_id: advisorId, client_id: clientId, scheduled_at: scheduledAt, notes: notesText || null });
    if (error) { toast('שגיאה בקביעת הפגישה', 'error'); return; }
    toast('פגישה נקבעה', 'success');
    reload();
  }

  async function deleteMeeting(id) {
    const { error } = await supabase.from('advisor_meetings').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setMeetings(prev => prev.filter(m => m.id !== id));
  }

  return { notes, tasks, meetings, loading, addNote, deleteNote, addTask, toggleTask, deleteTask, addMeeting, deleteMeeting };
}
