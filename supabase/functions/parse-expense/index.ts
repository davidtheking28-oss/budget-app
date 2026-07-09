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

const MODEL = 'gemini-2.0-flash'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // read per-request: custom secrets are not reliably populated at module load
    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_KEY) return json({ error: 'not_configured' }, 503)

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

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: String(message) }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 128,
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    const ai = await res.json()
    const text = ai?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!res.ok || !text) {
      console.error('gemini call failed', res.status, JSON.stringify(ai?.error ?? ai).slice(0, 400))
      return json({ error: 'upstream', status: res.status, detail: ai?.error?.message ?? null }, 502)
    }

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
