import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientApprovals, TRASH_DAYS } from './useClientApprovals.js';
import { toast } from '../toast.js';
import Families from './Families.jsx';
import { signupMessage } from './clientApp.js';
import Skeleton from '../components/Skeleton.jsx';
import { formatDate } from '../budget/monthUtils.js';
import styles from './Business.module.css';
import layout from './ClientApprovals.module.css';

const STATUS_LABEL = {
  active: 'פעיל',
  manual: 'לקוח ידני',
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
  remove: { label: 'מחיקה', confirm: 'למחוק את הלקוח? פרטי העסקה שלו יימחקו' },
  cancel: { label: 'ביטול הזמנה', confirm: 'לבטל את ההזמנה?' },
  reject: { label: 'דחייה', confirm: 'לדחות את הבקשה?' }
};

const ROW_ACTIONS = {
  active: ['end', 'block', 'trash'],
  manual: ['remove'],
  requested: ['approve', 'reject', 'block'],
  waitApproval: ['cancel', 'block'],
  waitSignup: ['cancel', 'block'],
  blocked: [],
  trashed: []
};

export default function ClientApprovals({ advisorId }) {
  const { links, archive, loading, reload } = useClientApprovals(advisorId);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [confirming, setConfirming] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);

  if (loading) return <Skeleton height="220px" radius="18px" />;

  const rows = [
    ...links.map(l => ({
      key: 'l' + l.id, id: l.id, name: l.name, email: l.client_email || l.invited_email || '', createdAt: l.created_at,
      kind: l.status === 'active' ? 'active' : l.status === 'manual' ? 'manual' : l.requested_by_client ? 'requested' : l.client_id ? 'waitApproval' : 'waitSignup'
    })),
    ...archive.map(a => ({ key: 'a' + a.id, id: a.id, email: a.client_email, createdAt: a.created_at, kind: a.state === 'blocked' ? 'blocked' : 'trashed' }))
  ];
  const count = kind => rows.filter(r => r.kind === kind).length;
  const needle = search.trim().toLowerCase();
  const visible = rows.filter(r => (filter === 'all' || r.kind === filter) && (!needle || (r.email + ' ' + (r.name || '')).toLowerCase().includes(needle)));

  async function run(row, action) {
    setConfirming(null);
    let error;
    if (action === 'approve') {
      const res = await supabase.rpc('approve_advisor_client', { p_link: row.id });
      error = res.error || (res.data !== 'ok' ? { message: res.data } : null);
    } else if (action === 'end' || action === 'remove' || action === 'cancel' || action === 'reject') {
      ({ error } = await supabase.from('advisor_clients').delete().eq('id', row.id).eq('advisor_id', advisorId));
    } else {
      const res = await supabase.rpc('archive_advisor_client', { p_link: row.id, p_state: action === 'block' ? 'blocked' : 'trashed' });
      error = res.error || (res.data !== 'ok' ? { message: res.data } : null);
    }
    if (error) { toast('הפעולה נכשלה, נסה שוב', 'error'); return; }
    toast(action === 'approve' ? 'הלקוח אושר' : action === 'remove' ? 'הלקוח נמחק' : action === 'end' ? 'הליווי הסתיים' : action === 'cancel' ? 'ההזמנה בוטלה' : action === 'block' ? 'הלקוח נחסם' : 'הועבר לפח', 'success');
    reload();
  }

  const selected = visible.find(r => r.key === selectedKey) || visible[0] || null;
  const initial = r => ((r.name || r.email || '?').trim()[0] || '?').toUpperCase();
  const panelActions = r => ROW_ACTIONS[r.kind].filter(a => a !== 'block' && a !== 'trash');
  const dangerActions = r => ROW_ACTIONS[r.kind].filter(a => a === 'block' || a === 'trash');
  const actionHint = { approve: 'ישויך אוטומטית ללקוח ידני עם אותו מייל, אם קיים', end: 'בלי למחוק את החשבון', cancel: 'ההזמנה תוסר מהרשימה', reject: 'הבקשה תוסר מהרשימה', remove: 'פרטי העסקה יימחקו', block: 'אי אפשר להזמין שוב', trash: 'אפשר לשחזר עד ' + TRASH_DAYS + ' יום' };
  const chooseAction = (r, a) => (a === 'approve' ? run(r, a) : setConfirming({ key: r.key, action: a }));

  async function restore(row) {
    const { data, error } = await supabase.rpc('restore_advisor_client', { p_archive: row.id });
    if (error || data !== 'ok') { toast('הפעולה נכשלה, נסה שוב', 'error'); return; }
    toast(row.kind === 'blocked' ? 'החסימה בוטלה' : 'שוחזר, נשלחה הזמנה חדשה ללקוח', 'success');
    reload();
  }

  async function copySignupLink() {
    const message = signupMessage(advisorId);
    try {
      await navigator.clipboard.writeText(message);
      toast('הקישור הועתק, אפשר להדביק ללקוח', 'success');
    } catch {
      window.prompt('העתק את ההודעה ושלח ללקוח:', message);
    }
  }

  const tiles = [
    { kinds: ['requested'], label: 'ממתינים לאישור', note: 'נרשמו דרך הקישור שלך' },
    { kinds: ['waitApproval', 'waitSignup'], label: 'ממתינים לשיוך', note: 'הוזמנו על ידיך ועוד לא חוברו' },
    { kinds: ['active'], label: 'לקוחות פעילים', note: 'מחוברים אליך כרגע' },
    { kinds: ['blocked'], label: 'חסומים', note: 'לא יכולים להירשם דרך הקישור' }
  ];

  return (
    <div className={styles.stack}>
      <div className={layout.overview}>
        {tiles.map(t => (
          <div key={t.label} className={layout.metric}><div className={styles.statLabel}>{t.label}</div><div className={styles.statValue}>{t.kinds.reduce((n, k) => n + count(k), 0)}</div><div className={styles.statNote}>{t.note}</div></div>
        ))}
      </div>

      <section className={styles.card + ' ' + layout.inviteCard}>
        <div className={styles.inviteRow}>
          <div className={styles.inviteText}>
            <h2 className={styles.cardTitle}>הזמן לקוח חדש</h2>
            <p className={styles.note} style={{ margin: 0 }}>שלח ללקוח קישור. הוא נרשם בעצמו, והבקשה שלו מופיעה כאן לאישורך.</p>
          </div>
          <div className={styles.toolbar}>
            <button type="button" className={styles.btn} onClick={copySignupLink}>העתק קישור הזמנה</button>
            <a className={styles.btnGhost} style={{ textDecoration: 'none' }} href={'https://wa.me/?text=' + encodeURIComponent(signupMessage(advisorId))} target="_blank" rel="noopener noreferrer">שלח בוואטסאפ</a>
          </div>
        </div>
      </section>

      <section className={styles.card + ' ' + layout.management}>
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
          <div className={styles.approvalsGrid + (visible.length <= 3 ? ' ' + layout.shortList : '')}>
            <ul className={styles.userList} aria-label="רשימת משתמשים">
              {visible.map(r => (
                <li key={r.key}>
                  <button type="button" className={styles.userRow + (selected?.key === r.key ? ' ' + styles.userRowOn : '')} aria-pressed={selected?.key === r.key} onClick={() => { setSelectedKey(r.key); setConfirming(null); }}>
                    <span className={styles.userAvatar} aria-hidden="true">{initial(r)}</span>
                    <span className={styles.userMain}>
                      <span className={styles.rowTitle}>{r.name || r.email}</span>
                      {r.name && <span dir="ltr" className={styles.rowMeta} style={{ textAlign: 'right' }}>{r.email}</span>}
                    </span>
                    <span className={styles.tag}>{STATUS_LABEL[r.kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <aside className={styles.userPanel + ' ' + layout.panel} aria-label="פרטי משתמש">
                <div className={layout.identityBlock}>
                <div className={styles.userPanelHead}>
                  <span className={styles.userAvatar + ' ' + styles.userAvatarBig} aria-hidden="true">{initial(selected)}</span>
                  <div className={styles.userMain}>
                    <div className={styles.rowTitle}>{selected.name || selected.email}</div>
                    {selected.name && <div dir="ltr" className={styles.rowMeta} style={{ textAlign: 'right' }}>{selected.email}</div>}
                  </div>
                </div>
                <div className={layout.facts}>
                  <div><div className={styles.statLabel}>סטטוס</div><div className={styles.rowTitle}>{STATUS_LABEL[selected.kind]}</div></div>
                  <div><div className={styles.statLabel}>נשלח</div><div className={styles.rowTitle}>{formatDate(selected.createdAt.slice(0, 10))}</div></div>
                </div>
                </div>
                <div className={layout.actionsBlock}>
                {confirming?.key === selected.key ? (
                  <div className={styles.userConfirm} role="alert">
                    <div className={styles.rowTitle}>{ACTIONS[confirming.action].confirm}</div>
                    <div className={styles.toolbar}>
                      <button type="button" className={styles.btn} onClick={() => run(selected, confirming.action)}>{ACTIONS[confirming.action].label}</button>
                      <button type="button" className={styles.btnGhost} onClick={() => setConfirming(null)}>חזרה</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(panelActions(selected).length > 0 || selected.kind === 'blocked' || selected.kind === 'trashed') && (
                      <>
                        <div className={styles.sectionLabel}>פעולות</div>
                        {panelActions(selected).map(a => (
                          <button key={a} type="button" className={styles.userAction} aria-label={ACTIONS[a].label + ': ' + selected.email} onClick={() => chooseAction(selected, a)}><span className={styles.rowTitle}>{ACTIONS[a].label}</span><span className={styles.rowMeta}>{actionHint[a]}</span></button>
                        ))}
                        {(selected.kind === 'blocked' || selected.kind === 'trashed') && (
                          <button type="button" className={styles.userAction} aria-label={(selected.kind === 'blocked' ? 'ביטול חסימה: ' : 'שחזור: ') + selected.email} onClick={() => restore(selected)}><span className={styles.rowTitle}>{selected.kind === 'blocked' ? 'ביטול חסימה' : 'שחזור'}</span><span className={styles.rowMeta}>{selected.kind === 'blocked' ? 'הלקוח יוכל להירשם שוב' : 'תישלח הזמנה חדשה ללקוח'}</span></button>
                        )}
                      </>
                    )}
                    {dangerActions(selected).length > 0 && (
                      <details key={selected.key} className={layout.danger}>
                        <summary>פעולות נוספות</summary>
                        {dangerActions(selected).map(a => (
                          <button key={a} type="button" className={styles.userAction + ' ' + styles.userActionDanger} aria-label={ACTIONS[a].label + ': ' + selected.email} onClick={() => chooseAction(selected, a)}><span className={styles.rowTitle}>{ACTIONS[a].label}</span><span className={styles.rowMeta}>{actionHint[a]}</span></button>
                        ))}
                      </details>
                    )}
                  </>
                )}
                </div>
              </aside>
            )}
          </div>
        )}
      </section>

      <Families advisorId={advisorId} links={links} />
    </div>
  );
}
