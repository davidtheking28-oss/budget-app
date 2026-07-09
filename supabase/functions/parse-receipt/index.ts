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

const MODEL = 'gemini-2.0-flash'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_KEY) return json({ error: 'not_configured' }, 503)

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

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{
            role: 'user',
            parts: [
              { inline_data: { mime_type: mediaType || 'image/jpeg', data: image } },
              { text: 'Extract the receipt data.' },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 256,
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
