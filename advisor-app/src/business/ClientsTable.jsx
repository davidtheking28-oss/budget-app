import { useRef, useState } from 'react';
import { useClientDeals } from './useClientDeals.js';
import { num } from './bizMath.js';
import HeaderAction from './HeaderAction.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { localISODate } from '../budget/monthUtils.js';
import { toast } from '../toast.js';
import styles from './Business.module.css';

const PAYMENT_STATUSES = [
  { key: 'unpaid', label: 'לא שולם', tone: 'pillBad' },
  { key: 'partial', label: 'שולם חלקית', tone: 'pillWarn' },
  { key: 'paid', label: 'שילם', tone: 'pillGood' }
];
const SERVICE_STATUSES = [
  { key: 'active', label: 'פעיל', tone: 'pillGood' },
  { key: 'frozen', label: 'בהקפאה', tone: 'pillWarn' },
  { key: 'ended', label: 'סיים', tone: '' }
];
const PAYMENT_METHODS = ['העברה בנקאית', 'אשראי', 'ביט', 'צ׳ק', 'מזומן', 'תשלומים'];
const SOURCES = ['דף נחיתה', 'הודעות בפרטי', 'פה לאוזן · לקוח ישן', 'המלצה', 'אינסטגרם'];
const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

function formatDay(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const CLIENT_APP_URL = 'https://davidtheking28-oss.github.io/budget-app/';
const SIGNUP_MESSAGE = 'היי, הנה הקישור להרשמה לפלטפורמה שלנו: ' + CLIENT_APP_URL + ' . אחרי ההרשמה אזמין אותך מהמערכת שלי.';

async function copySignupLink() {
  try {
    await navigator.clipboard.writeText(SIGNUP_MESSAGE);
    toast('הקישור הועתק, אפשר להדביק ללקוח', 'success');
  } catch {
    window.prompt('העתק את ההודעה ושלח ללקוח:', SIGNUP_MESSAGE);
  }
}

export default function ClientsTable({ advisorId, onAdd, onOpen, onRemove }) {
  const { rows, loading, error, reload, saveDeal, saveContact } = useClientDeals(advisorId);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [confirmingId, setConfirmingId] = useState(null);
  const tableRef = useRef(null);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const monthPrefix = localISODate().slice(0, 7);
  const statusOf = r => r.deal?.service_status || 'active';
  const payOf = r => r.deal?.payment_status || 'unpaid';
  const label = r => r.name || r.client_email;
  const sortValue = {
    name: r => (r.name || r.client_email || '').toLocaleLowerCase('he'),
    created_at: r => r.created_at || '',
    ends_at: r => r.deal?.ends_at || '9999',
    price: r => num(r.deal?.price)
  };
  const visible = rows
    .filter(r => !status || statusOf(r) === status)
    .filter(r => !search.trim() || [r.name, r.client_email, r.phone].some(v => (v || '').includes(search.trim())))
    .sort((a, b) => {
      if (!sort.key) return 0;
      const av = sortValue[sort.key](a);
      const bv = sortValue[sort.key](b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  const activeCount = rows.filter(r => statusOf(r) === 'active').length;
  const newThisMonth = rows.filter(r => (r.created_at || '').startsWith(monthPrefix)).length;
  const endedCount = rows.filter(r => statusOf(r) === 'ended').length;

  const toggleSort = key => setSort(prev => prev.key === key ? { key, dir: -prev.dir } : { key, dir: 1 });
  const sortHead = (key, text) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={styles.sortBtn} onClick={() => toggleSort(key)}>{text}<span className={styles.sortMark} aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}</span></button>
    </th>
  );
  const focusName = id => tableRef.current?.querySelector(`input[data-name-of="${id}"]`)?.focus();

  return (
    <div className={styles.stack}>
      <HeaderAction targetId="biz-header-sub" fallback={false}><p className={styles.headSub}>{rows.length} לקוחות במערכת</p></HeaderAction>
      <section className={styles.bigCard} role="group" aria-label="סיכום לקוחות">
        <div className={styles.grid3 + ' ' + styles.cellGrid}>
          <div className={styles.cell}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true"><svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M16 5a3.5 3.5 0 0 1 0 6.5M21.5 20c0-2.8-1.6-4.7-4-5.4" /></svg></span><span className={styles.statLabel}>לקוחות פעילים</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 28 }}>{activeCount}</div>
            <div className={styles.statNote}>בתהליך ליווי כרגע</div>
          </div>
          <div className={styles.cell}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true"><svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M19 8v6M16 11h6" /></svg></span><span className={styles.statLabel}>לקוחות חדשים החודש</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 28 }}>{newThisMonth}</div>
            <div className={styles.statNote}>לפי תאריך הצטרפות</div>
          </div>
          <div className={styles.cell}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true"><svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg></span><span className={styles.statLabel}>לקוחות שסיימו</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 28 }}>{endedCount}</div>
            <div className={styles.statNote}>סיימו את התהליך</div>
          </div>
        </div>
      </section>

      <div className={styles.toolbar}>
        <h2 className={styles.sectionHeading}>כל הלקוחות</h2>
        <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש לפי שם, טלפון או אימייל..." aria-label="חיפוש לקוח" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} aria-label="סינון לפי סטטוס" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {SERVICE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button type="button" className={styles.btnGhost} onClick={copySignupLink}>שלח קישור הרשמה</button>
        <button type="button" className={styles.btn} onClick={onAdd}>הוסף לקוח +</button>
      </div>
      <p className={styles.note} style={{ margin: 0 }}>אפשר לשנות כל פרט ישירות בטבלה. פרטי העסקה נשמרים אצלך בלבד והלקוח לא רואה אותם.</p>

      <section className={styles.card}>
        {visible.length === 0 ? <div className={styles.emptyState}><span>אין לקוחות בתצוגה הזו</span></div> : (
          <div className={styles.tableWrap} ref={tableRef}>
            <table className={styles.table + ' ' + styles.denseTable}>
              <thead>
                <tr>
                  {sortHead('name', 'שם מלא')}
                  <th>טלפון</th>
                  <th>אימייל</th>
                  {sortHead('created_at', 'הצטרפות')}
                  {sortHead('ends_at', 'סיום')}
                  {sortHead('price', 'מחיר העסקה')}
                  <th>שילם</th>
                  <th>אמצעי תשלום</th>
                  <th>קבלה</th>
                  <th>מקור</th>
                  <th>סטטוס</th>
                  <th><span className={styles.srOnly}>פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  const pay = PAYMENT_STATUSES.find(p => p.key === payOf(r));
                  const svc = SERVICE_STATUSES.find(s => s.key === statusOf(r));
                  return (
                    <tr key={r.id}>
                      <td><input className={styles.input + ' ' + styles.ghostField + ' ' + styles.nameCell} style={{ minWidth: 130 }} data-name-of={r.id} aria-label={'שם: ' + label(r)} defaultValue={r.name || ''} onBlur={e => { if (e.target.value.trim() !== (r.name || '')) saveContact(r, { name: e.target.value.trim() || null }); }} /></td>
                      <td><input className={styles.input + ' ' + styles.ghostField} dir="ltr" style={{ width: 118 }} aria-label={'טלפון: ' + label(r)} defaultValue={r.phone || ''} onBlur={e => { if (e.target.value.trim() !== (r.phone || '')) saveContact(r, { phone: e.target.value.trim() || null }); }} /></td>
                      <td dir="ltr" className={styles.rowMeta + ' ' + styles.emailCell} title={r.client_email}>{r.client_email}</td>
                      <td className={styles.num}>{formatDay(r.created_at)}</td>
                      <td><input className={styles.input + ' ' + styles.ghostField} type="date" aria-label={'תאריך סיום: ' + label(r)} value={r.deal?.ends_at || ''} onChange={e => saveDeal(r, { ends_at: e.target.value || null })} /></td>
                      <td><input className={styles.input + ' ' + styles.ghostField + ' ' + styles.numInput} style={{ width: 96 }} inputMode="decimal" placeholder="₪" aria-label={'מחיר העסקה: ' + label(r)} defaultValue={r.deal?.price ?? ''} onBlur={e => { const v = e.target.value.trim(); if (v !== String(r.deal?.price ?? '')) saveDeal(r, { price: v === '' ? null : Math.max(0, num(v)) }); }} /></td>
                      <td>
                        <select className={styles.pillSelect + ' ' + styles[pay.tone]} aria-label={'סטטוס תשלום: ' + label(r)} value={pay.key} onChange={e => saveDeal(r, { payment_status: e.target.value })}>
                          {PAYMENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className={styles.select + ' ' + styles.ghostField} aria-label={'אמצעי תשלום: ' + label(r)} value={r.deal?.payment_method || ''} onChange={e => saveDeal(r, { payment_method: e.target.value || null })}>
                          <option value="">—</option>
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td>
                        <button type="button" className={styles.pillBtn + ' ' + (r.deal?.receipt_issued ? styles.pillGood : styles.pillWarn)} aria-pressed={!!r.deal?.receipt_issued} aria-label={'קבלה: ' + label(r)} onClick={() => saveDeal(r, { receipt_issued: !r.deal?.receipt_issued })}>{r.deal?.receipt_issued ? 'הונפקה' : 'לא בוצע'}</button>
                      </td>
                      <td>
                        <select className={styles.select + ' ' + styles.ghostField} aria-label={'מקור: ' + label(r)} value={r.deal?.source || ''} onChange={e => saveDeal(r, { source: e.target.value || null })}>
                          <option value="">—</option>
                          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className={styles.pillSelect + (svc.tone ? ' ' + styles[svc.tone] : '')} aria-label={'סטטוס לקוח: ' + label(r)} value={svc.key} onChange={e => saveDeal(r, { service_status: e.target.value })}>
                          {SERVICE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className={styles.toolbar} style={{ flexWrap: 'nowrap' }}>
                          {confirmingId === r.id ? (
                            <>
                              <button type="button" className={styles.btnGhost} onClick={() => { setConfirmingId(null); onRemove(r.id).then(reload); }}>לאשר ניתוק?</button>
                              <button type="button" className={styles.btnGhost} onClick={() => setConfirmingId(null)}>ביטול</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className={styles.iconBtn} aria-label={'נתק לקוח: ' + label(r)} title="נתק לקוח" onClick={() => setConfirmingId(r.id)}><svg {...svgProps}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></button>
                              <button type="button" className={styles.iconBtn} aria-label={'עריכת פרטים: ' + label(r)} title="עריכה" onClick={() => focusName(r.id)}><svg {...svgProps}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg></button>
                              <button type="button" className={styles.iconBtn} aria-label={'פתח כרטיס לקוח: ' + label(r)} title="פתח כרטיס" onClick={() => onOpen(r)}><svg {...svgProps}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
