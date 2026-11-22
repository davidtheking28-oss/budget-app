import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { buildResendPayload } from './agreementHtml.js'

const CORS = {
  'Access-Control-Allow-Origin': 'https://davidtheking28-oss.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DAILY_LIMIT = 3

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM')
    if (!resendKey || !from) return json({ error: 'not_configured' }, 503)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'unauthorized' }, 401)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user?.email) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countErr } = await admin
      .from('client_agreement_copy_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('requested_at', dayAgo)
    if (countErr) return json({ error: 'server' }, 500)
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: 'rate_limited' }, 429)

    const { data: record, error: recErr } = await admin
      .from('client_agreements')
      .select('*')
      .eq('user_id', user.id)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recErr) return json({ error: 'server' }, 500)
    if (!record) return json({ error: 'no_agreement' }, 404)

    const { data: request, error: reqErr } = await admin
      .from('client_agreement_copy_requests')
      .insert({ user_id: user.id, agreement_id: record.id })
      .select('id')
      .single()
    if (reqErr || !request) return json({ error: 'server' }, 500)

    let failure: string | null = null
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${resendKey}` },
        body: JSON.stringify(buildResendPayload(record, from, user.email)),
      })
      if (!res.ok) failure = `resend_${res.status}: ${(await res.text()).slice(0, 300)}`
    } catch (err) {
      failure = `fetch_failed: ${String(err).slice(0, 300)}`
    }

    if (failure) {
      console.error('send-agreement-copy', failure)
      await admin.from('client_agreement_copy_requests').update({ error: failure }).eq('id', request.id)
      return json({ error: 'send_failed' }, 502)
    }
    await admin.from('client_agreement_copy_requests').update({ sent_at: new Date().toISOString() }).eq('id', request.id)
    return json({ ok: true }, 200)
  } catch (err) {
    console.error('send-agreement-copy', err)
    return json({ error: 'server' }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
