const OK = { 'Content-Type': 'application/json' }
const URL_BASE = Deno.env.get('SUPABASE_URL')!

function reply(ok: boolean, status = 200) {
  return new Response(JSON.stringify({ ok }), { status, headers: OK })
}

async function log(stage: string, detail: Record<string, unknown>) {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) return
  try {
    await fetch(`${URL_BASE}/rest/v1/rpc/log_expense_hook_event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_stage: stage, p_detail: detail }),
    })
  } catch { /* logging never blocks ingestion */ }
}

async function hashPrefix(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('')
}

const shape = (v: string) => v.slice(0, 24).replace(/[0-9]/g, '9').replace(/[A-Za-z֐-׿]/g, 'a')

Deno.serve(async (req) => {
  const meta = { ua: (req.headers.get('user-agent') ?? '').slice(0, 60), ct: (req.headers.get('content-type') ?? '').slice(0, 60) }
  if (req.method !== 'POST') { await log('method', { ...meta, method: req.method }); return reply(false, 405) }
  const token = req.headers.get('x-budget-token') ?? ''
  if (!/^ab1_[0-9a-f]{64}$/.test(token)) {
    await log('token_format', { ...meta, len: token.length, ab1: token.startsWith('ab1_'), space: /\s/.test(token), upper: /[A-F]/.test(token) })
    return reply(false, 400)
  }
  const tok = await hashPrefix(token)
  const raw = await req.text()
  if (raw.length > 2000) { await log('too_large', { ...meta, tok, len: raw.length }); return reply(false, 413) }
  let body: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
  } catch {
    await log('bad_json', { ...meta, tok, len: raw.length, start: shape(raw.slice(0, 12)) })
    return reply(false, 400)
  }
  const merchant = typeof body.merchant === 'string' ? body.merchant : ''
  const amount = typeof body.amount === 'string' || typeof body.amount === 'number' ? String(body.amount) : ''
  const key = Deno.env.get('SUPABASE_ANON_KEY')!
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/ingest_expense`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_token: token, p_merchant: merchant, p_amount: amount }),
  })
  if (!res.ok) { await log('rpc_error', { ...meta, tok, status: res.status }); return reply(false, 502) }
  const data = await res.json().catch(() => null)
  const ok = !!(data && data.ok)
  await log('result', { ...meta, tok, ok, keys: Object.keys(body).slice(0, 6), merchant_len: merchant.length, amount_type: typeof body.amount, amount_shape: shape(amount) })
  return reply(ok)
})
