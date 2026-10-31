import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientApprovals, TRASH_DAYS } from './useClientApprovals.js';
import { INVITE_ERROR_MESSAGES } from '../clients/inviteMessages.js';
import { toast } from '../toast.js';
import Skeleton from '../components/Skeleton.jsx';
import { formatDate } from '../budget/monthUtils.js';
import styles from './Business.module.css';

const STATUS_LABEL = {
  active: 'פעיל',
  requested: 'ממתין לאישורך',
  waitApproval: 'ממתין לאישור הלקוח',
  waitSignup: 'ממתין להרשמה לאפליקציה',
  blocked: 'חסום',
  trashed: 'בפח'
};

const ACTIONS = {
  approve: { label: 'אישור' },
  end: { label: 'סיום ליווי', confirm: 'לסיים ליווי? החשבון והנתונים של הלקוח נשארים' },
  block: { label: 'חסימה', confirm: 'לחסום? הלקוח יוסר מהרשימה ולא ניתן יהיה להזמין אותו' },
  trash: { label: 'העברה לפח', confirm: 'להעביר לפח? אפשר לשחזר עד ' + TRASH_DAYS + ' יום' },
  cancel: { label: 'ביטול הזמנה', confirm: 'לבטל את ההזמנה?' },
  reject: { label: 'דחייה', confirm: 'לדחות את הבקשה?' }
};

const ROW_ACTIONS = {
  active: ['end', 'block', 'trash'],
  requested: ['approve', 'reject', 'block'],
  waitApproval: ['cancel', 'block'],
  waitSignup: ['cancel', 'block'],
  blocked: [],
  trashed: []
};

export default function ClientApprovals({ advisorId }) {
  const { links, archive, loading, reload } = useClientApprovals(advisorId);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [confirming, setConfirming] = useState(null);

  if (loading) return <Skeleton height="220px" radius="18px" />;

  const rows = [
    ...links.map(l => ({
      key: 'l' + l.id, id: l.id, email: l.client_email || l.invited_email, createdAt: l.created_at,
      kind: l.status === 'active' ? 'active' : l.requested_by_client ? 'requested' : l.client_id ? 'waitApproval' : 'waitSignup'
    })),
    ...archive.map(a => ({ key: 'a' + a.id, id: a.id, email: a.client_email, createdAt: a.created_at, kind: a.state === 'blocked' ? 'blocked' : 'trashed' }))
  ];
  const count = kind => rows.filter(r => r.kind === kind).length;
  const needle = search.trim().toLowerCase();
  const visible = rows.filter(r => (filter === 'all' || r.kind === filter) && (!needle || (r.email || '').toLowerCase().includes(needle)));

  async function invite() {
    const trimmed = email.trim();
    if (!trimmed) { toast('הזן כתובת אימייל', 'error'); return; }
    setSending(true);
    const { data, error } = await supabase.rpc('invite_client_by_email', { p_email: trimmed });
    setSending(false);
    if (error) { toast('שגיאה בשליחת ההזמנה, נסה שוב', 'error'); return; }
    if (data !== 'ok') { toast(INVITE_ERROR_MESSAGES[data] || 'שגיאה בשליחת ההזמנה', 'error'); return; }
    toast('ההזמנה נשלחה', 'success');
    setEmail('');
    reload();
  }

  async function run(row, action) {
    setConfirming(null);
    let error;
    if (action === 'approve') {
      const res = await supabase.rpc('approve_advisor_client', { p_link: row.id });
      error = res.error || (res.data !== 'ok' ? { message: res.data } : null);
    } else if (action === 'end' || action === 'cancel' || action === 'reject') {
      ({ error } = await supabase.from('advisor_clients').delete().eq('id', row.id).eq('advisor_id', advisorId));
    } else {
      const res = await supabase.rpc('archive_advisor_client', { p_link: row.id, p_state: action === 'block' ? 'blocked' : 'trashed' });
      error = res.error || (res.data !== 'ok' ? { message: res.data } : null);
    }
    if (error) { toast('הפעולה נכשלה, נסה שוב', 'error'); return; }
    toast(action === 'approve' ? 'הלקוח אושר' : action === 'end' ? 'הליווי הסתיים' : action === 'cancel' ? 'ההזמנה בוטלה' : action === 'block' ? 'הלקוח נחסם' : 'הועבר לפח', 'success');
    reload();
  }

  async function restore(row) {
    const { data, error } = await supabase.rpc('restore_advisor_client', { p_archive: row.id });
    if (error || data !== 'ok') { toast('הפעולה נכשלה, נסה שוב', 'error'); return; }
    toast(row.kind === 'blocked' ? 'החסימה בוטלה' : 'שוחזר, נשלחה הזמנה חדשה ללקוח', 'success');
    reload();
  }

  const tiles = [
    { kinds: ['requested'], label: 'ממתינים לאישור', note: 'נרשמו דרך הקישור שלך' },
    { kinds: ['waitApproval', 'waitSignup'], label: 'הזמנות שנשלחו', note: 'ממתינות להרשמה או לאישור הלקוח' },
    { kinds: ['active'], label: 'לקוחות פעילים', note: 'מחוברים אליך כרגע' },
    { kinds: ['blocked'], label: 'חסומים', note: 'לא ניתן להזמין אותם' }
  ];

  return (
    <div className={styles.stack}>
      <div className={styles.grid4}>
        {tiles.map(t => (
          <div key={t.label} className={styles.stat}><div className={styles.statLabel}>{t.label}</div><div className={styles.statValue}>{t.kinds.reduce((n, k) => n + count(k), 0)}</div><div className={styles.statNote}>{t.note}</div></div>
        ))}
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>הזמן לקוח חדש</h2>
        </div>
        <div className={styles.toolbar}>
          <input className={styles.input + ' ' + styles.inputGrow} type="email" dir="ltr" placeholder="כתובת אימייל של הלקוח" aria-label="הזמן לקוח באימייל" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && invite()} />
          <button type="button" className={styles.btn} onClick={invite} disabled={sending}>שלח הזמנה</button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>ניהול משתמשים</h2>
          <div className={styles.toolbar}>
            <select className={styles.input} aria-label="סינון לפי סטטוס" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">כל הסטטוסים</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className={styles.input} type="search" placeholder="חיפוש לפי מייל..." aria-label="חיפוש משתמש" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {visible.length === 0 ? <div className={styles.emptyState}><span>אין משתמשים להצגה</span></div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>אימייל</th><th>נשלח</th><th>סטטוס</th><th><span className={styles.srOnly}>פעולות</span></th></tr></thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.key}>
                    <td dir="ltr" className={styles.rowMeta}>{r.email}</td>
                    <td className={styles.num}>{formatDate(r.createdAt.slice(0, 10))}</td>
                    <td><span className={styles.tag}>{STATUS_LABEL[r.kind]}</span></td>
                    <td>
                      {confirming?.key === r.key ? (
                        <div className={styles.toolbar}>
                          <button type="button" className={styles.btnGhost} onClick={() => run(r, confirming.action)}>{ACTIONS[confirming.action].confirm}</button>
                          <button type="button" className={styles.btnGhost} onClick={() => setConfirming(null)}>חזרה</button>
                        </div>
                      ) : (
                        <div className={styles.toolbar}>
                          {ROW_ACTIONS[r.kind].map(a => (
                            <button key={a} type="button" className={styles.btnGhost} aria-label={ACTIONS[a].label + ': ' + r.email} onClick={() => (a === 'approve' ? run(r, a) : setConfirming({ key: r.key, action: a }))}>{ACTIONS[a].label}</button>
                          ))}
                          {(r.kind === 'blocked' || r.kind === 'trashed') && (
                            <button type="button" className={styles.btnGhost} aria-label={(r.kind === 'blocked' ? 'ביטול חסימה: ' : 'שחזור: ') + r.email} onClick={() => restore(r)}>{r.kind === 'blocked' ? 'ביטול חסימה' : 'שחזור'}</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
