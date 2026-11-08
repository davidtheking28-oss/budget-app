import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

const keyOf = advisorId => `advisor_bookings_seen_${advisorId}`;
const readSince = advisorId => { try { return localStorage.getItem(keyOf(advisorId)); } catch { return null; } };
const writeSince = (advisorId, value) => { try { localStorage.setItem(keyOf(advisorId), value); } catch { /* storage unavailable */ } };

export function useNewClientBookings(advisorId, active) {
  const [unseen, setUnseen] = useState(0);
  const announced = useRef(new Set());
  const latest = useRef('');

  const load = useCallback(async () => {
    if (!advisorId) return;
    let since = readSince(advisorId);
    if (!since) { since = new Date().toISOString(); writeSince(advisorId, since); }
    const { data, error } = await supabase.from('advisor_meetings').select('id,client_id,scheduled_at,status,created_at').eq('advisor_id', advisorId).eq('requested_by_client', true).gt('created_at', since).order('created_at', { ascending: true });
    if (error || !data) return;
    setUnseen(data.length);
    if (data.length) latest.current = data[data.length - 1].created_at;
    const fresh = data.filter(m => !announced.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach(m => announced.current.add(m.id));
    const { data: clients } = await supabase.from('advisor_clients').select('client_id,name,client_email').eq('advisor_id', advisorId).in('client_id', fresh.map(m => m.client_id));
    const names = new Map((clients || []).map(c => [c.client_id, c.name || c.client_email]));
    for (const m of fresh) {
      const when = new Date(m.scheduled_at).toLocaleString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
      const text = `${names.get(m.client_id) || 'לקוח'} ${m.status === 'confirmed' ? 'קבע פגישה' : 'ביקש פגישה'}: ${when}`;
      toast(text, 'success');
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('פגישה חדשה', { body: text }); } catch { /* notifications unsupported */ }
    }
  }, [advisorId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 30000);
    window.addEventListener('focus', load);
    return () => { clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load]);

  useEffect(() => {
    if (!active || !advisorId || !latest.current) return;
    writeSince(advisorId, latest.current);
    latest.current = '';
    setUnseen(0);
  }, [active, advisorId, unseen]);

  return unseen;
}
