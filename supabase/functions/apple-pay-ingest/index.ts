import { expenseNotice, setupNotice } from './notice.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

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

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function clients() {
  const { createClient } = await import('jsr:@supabase/supabase-js@2')
  return createClient(URL_BASE, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

type Admin = Awaited<ReturnType<typeof clients>>
type Notice = { title: string; body: string; url: string }

async function push(admin: Admin, userId: string, notice: Notice) {
  const { data: all } = await admin.from('push_subscriptions').select('*').eq('user_id', userId)
  const subs = (all || []).filter((s) => s.prefs?.payments !== false)
  if (!subs.length) return { subs: 0, sent: 0 }
  const { data: secret } = await admin.from('app_secrets').select('value').eq('key', 'vapid_keys').maybeSingle()
  if (!secret) return { subs: subs.length, sent: 0 }
  const webpush = await import('jsr:@negrel/webpush@0.5.0')
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(secret.value), { extractable: false })
  const server = await webpush.ApplicationServer.new({ contactInformation: URL_BASE, vapidKeys })
  const payload = JSON.stringify(notice)
  let sent = 0, failed = ''
  for (const sub of subs) {
    try {
      await server.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }).pushTextMessage(payload, {})
      sent++
    } catch (err) {
      const status = (err as { response?: Response })?.response?.status
      failed = String(status ?? err).slice(0, 80)
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
  }
  return { subs: subs.length, sent, ...(failed ? { failed } : {}) }
}

async function notify(hash: string, tok: string) {
  try {
    const admin = await clients()
    const { data: hook } = await admin.from('expense_hooks').select('user_id').eq('token_hash', hash).maybeSingle()
    if (!hook) return
    const { data: row } = await admin.from('incoming_expenses').select('merchant,amount').eq('user_id', hook.user_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!row) return
    await log('push', { tok, ...await push(admin, hook.user_id, expenseNotice(row.merchant, Number(row.amount))) })
  } catch (err) {
    await log('push', { tok, error: String(err).slice(0, 120) })
  }
}

async function nudge(req: Request) {
  const admin = await clients()
  const { data: secret } = await admin.from('app_secrets').select('value').eq('key', 'push_cron_secret').maybeSingle()
  if (!secret || req.headers.get('x-cron-secret') !== secret.value) return reply(false, 403)
  const { data: hooks } = await admin.from('expense_hooks').select('user_id,token_hash').is('last_seen_at', null).lt('created_at', new Date(Date.now() - 86400000).toISOString())
  for (const hook of hooks || []) {
    const tok = hook.token_hash.slice(0, 8)
    const entry = { user_id: hook.user_id, kind: 'apple_pay_setup', key: tok }
    const { data: logged } = await admin.from('push_log').insert(entry).select().maybeSingle()
    if (!logged) continue
    try {
      const result = await push(admin, hook.user_id, setupNotice)
      if (!result.sent) await admin.from('push_log').delete().match(entry)
      await log('nudge', { tok, ...result })
    } catch (err) {
      await admin.from('push_log').delete().match(entry)
      await log('nudge', { tok, error: String(err).slice(0, 120) })
    }
  }
  return reply(true)
}

const shape = (v: string) => v.slice(0, 24).replace(/[0-9]/g, '9').replace(/[A-Za-z֐-׿]/g, 'a')

Deno.serve(async (req) => {
  const meta = { ua: (req.headers.get('user-agent') ?? '').slice(0, 60), ct: (req.headers.get('content-type') ?? '').slice(0, 60) }
  if (req.method !== 'POST') { await log('method', { ...meta, method: req.method }); return reply(false, 405) }
  if (new URL(req.url).searchParams.get('action') === 'nudge') return nudge(req)
  const sent = req.headers.get('x-budget-token') ?? ''
  const hex = sent.toLowerCase().match(/(?:^|[^0-9a-f])([0-9a-f]{64})(?:$|[^0-9a-f])/)
  const token = /^ab1_[0-9a-f]{64}$/.test(sent) ? sent : hex ? 'ab1_' + hex[1] : ''
  if (token !== sent) {
    const form = sent.replace(/[0-9a-f]{64}/i, '<64hex>').replace(/[0-9a-fA-F]/g, 'h').slice(0, 40)
    const odd = [...sent].filter(c => !/[0-9a-zA-Z_]/.test(c)).slice(0, 6).map(c => 'U+' + c.codePointAt(0)!.toString(16))
    await log(token ? 'token_repaired' : 'token_format', { ...meta, len: sent.length, form, odd })
  }
  if (!token) { if (!sent) await log('no_token', meta); return reply(false, 400) }
  const hash = await hashToken(token)
  const tok = hash.slice(0, 8)
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
  if (ok && !data.duplicate) EdgeRuntime.waitUntil(notify(hash, tok))
  return reply(ok)
})
