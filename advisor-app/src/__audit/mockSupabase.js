import { makeDb, IDS } from './seed.js';

const params = new URLSearchParams(window.location.search);
const mode = params.get('data') || 'full';
const db = makeDb(mode);

const session = {
  user: { id: IDS.ADVISOR, email: 'advisor@budgetadvisor.co.il' },
  access_token: 'mock'
};

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

  function resolve() {
    let out = rows();
    for (const f of filters) out = out.filter(f);
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
    if (single === 'maybe') return { data: out[0] || null, error: null, count };
    if (single === 'one') return { data: out[0] || null, error: out[0] ? null : { message: 'no rows' }, count };
    return { data: out, error: null, count: wantCount ? count : null };
  }

  const api = {
    select(_cols, opts) {
      if (opts?.head) head = true;
      if (opts?.count) wantCount = true;
      if (pendingWrite) rows = () => clone(pendingWrite);
      return api;
    },
    insert(vals) {
      const arr = Array.isArray(vals) ? vals : [vals];
      const made = arr.map((v, i) => ({ id: 'new' + Date.now() + i, created_at: new Date().toISOString(), done: false, ...v }));
      db[table] = [...(db[table] || []), ...made];
      pendingWrite = made;
      rows = () => clone(made);
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
        const key = v.user_id !== undefined ? 'user_id' : 'client_id';
        const existing = (db[table] || []).find(r => r[key] === v[key]);
        if (existing) Object.assign(existing, v);
        else db[table] = [...(db[table] || []), v];
      });
      pendingWrite = arr;
      rows = () => clone(arr);
      return api;
    },
    delete() {
      rows = () => {
        const all = db[table] || [];
        const hit = all.filter(r => filters.every(f => f(r)));
        db[table] = all.filter(r => !hit.includes(r));
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
    gte(col, val) { filters.push(r => r[col] >= val); return api; },
    lte(col, val) { filters.push(r => r[col] <= val); return api; },
    is(col, val) { filters.push(r => r[col] === val); return api; },
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
