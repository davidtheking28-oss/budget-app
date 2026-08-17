import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function useClientCrm(advisorId, clientId) {
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!advisorId || !clientId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const [notesRes, tasksRes, meetingsRes] = await Promise.all([
      supabase.from('advisor_notes').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('advisor_tasks').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('advisor_meetings').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('scheduled_at', { ascending: true })
    ]);
    if (requestId !== requestIdRef.current) return;
    const firstError = notesRes.error || tasksRes.error || meetingsRes.error;
    if (firstError) { setError(firstError); setLoading(false); return; }
    setError(null);
    setNotes(notesRes.data || []);
    setTasks((tasksRes.data || []).sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)));
    setMeetings(meetingsRes.data || []);
    setLoading(false);
  }, [advisorId, clientId]);

  useEffect(() => { reload(); }, [reload]);

  async function addNote(body, forClient) {
    if (!body.trim()) return false;
    const { data, error } = await supabase.from('advisor_notes').insert({ advisor_id: advisorId, client_id: clientId, body: body.trim(), for_client: !!forClient }).select().single();
    if (error) { toast('שגיאה בשמירת ההערה', 'error'); return false; }
    toast('הערה נוספה', 'success');
    setNotes(prev => [data, ...prev]);
    return true;
  }

  async function editNote(id, body, forClient) {
    if (!body.trim()) return;
    setNotes(prev => prev.map(n => n.id === id ? { ...n, body: body.trim(), for_client: !!forClient } : n));
    const { error } = await supabase.from('advisor_notes').update({ body: body.trim(), for_client: !!forClient }).eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בעדכון ההערה', 'error'); reload(); return; }
    toast('ההערה עודכנה', 'success');
  }

  async function deleteNote(id) {
    const removed = notes.find(n => n.id === id);
    const { error } = await supabase.from('advisor_notes').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
    toast('ההערה נמחקה', 'success', removed ? { label: 'בטל', onClick: () => addNote(removed.body, removed.for_client) } : null);
  }

  async function addTask(title, dueDate, forClient) {
    if (!title.trim()) return false;
    const { data, error } = await supabase.from('advisor_tasks').insert({ advisor_id: advisorId, client_id: clientId, title: title.trim(), due_date: dueDate || null, for_client: !!forClient }).select().single();
    if (error) { toast('שגיאה בהוספת המשימה', 'error'); return false; }
    toast('משימה נוספה', 'success');
    setTasks(prev => [data, ...prev].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)));
    return true;
  }

  async function toggleTask(id, done) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done } : t));
    const { error } = await supabase.from('advisor_tasks').update({ done }).eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בעדכון המשימה', 'error'); reload(); return; }
    toast(done ? 'משימה סומנה כהושלמה' : 'משימה סומנה כפתוחה', 'success');
  }

  async function editTask(id, title, dueDate, forClient) {
    if (!title.trim()) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title: title.trim(), due_date: dueDate || null, for_client: !!forClient } : t));
    const { error } = await supabase.from('advisor_tasks').update({ title: title.trim(), due_date: dueDate || null, for_client: !!forClient }).eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בעדכון המשימה', 'error'); reload(); return; }
    toast('המשימה עודכנה', 'success');
  }

  async function deleteTask(id) {
    const removed = tasks.find(t => t.id === id);
    const { error } = await supabase.from('advisor_tasks').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setTasks(prev => prev.filter(t => t.id !== id));
    toast('המשימה נמחקה', 'success', removed ? { label: 'בטל', onClick: () => addTask(removed.title, removed.due_date, removed.for_client) } : null);
  }

  async function addMeeting(scheduledAt, notesText, forClient = true) {
    if (!scheduledAt) return false;
    const { data, error } = await supabase.from('advisor_meetings').insert({ advisor_id: advisorId, client_id: clientId, scheduled_at: scheduledAt, notes: notesText || null, for_client: !!forClient }).select().single();
    if (error) { toast('שגיאה בקביעת הפגישה', 'error'); return false; }
    toast('פגישה נקבעה', 'success');
    setMeetings(prev => [...prev, data].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)));
    return true;
  }

  async function editMeeting(id, scheduledAt, notesText, forClient) {
    if (!scheduledAt) return;
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, scheduled_at: scheduledAt, notes: notesText || null, for_client: !!forClient } : m).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)));
    const { error } = await supabase.from('advisor_meetings').update({ scheduled_at: scheduledAt, notes: notesText || null, for_client: !!forClient }).eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בעדכון הפגישה', 'error'); reload(); return; }
    toast('הפגישה עודכנה', 'success');
  }

  async function deleteMeeting(id) {
    const removed = meetings.find(m => m.id === id);
    const { error } = await supabase.from('advisor_meetings').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setMeetings(prev => prev.filter(m => m.id !== id));
    toast('הפגישה נמחקה', 'success', removed ? { label: 'בטל', onClick: () => addMeeting(removed.scheduled_at, removed.notes, removed.for_client) } : null);
  }

  return { notes, tasks, meetings, loading, error, reload, addNote, editNote, deleteNote, addTask, editTask, toggleTask, deleteTask, addMeeting, editMeeting, deleteMeeting };
}
