import { supabase, SUPA_URL } from './supabaseClient';

const MAX = 20;              // one broken render can fire in a loop
const seen = new Set();
let sent = 0;

const cut = (v, n) => {
  const s = v == null ? '' : String(v);
  return s.length > n ? s.slice(0, n) : s;
};

// Posts straight to PostgREST rather than through the client, so a failure
// inside supabase-js itself can still be reported. Never throws, never blocks.
export async function reportError(rec) {
  const key = `${rec.kind}|${rec.message}|${rec.lineno ?? ''}`;
  if (seen.has(key) || sent >= MAX) return;
  seen.add(key);
  sent++;

  const body = {
    kind: rec.kind,
    message: cut(rec.message, 500),
    source: cut(rec.source, 300) || null,
    lineno: rec.lineno ?? null,
    colno: rec.colno ?? null,
    stack: cut(rec.stack, 4000) || null,
    app: 'advisor',
    ua: cut(navigator.userAgent, 300),
  };

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) body.user_id = data.session.user?.id ?? null;
    await fetch(`${SUPA_URL}/rest/v1/client_errors`, {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON,
        Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  } catch {
    // reporting must never become the thing that breaks the page
  }
}

export function installErrorReporter() {
  window.addEventListener('error', (e) => {
    if (!e) return;
    reportError({
      kind: 'error',
      message: e.message,
      source: e.filename,
      lineno: e.lineno | 0,
      colno: e.colno | 0,
      stack: e.error?.stack,
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason;
    reportError({ kind: 'unhandledrejection', message: r?.message ?? r, stack: r?.stack });
  });
}
