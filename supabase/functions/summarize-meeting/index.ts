import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  'https://davidtheking28-oss.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 60

async function checkRateLimit(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.get('Authorization')
    // Fail closed: a bare anon-key caller resolves to no user, and the anon key is
    // public. Letting those through meant uncounted, unlimited Groq calls.
    if (!authHeader) return false
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
    const { count } = await supabase
      .from('ai_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)
    if ((count ?? 0) >= RATE_LIMIT_MAX) return false
    await supabase.from('ai_requests').insert({ user_id: user.id })
    return true
  } catch (err) {
    // Fail CLOSED: a transient DB/auth hiccup must not hand out an unmetered
    // pass to a shared paid API key. Better a retryable error than open quota.
    console.error('rate limit check failed', err)
    return false
  }
}

// free-tier availability varies per model; try in order and use the first that answers
const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

async function callGroq(key: string, messages: unknown[]) {
  let last = { status: 0, detail: 'no model tried' }
  for (const model of MODELS) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, messages, temperature: 0, max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    })
    const ai = await res.json()
    const text = ai?.choices?.[0]?.message?.content
    if (res.ok && text) return { text, model }
    last = { status: res.status, detail: ai?.error?.message ?? 'no text in response' }
    console.error('groq failed', model, res.status, String(last.detail).slice(0, 200))
    if (res.status !== 429 && res.status !== 404) break
  }
  return { error: last }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const GROQ_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_KEY) return json({ error: 'not_configured' }, 503)

    if (!await checkRateLimit(req)) return json({ error: 'rate_limited' }, 429)

    const { summary } = await req.json()
    if (!summary) return json({ error: 'missing_summary' }, 400)

    const system = `You are an assistant for a financial advisor working in Hebrew.
Given a meeting summary written by the advisor about a client meeting, suggest a short list of
concrete, actionable tasks the advisor should assign to the client as a result of the meeting.
Each task must be a short, imperative Hebrew sentence (e.g. "להעביר תדפיס בנק אחרון").
Return between 1 and 6 tasks. No preamble, no commentary, no numbering.
Output ONLY a JSON object: {"tasks":["task 1","task 2"]}`

    const out = await callGroq(GROQ_KEY, [
      { role: 'system', content: system },
      { role: 'user', content: String(summary) },
    ])
    if ('error' in out) return json({ error: 'upstream', ...out.error }, 502)
    const text = out.text

    let parsed
    try { parsed = JSON.parse(text) } catch { return json({ error: 'bad_json' }, 502) }
    const tasks = Array.isArray(parsed?.tasks)
      ? parsed.tasks.filter((t: unknown) => typeof t === 'string' && t.trim()).slice(0, 6)
      : []
    if (!tasks.length) return json({ error: 'no_tasks' }, 502)

    return json({ tasks }, 200)
  } catch (err) {
    console.error('summarize-meeting', err)
    return json({ error: 'server', detail: String(err) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
