import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': 'https://davidtheking28-oss.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
// A statement upload fires one call per page/photo at client concurrency ~3, not one
// call per "process" click — a legitimate 15-page upload must never trip this mid-run.
const RATE_LIMIT_MAX = 40

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

// Source of truth: advisor-app/src/categories.js EXPENSE_CATS. Deno edge functions
// can't import across the Vite/React boundary, so this is hardcoded — keep it in sync.
const CATEGORIES = [
  'מזון לבית','אוכל בחוץ ובילויים','פארם','דלק וחניה','מתנות לאירועים ולשמחות',
  'ביגוד והנעלה','תחב״צ','כבישי אגרה','תספורת וקוסמטיקה','תחביבים','סיגריות',
  'חופשה/טיול','עזרת/שמרטף','תיקוני רכב','בריאות','בעלי חיים','דמי כיס/ילדים',
  'יהדות/חגים','ביטוח לאומי','שונות'
]

// free-tier availability varies per model; try in order and use the first that answers
const MODELS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct']

async function callGroq(key: string, messages: unknown[]) {
  let last = { status: 0, detail: 'no model tried' }
  for (const model of MODELS) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, messages, temperature: 0, max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    })
    const ai = await res.json()
    const text = ai?.choices?.[0]?.message?.content
    if (res.ok && text) return { text, model }
    last = { status: res.status, detail: ai?.error?.message ?? 'no text in response' }
    console.error('groq failed', model, res.status, String(last.detail).slice(0, 200))
    if (res.status !== 429 && res.status !== 404) break   // real error, not "model unavailable"
  }
  return { error: last }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const allowed = await checkRateLimit(req)
    if (!allowed) return json({ error: 'rate_limited' }, 429)

    const GROQ_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_KEY) return json({ error: 'not_configured' }, 503)

    const { image, mediaType, monthHint } = await req.json()
    if (!image) return json({ error: 'missing_image' }, 400)

    const system = `You read a single page of a credit-card/bank statement (photo or scanned PDF page, Hebrew or English) for a Hebrew budget app. Extract every individual transaction line — skip running balances, subtotals, page headers/footers, and the statement's own summary rows.

For each transaction:
1. date: transaction date as YYYY-MM-DD. These are Israeli documents: a comma is a THOUSANDS separator, not a decimal point — "3,770" means 3770, not 3.77. If the year is missing or ambiguous on the page${monthHint ? ` and the advisor has tagged this file as the month ${monthHint}, prefer that month/year` : ''}, use your best judgement from context on the page.
2. desc: short merchant/description in Hebrew if possible
3. amount: the transaction amount (positive number, after any discount)
4. category: exactly one of [${CATEGORIES.join(', ')}]

Output ONLY a JSON object:
{"transactions":[{"date":"YYYY-MM-DD","desc":"...","amount":123.4,"category":"..."}],"page_looks_like_statement":true}

If the page is not a statement page with transaction lines (e.g. a cover page, an ad, or unreadable), output {"transactions":[],"page_looks_like_statement":false}.`

    const out = await callGroq(GROQ_KEY, [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract every transaction line from this statement page.' },
          { type: 'image_url', image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${image}` } },
        ],
      },
    ])
    if ('error' in out) return json({ error: 'upstream', ...out.error }, 502)
    const text = out.text

    let parsed
    try { parsed = JSON.parse(text) } catch { return json({ error: 'bad_json' }, 502) }
    if (!Array.isArray(parsed?.transactions)) return json({ error: 'bad_json' }, 502)

    const transactions = parsed.transactions
      .filter((t: unknown) => t && typeof (t as { amount?: unknown }).amount === 'number')
      .map((t: { date?: unknown; desc?: unknown; amount: number; category?: unknown }) => ({
        date: typeof t.date === 'string' ? t.date : null,
        desc: typeof t.desc === 'string' ? t.desc : '',
        amount: t.amount,
        category: CATEGORIES.includes(t.category as string) ? t.category : null,
      }))

    return json({ transactions, page_looks_like_statement: !!parsed.page_looks_like_statement }, 200)
  } catch (err) {
    console.error('parse-statement', err)
    return json({ error: 'server', detail: String(err) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
