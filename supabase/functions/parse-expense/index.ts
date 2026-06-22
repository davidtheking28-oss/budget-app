const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CATEGORIES = [
  'אוכל','מסעדות','קניות','תחבורה ונסיעות','שכר דירה','חשמל ומים',
  'ארנונה','תקשורת','בריאות','ביגוד והנעלה','חינוך','בילויים',
  'ספורט','חופשות וטיולים','ביטוח','מתנות ואירועים','בעלי חיים',
  'תיקונים ואחזקה','אחר'
]

const SYSTEM_PROMPT = `You are a budget categorization assistant for a Hebrew personal finance app.
Given a transaction description (in Hebrew or English), extract:
1. category: one of [${CATEGORIES.join(', ')}]
2. amount: number if mentioned, otherwise null
3. description: clean short name of the merchant/purchase

Rules:
- category MUST be exactly one from the list above
- If unsure, use "אחר"
- Output ONLY valid JSON, no markdown

Output format: {"category":"...","amount":null,"description":"..."}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { message, customCats } = await req.json()

    const cats = customCats?.length
      ? [...CATEGORIES.slice(0,-1), ...customCats, 'אחר']
      : CATEGORIES

    const prompt = SYSTEM_PROMPT.replace(
      CATEGORIES.join(', '),
      cats.join(', ')
    )

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 128,
        system:     prompt,
        messages:   [{ role: 'user', content: message }],
      }),
    })

    const ai     = await res.json()
    const parsed = JSON.parse(ai.content[0].text)

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status:  500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
