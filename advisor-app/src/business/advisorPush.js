import { supabase, SUPA_URL } from '../supabaseClient.js';

const ADVISOR_PREFS = { daily: false, budget: false, renewals: false, monthly: false, advisor: true };
const ASKED_KEY = 'advisor_push_asked';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const swUrl = () => new URL('../sw.js', window.location.origin + import.meta.env.BASE_URL).href;
const swScope = () => new URL('../', window.location.origin + import.meta.env.BASE_URL).pathname;

export function urlBase64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function vapidKey() {
  const res = await fetch(SUPA_URL + '/functions/v1/budget-push?action=vapid', { headers: { Authorization: 'Bearer ' + import.meta.env.VITE_SUPABASE_ANON } });
  if (!res.ok) throw new Error('vapid');
  return (await res.json()).publicKey;
}

export async function ensurePush(userId) {
  if (!pushSupported() || Notification.permission === 'denied') return 'off';
  if (Notification.permission === 'default') {
    try { if (localStorage.getItem(ASKED_KEY)) return 'off'; localStorage.setItem(ASKED_KEY, '1'); } catch { /* storage unavailable */ }
    if ((await Notification.requestPermission()) !== 'granted') return 'off';
  }
  await navigator.serviceWorker.register(swUrl(), { scope: swScope() });
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(await vapidKey()) });
  const { data: existing } = await supabase.from('push_subscriptions').select('endpoint').eq('endpoint', sub.endpoint).eq('user_id', userId).maybeSingle();
  if (existing) return 'on';
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, prefs: ADVISOR_PREFS }, { onConflict: 'endpoint' });
  return error ? 'off' : 'on';
}
