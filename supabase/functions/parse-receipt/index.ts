const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { image, mediaType, customCats } = await req.json()
    if (!image) throw new Error('missing image')

    const cats = customCats?.length
      ? [...CATEGORIES.slice(0, -1), ...customCats, 'אחר']
      : CATEGORIES

    const system = `You read receipt photos for a Hebrew budget app. Extract:
1. amount: the TOTAL paid (number, after discounts/tips)
2. description: short merchant name in Hebrew if possible
3. category: exactly one of [${cats.join(', ')}]
4. date: purchase date as YYYY-MM-DD, or null if unreadable

Output ONLY valid JSON: {"amount":123.45,"description":"...","category":"...","date":"YYYY-MM-DD"}
If the image is not a receipt, output {"error":"not_receipt"}.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
            { type: 'text', text: 'Extract the receipt data as JSON.' },
          ],
        }],
      }),
    })

    const ai = await res.json()
    const parsed = JSON.parse(ai.content[0].text)

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
