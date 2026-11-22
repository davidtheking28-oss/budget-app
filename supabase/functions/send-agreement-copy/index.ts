import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import nodemailer from 'npm:nodemailer@6.9.16'
import { buildMailMessage } from './agreementHtml.js'

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
    const mailUser = Deno.env.get('GMAIL_USER')
    const mailPassword = Deno.env.get('GMAIL_APP_PASSWORD')
    if (!mailUser || !mailPassword) return json({ error: 'not_configured' }, 503)
    const from = `"שקל שקל" <${mailUser}>`

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
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: mailUser, pass: mailPassword },
      })
      await transport.sendMail(buildMailMessage(record, from, user.email))
    } catch (err) {
      failure = `smtp_failed: ${String(err).slice(0, 300)}`
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
