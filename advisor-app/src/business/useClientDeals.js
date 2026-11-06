import { syncJourneyMeetings, meetingPresentationStatus } from './journeyMath.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function useClientDeals(advisorId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const requestRef = useRef(0);
  const savingRef = useRef(0);
  const reload = useCallback(async (background = false) => {
    if (!advisorId || (background && savingRef.current)) return;
    const request = ++requestRef.current;
    if (!background) setLoading(true);
    try {
    const { data: links, error: linkError } = await supabase
      .from('advisor_clients')
      .select('id, client_id, client_email, name, phone, created_at')
      .eq('advisor_id', advisorId)
      .in('status', ['active', 'manual'])
      .order('created_at', { ascending: false });
    if (linkError) throw linkError;
    if (request !== requestRef.current) return;
    const [{ data: deals, error: dealError }, { data: appointments, error: meetingError }] = await Promise.all([
      supabase.from('advisor_client_deals').select('*').eq('advisor_id', advisorId),
      supabase.from('advisor_meetings').select('id,client_id,scheduled_at,status,for_client,summary,decisions,requested_by_client').eq('advisor_id', advisorId)
    ]);
    if (request !== requestRef.current) return;
    if (dealError || meetingError) throw dealError || meetingError;
    const byLink = Object.fromEntries((deals || []).map(d => [d.link_id, d]));
    setError(null);
    setRows((links || []).map(link => {
      const clientMeetings = (appointments || []).filter(row => row.client_id === link.client_id);
      const nextAppointment = clientMeetings.filter(row => row.status !== 'declined' && new Date(row.scheduled_at).getTime() > Date.now()).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0] || null;
      return { ...link, nextAppointment: nextAppointment ? { ...nextAppointment, status: meetingPresentationStatus(nextAppointment) } : null, deal: { ...(byLink[link.id] || {}), journey: syncJourneyMeetings(byLink[link.id]?.journey, clientMeetings) } };
    }));
    } catch (err) { if (request === requestRef.current && !background) setError(err); }
    finally { if (request === requestRef.current) setLoading(false); }
  }, [advisorId]);

  useEffect(() => { const requests = requestRef; reload(); return () => { requests.current++; }; }, [reload]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) reload(true); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [reload]);

  async function saveDeal(link, patch) {
    savingRef.current++;
    requestRef.current++;
    const before = rows;
    const next = { link_id: link.id, advisor_id: advisorId, payment_status: 'unpaid', receipt_issued: false, ...(link.deal || {}), ...patch };
    setRows(prev => prev.map(r => r.id === link.id ? { ...r, deal: next } : r));
    let err;
    try {
      ({ error: err } = await supabase.from('advisor_client_deals').upsert({ ...next, updated_at: new Date().toISOString() }));
    } catch { err = true; }
    savingRef.current--;
    requestRef.current++;
    if (err) { toast('שגיאה בשמירה', 'error'); setRows(before); return false; }
    return true;
  }

  async function addManual(form) {
    const { data: id, error: err } = await supabase.rpc('add_manual_client', { p_name: form.name, p_phone: form.phone, p_email: form.email });
    if (err || !id) { toast('שגיאה בהוספת הלקוח', 'error'); return false; }
    const price = parseFloat(form.price);
    const { error: dealErr } = await supabase.from('advisor_client_deals').upsert({
      link_id: id, advisor_id: advisorId,
      price: Number.isFinite(price) ? Math.max(0, price) : null,
      payment_method: form.payment_method || null,
      source: form.source || null,
      payment_status: form.paid ? 'paid' : 'unpaid',
      receipt_issued: form.receipt,
      call_summary: form.call_summary.trim() || null,
      updated_at: new Date().toISOString()
    });
    if (dealErr) toast('הלקוח נוצר, אך פרטי העסקה לא נשמרו', 'error');
    else toast('הלקוח נוסף', 'success');
    await reload();
    return true;
  }

  async function saveContact(link, patch) {
    const before = rows;
    setRows(prev => prev.map(r => r.id === link.id ? { ...r, ...patch } : r));
    const { error: err } = await supabase.from('advisor_clients').update(patch).eq('id', link.id).eq('advisor_id', advisorId);
    if (err) { toast('שגיאה בשמירה', 'error'); setRows(before); return false; }
    return true;
  }

  return { rows, loading, error, reload, saveDeal, saveContact, addManual };
}
