import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': 'https://davidtheking28-oss.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Budget owns these. Everything else in this project belongs to the trading
// journal and must not be touched from here.
const BY_USER = ['budget_data', 'push_subscriptions', 'push_log', 'ai_requests', 'support_messages', 'client_errors']
const BY_CLIENT = ['advisor_clients', 'advisor_meetings', 'advisor_notes', 'advisor_tasks', 'economic_mappings']
const BY_ADVISOR = ['advisor_clients', 'advisor_meetings', 'advisor_notes', 'advisor_tasks', 'economic_mappings']

// The Supabase project is shared with the trading-journal app, which means
// auth.users is shared too. Deleting the auth row for someone who also uses that
// app would destroy data this function has no business deleting — so we detect
// it and stop at the budget data instead of guessing.
const OTHER_APP = ['trades', 'investments', 'investment_holdings', 'screener_watchlist', 'screener_prefs', 'screener_history', 'flex_statement_cache', 'missed_opportunities', 'user_settings']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'unauthorized' }, 401)

    const asUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await asUser.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const uid = user.id

    // Is this account also a trading-journal account?
    let sharedWithOtherApp = false
    for (const t of OTHER_APP) {
      const { count, error } = await admin.from(t).select('user_id', { count: 'exact', head: true }).eq('user_id', uid)
      if (error) continue      // table absent or renamed — not evidence of usage
      if ((count ?? 0) > 0) { sharedWithOtherApp = true; break }
    }

    const failed: string[] = []
    const del = async (table: string, col: string) => {
      const { error } = await admin.from(table).delete().eq(col, uid)
      if (error) failed.push(`${table}.${col}: ${error.message}`)
    }

    // If this user is an advisor, their client-facing rows go too.
    const { data: advisorRow } = await admin.from('advisors').select('user_id').eq('user_id', uid).maybeSingle()

    for (const t of BY_CLIENT) await del(t, 'client_id')
    if (advisorRow) {
      for (const t of BY_ADVISOR) await del(t, 'advisor_id')
    }
    await del('households', 'member_id')
    await del('households', 'owner_id')
    for (const t of BY_USER) await del(t, 'user_id')
    if (advisorRow) await del('advisors', 'user_id')

    if (failed.length) {
      console.error('delete-account partial failure', uid, failed)
      return json({ error: 'partial', failed }, 500)
    }

    if (sharedWithOtherApp) {
      // Data is gone; the login stays because it is not exclusively ours.
      return json({ deleted: 'data_only', reason: 'shared_account' }, 200)
    }

    const { error: authErr } = await admin.auth.admin.deleteUser(uid)
    if (authErr) {
      console.error('delete-account auth delete failed', uid, authErr.message)
      return json({ deleted: 'data_only', reason: 'auth_delete_failed' }, 200)
    }

    return json({ deleted: 'full' }, 200)
  } catch (err) {
    console.error('delete-account', err)
    return json({ error: 'server' }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
