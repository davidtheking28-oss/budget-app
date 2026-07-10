const CORS = {
  'Access-Control-Allow-Origin': 'https://davidtheking28-oss.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
        model, messages, temperature: 0, max_tokens: 256,
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
    const GROQ_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_KEY) return json({ error: 'not_configured' }, 503)

    const { image, mediaType, customCats } = await req.json()
    if (!image) return json({ error: 'missing_image' }, 400)

    const cats = customCats?.length
      ? [...CATEGORIES.slice(0, -1), ...customCats, 'שונות']
      : CATEGORIES

    const system = `You read receipt photos for a Hebrew budget app. Extract:
1. amount: the TOTAL paid (number, after discounts/tips)
2. description: short merchant name in Hebrew if possible
3. category: exactly one of [${cats.join(', ')}]
4. date: purchase date as YYYY-MM-DD, or null if unreadable

Output ONLY a JSON object: {"amount":123.45,"description":"...","category":"...","date":"YYYY-MM-DD"}
If the image is not a receipt, output {"error":"not_receipt"}.`

    const out = await callGroq(GROQ_KEY, [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the receipt data.' },
          { type: 'image_url', image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${image}` } },
        ],
      },
    ])
    if ('error' in out) return json({ error: 'upstream', ...out.error }, 502)
    const text = out.text

    let parsed
    try { parsed = JSON.parse(text) } catch { return json({ error: 'bad_json' }, 502) }
    if (parsed?.error || typeof parsed?.amount !== 'number') return json({ error: 'not_receipt' }, 200)
    if (!cats.includes(parsed.category)) parsed.category = null   // model is free-form; let the client categorize

    return json(parsed, 200)
  } catch (err) {
    console.error('parse-receipt', err)
    return json({ error: 'server', detail: String(err) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
