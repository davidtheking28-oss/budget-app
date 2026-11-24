import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import { bookingAnnouncement } from './bookingAnnouncement.js';

export function useNewClientBookings(advisorId) {
  const [waiting, setWaiting] = useState(0);
  const announced = useRef(new Set());

  const load = useCallback(async () => {
    if (!advisorId) return;
    const { data, error } = await supabase.from('advisor_meetings').select('id,client_id,scheduled_at,status,created_at').eq('advisor_id', advisorId).eq('requested_by_client', true).eq('status', 'pending').order('created_at', { ascending: true });
    if (error || !data) return;
    setWaiting(data.length);
    const fresh = data.filter(m => !announced.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach(m => announced.current.add(m.id));
    const { data: clients } = await supabase.from('advisor_clients').select('client_id,name,client_email').eq('advisor_id', advisorId).in('client_id', fresh.map(m => m.client_id));
    const names = new Map((clients || []).map(c => [c.client_id, c.name || c.client_email]));
    for (const m of fresh) {
      const text = bookingAnnouncement(m, names.get(m.client_id));
      toast(text, 'success');
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('בקשת פגישה חדשה', { body: text }); } catch { /* notifications unsupported */ }
    }
  }, [advisorId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 30000);
    window.addEventListener('focus', load);
    return () => { clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load]);

  return waiting;
}
