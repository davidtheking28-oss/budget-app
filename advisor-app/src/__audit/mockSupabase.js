import { makeDb, IDS } from './seed.js';

const params = new URLSearchParams(window.location.search);
const mode = params.get('data') || 'full';
const db = makeDb(mode);
db.report_shares = JSON.parse(sessionStorage.getItem('audit_report_shares') || '[]');

// The harness is pre-authenticated on purpose, so the auth screens are otherwise
// unreachable. ?auth=out renders the logged-out Login screen, ?auth=notadvisor
// renders the "this account is not an advisor" screen.
const authMode = params.get('auth') || 'in';
const session = authMode === 'out' ? null : {
  user: { id: IDS.ADVISOR, email: 'advisor@budgetadvisor.co.il' },
  access_token: 'mock'
};
if (authMode === 'notadvisor') db.advisors = [];

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function builder(table) {
  const filters = [];
  let rows = () => clone(db[table] || []);
  let order = null;
  let limit = null;
  let single = null;
  let pendingWrite = null;
  let head = false;
  let wantCount = false;
  let columns = null;

  function resolve() {
    if (params.get('write') === 'fail' && table === 'budget_data' && pendingWrite !== null) return { data: null, error: { message: 'QA write failed' } };
    if (params.get('crmWrite') === 'fail' && ['advisor_meetings', 'advisor_tasks'].includes(table) && pendingWrite !== null) return { data: null, error: { message: 'QA CRM write failed' } };
    if (params.get('clientsRead') === 'fail' && table === 'advisor_clients' && pendingWrite === null) return { data: null, error: { message: 'QA client list read failed' } };
    let out = rows();
    if (pendingWrite === null) for (const f of filters) out = out.filter(f);
    if (order) {
      const { col, asc } = order;
      out.sort((a, b) => {
        const av = a[col], bv = b[col];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (asc ? 1 : -1);
      });
    }
    const count = out.length;
    if (limit != null) out = out.slice(0, limit);
    if (head) return { data: null, error: null, count };
    if (columns) out = out.map(row => Object.fromEntries(columns.filter(key => key in row).map(key => [key, row[key]])));
    if (single === 'maybe') return { data: out[0] || null, error: null, count };
    if (single === 'one') return { data: out[0] || null, error: out[0] ? null : { message: 'no rows' }, count };
    return { data: out, error: null, count: wantCount ? count : null };
  }

  const api = {
    select(_cols, opts) {
      columns = _cols && _cols !== '*' ? _cols.split(',').map(key => key.trim()) : null;
      if (opts?.head) head = true;
      if (opts?.count) wantCount = true;
      return api;
    },
    insert(vals) {
      const arr = Array.isArray(vals) ? vals : [vals];
      const made = arr.map((v, i) => ({ id: 'new' + Date.now() + i, created_at: new Date().toISOString(), done: false, ...(table === 'advisor_meetings' ? { status: 'pending' } : {}), ...v }));
      let committed = false;
      pendingWrite = made;
      rows = () => { if (!committed) { db[table] = [...(db[table] || []), ...made]; committed = true; } return clone(made); };
      return api;
    },
    update(patch) {
      pendingWrite = [];
      const prev = rows;
      rows = () => {
        const all = db[table] || [];
        const hit = all.filter(r => filters.every(f => f([r][0])));
        hit.forEach(r => Object.assign(r, patch));
        return clone(hit);
      };
      void prev;
      return api;
    },
    upsert(vals) {
      const arr = Array.isArray(vals) ? vals : [vals];
      arr.forEach(v => {
        const key = v.user_id !== undefined ? 'user_id' : v.link_id !== undefined ? 'link_id' : 'client_id';
        const existing = (db[table] || []).find(r => r[key] === v[key]);
        if (existing) Object.assign(existing, v);
        else db[table] = [...(db[table] || []), v];
      });
      pendingWrite = arr;
      rows = () => clone(arr);
      return api;
    },
    delete() {
      pendingWrite = [];
      rows = () => {
        const all = db[table] || [];
        const hit = all.filter(r => filters.every(f => f(r)));
        db[table] = all.filter(r => !hit.includes(r));
        if (table === 'advisor_meetings') (db.advisor_tasks || []).forEach(t => { if (hit.some(m => m.id === t.meeting_id)) t.meeting_id = null; });
        return clone(hit);
      };
      return api;
    },
    eq(col, val) { filters.push(r => String(r[col]) === String(val)); return api; },
    // supports exactly the shape useClientSummary.js sends: "col.eq.val,col2.eq.val2"
    or(expr) {
      const clauses = expr.split(',').map(c => {
        const [col, , val] = c.split('.');
        return r => String(r[col]) === String(val);
      });
      filters.push(r => clauses.some(c => c(r)));
      return api;
    },
    neq(col, val) { filters.push(r => String(r[col]) !== String(val)); return api; },
    in(col, vals) { filters.push(r => vals.map(String).includes(String(r[col]))); return api; },
    gt(col, val) { filters.push(r => r[col] > val); return api; },
    gte(col, val) { filters.push(r => r[col] >= val); return api; },
    lte(col, val) { filters.push(r => r[col] <= val); return api; },
    is(col, val) { filters.push(r => r[col] === val); return api; },
    not(col, op, val) {
      if (op === 'is' && val === null) filters.push(r => r[col] !== null && r[col] !== undefined);
      return api;
    },
    order(col, opts) { order = { col, asc: opts?.ascending !== false }; return api; },
    limit(n) { limit = n; return api; },
    maybeSingle() { single = 'maybe'; return api; },
    single() { single = 'one'; return api; },
    then(onOk, onErr) {
      return new Promise(res => setTimeout(() => res(resolve()), 60)).then(onOk, onErr);
    }
  };
  return api;
}

export const SUPA_URL = 'https://mock.supabase.co';

export const supabase = {
  from: table => builder(table),
  rpc: async (fn, params) => {
    if (fn === 'create_report_share') {
      const id = crypto.randomUUID();
      db.report_shares.push({ id, advisor_id: IDS.ADVISOR, client_id: params.p_client_id, year: params.p_year, month: params.p_month, budget_mode: params.p_mode, revoked_at: null, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() });
      sessionStorage.setItem('audit_report_shares', JSON.stringify(db.report_shares));
      return { data: id, error: null };
    }
    if (fn === 'revoke_report_share') {
      const row = db.report_shares.find(s => s.id === params.p_id);
      if (row) row.revoked_at = new Date().toISOString();
      sessionStorage.setItem('audit_report_shares', JSON.stringify(db.report_shares));
      return { data: null, error: null };
    }
    if (fn === 'get_shared_report') {
      const row = db.report_shares.find(s => s.id === params.p_token && !s.revoked_at && new Date(s.expires_at) > new Date());
      if (!row) return { data: { found: false }, error: null };
      const budget = db.budget_data.find(b => b.user_id === row.client_id) || {};
      return { data: { found: true, year: row.year, month: row.month, client_email: 'qa.client@example.test', advisor_display_name: 'יועץ בדיקה', data: row.budget_mode === 'business' ? budget.business || {} : budget }, error: null };
    }
    if (fn === 'invite_client_by_email') {
      const email = (params?.p_email || '').trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { data: 'invalid_email', error: null };
      const existing = (db.advisor_clients || []).find(r => r.client_email === email && r.advisor_id === session.user.id);
      if (existing && existing.status === 'active') return { data: 'already_linked', error: null };
      if (existing && existing.status === 'pending') return { data: 'already_invited', error: null };
      db.advisor_clients = [...(db.advisor_clients || []), {
        id: 'inv' + Date.now(), advisor_id: session.user.id, client_id: null,
        client_email: email, invited_email: email, status: 'pending', created_at: new Date().toISOString()
      }];
      return { data: 'ok', error: null };
    }
    return { data: null, error: { message: 'mock' } };
  },
  channel: () => { const chan = { on: () => chan, subscribe: () => chan }; return chan; },
  removeChannel: () => {},
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://placehold.co/64x64' } })
    })
  },
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ error: null }),
    signInWithOtp: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null })
  }
};
