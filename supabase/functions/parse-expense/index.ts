const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CATEGORIES = [
  'מזון לבית','אוכל בחוץ ובילויים','פארם','דלק וחניה','מתנות לאירועים ולשמחות',
  'ביגוד והנעלה','תחב״צ','כבישי אגרה','תספורת וקוסמטיקה','תחביבים','סיגריות',
  'חופשה/טיול','עזרת/שמרטף','תיקוני רכב','בריאות','בעלי חיים','דמי כיס/ילדים',
  'יהדות/חגים','ביטוח לאומי','שונות'
]

// free-tier availability varies per model; try in order and use the first that answers
const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

async function callGroq(key: string, messages: unknown[]) {
  let last = { status: 0, detail: 'no model tried' }
  for (const model of MODELS) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, messages, temperature: 0, max_tokens: 128,
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

    const { message, customCats } = await req.json()
    if (!message) return json({ error: 'missing_message' }, 400)

    const cats = customCats?.length
      ? [...CATEGORIES.slice(0, -1), ...customCats, 'שונות']
      : CATEGORIES

    const system = `You are a budget categorization assistant for a Hebrew personal finance app.
Given a transaction description (in Hebrew or English), extract:
1. category: exactly one of [${cats.join(', ')}]
2. amount: number if mentioned, otherwise null
3. description: clean short name of the merchant/purchase

If unsure about the category, use "שונות".
Output ONLY a JSON object: {"category":"...","amount":null,"description":"..."}`

    const out = await callGroq(GROQ_KEY, [
      { role: 'system', content: system },
      { role: 'user', content: String(message) },
    ])
    if ('error' in out) return json({ error: 'upstream', ...out.error }, 502)
    const text = out.text

    let parsed
    try { parsed = JSON.parse(text) } catch { return json({ error: 'bad_json' }, 502) }
    if (!cats.includes(parsed?.category)) parsed.category = 'שונות'

    return json(parsed, 200)
  } catch (err) {
    console.error('parse-expense', err)
    return json({ error: 'server', detail: String(err) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
