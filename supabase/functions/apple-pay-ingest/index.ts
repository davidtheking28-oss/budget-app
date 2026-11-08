const OK = { 'Content-Type': 'application/json' }

function reply(ok: boolean, status = 200) {
  return new Response(JSON.stringify({ ok }), { status, headers: OK })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(false, 405)
  const token = new URL(req.url).searchParams.get('t') ?? ''
  if (!/^ab1_[0-9a-f]{64}$/.test(token)) return reply(false, 400)
  const raw = await req.text()
  if (raw.length > 2000) return reply(false, 413)
  let body: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
  } catch {
    return reply(false, 400)
  }
  const merchant = typeof body.merchant === 'string' ? body.merchant : ''
  const amount = typeof body.amount === 'string' || typeof body.amount === 'number' ? String(body.amount) : ''
  const key = Deno.env.get('SUPABASE_ANON_KEY')!
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/ingest_expense`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_token: token, p_merchant: merchant, p_amount: amount }),
  })
  if (!res.ok) return reply(false, 502)
  const data = await res.json().catch(() => null)
  return reply(!!(data && data.ok))
})
