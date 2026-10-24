import { useState } from 'react';
import { useClientDeals } from './useClientDeals.js';
import { num } from './bizMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { localISODate } from '../budget/monthUtils.js';
import styles from './Business.module.css';

const PAYMENT_STATUSES = [
  { key: 'unpaid', label: 'לא שולם' },
  { key: 'partial', label: 'שולם חלקית' },
  { key: 'paid', label: 'שולם' }
];
const PAYMENT_METHODS = ['העברה בנקאית', 'כרטיס אשראי', 'ביט', 'מזומן', 'צ׳ק'];
const SOURCES = ['דף נחיתה', 'הודעות בפרטי', 'פה לאוזן · לקוח ישן', 'המלצה'];
const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

function formatDay(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function ClientsTable({ advisorId, onAdd, onOpen, onRemove }) {
  const { rows, loading, error, reload, saveDeal, saveContact } = useClientDeals(advisorId);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const today = localISODate();
  const monthPrefix = today.slice(0, 7);
  const ended = r => !!r.deal?.ends_at && r.deal.ends_at < today;
  const payOf = r => r.deal?.payment_status || 'unpaid';
  const visible = rows
    .filter(r => !status || (status === 'active' ? !ended(r) : ended(r)))
    .filter(r => !search.trim() || [r.name, r.client_email, r.phone].some(v => (v || '').includes(search.trim())));
  const activeCount = rows.filter(r => !ended(r)).length;
  const newThisMonth = rows.filter(r => (r.created_at || '').startsWith(monthPrefix)).length;
  const endedCount = rows.length - activeCount;
  const label = r => r.name || r.client_email;

  return (
    <div className={styles.stack}>
      <section className={styles.bigCard} role="group" aria-label="סיכום לקוחות">
        <div className={styles.grid3 + ' ' + styles.cellGrid}>
          <div className={styles.cell}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true"><svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M16 5a3.5 3.5 0 0 1 0 6.5M21.5 20c0-2.8-1.6-4.7-4-5.4" /></svg></span><span className={styles.statLabel}>לקוחות פעילים</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 36 }}>{activeCount}</div>
            <div className={styles.statNote}>בתהליך ליווי כרגע</div>
          </div>
          <div className={styles.cell}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true"><svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M19 8v6M16 11h6" /></svg></span><span className={styles.statLabel}>לקוחות חדשים החודש</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 36 }}>{newThisMonth}</div>
            <div className={styles.statNote}>לפי תאריך הצטרפות</div>
          </div>
          <div className={styles.cell}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true"><svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg></span><span className={styles.statLabel}>לקוחות שסיימו</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 36 }}>{endedCount}</div>
            <div className={styles.statNote}>סיימו את התהליך</div>
          </div>
        </div>
      </section>

      <div className={styles.toolbar}>
        <h2 className={styles.sectionHeading}>כל הלקוחות</h2>
        <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש לפי שם, טלפון או אימייל..." aria-label="חיפוש לקוח" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} aria-label="סינון לפי סטטוס" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="ended">סיים</option>
        </select>
        <button type="button" className={styles.btn} onClick={onAdd}>הוסף לקוח +</button>
      </div>
      <p className={styles.note} style={{ margin: 0 }}>אפשר לשנות כל פרט ישירות בטבלה. פרטי העסקה נשמרים אצלך בלבד והלקוח לא רואה אותם.</p>

      <section className={styles.card}>
        {visible.length === 0 ? <div className={styles.emptyState}><span>אין לקוחות בתצוגה הזו</span></div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table + ' ' + styles.denseTable}>
              <thead><tr><th>שם מלא</th><th>טלפון</th><th>אימייל</th><th>הצטרפות</th><th>סיום</th><th>מחיר העסקה</th><th>שילם</th><th>אמצעי תשלום</th><th>קבלה</th><th>מקור</th><th>סטטוס</th><th><span className={styles.srOnly}>פעולות</span></th></tr></thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.id}>
                    <td><input className={styles.input} style={{ minWidth: 130 }} aria-label={'שם: ' + label(r)} defaultValue={r.name || ''} onBlur={e => { if (e.target.value.trim() !== (r.name || '')) saveContact(r, { name: e.target.value.trim() || null }); }} /></td>
                    <td><input className={styles.input} dir="ltr" style={{ width: 118 }} aria-label={'טלפון: ' + label(r)} defaultValue={r.phone || ''} onBlur={e => { if (e.target.value.trim() !== (r.phone || '')) saveContact(r, { phone: e.target.value.trim() || null }); }} /></td>
                    <td dir="ltr" className={styles.rowMeta + ' ' + styles.emailCell} title={r.client_email}>{r.client_email}</td>
                    <td className={styles.num}>{formatDay(r.created_at)}</td>
                    <td><input className={styles.input} type="date" aria-label={'תאריך סיום: ' + label(r)} value={r.deal?.ends_at || ''} onChange={e => saveDeal(r, { ends_at: e.target.value || null })} /></td>
                    <td><input className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="₪" aria-label={'מחיר העסקה: ' + label(r)} defaultValue={r.deal?.price ?? ''} onBlur={e => { const v = e.target.value.trim(); if (v !== String(r.deal?.price ?? '')) saveDeal(r, { price: v === '' ? null : Math.max(0, num(v)) }); }} /></td>
                    <td>
                      <select className={styles.select} aria-label={'סטטוס תשלום: ' + label(r)} value={payOf(r)} onChange={e => saveDeal(r, { payment_status: e.target.value })}>
                        {PAYMENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className={styles.select} aria-label={'אמצעי תשלום: ' + label(r)} value={r.deal?.payment_method || ''} onChange={e => saveDeal(r, { payment_method: e.target.value || null })}>
                        <option value="">—</option>
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" className={styles.check} aria-label={'קבלה הונפקה: ' + label(r)} checked={!!r.deal?.receipt_issued} onChange={e => saveDeal(r, { receipt_issued: e.target.checked })} /></td>
                    <td>
                      <select className={styles.select} aria-label={'מקור: ' + label(r)} value={r.deal?.source || ''} onChange={e => saveDeal(r, { source: e.target.value || null })}>
                        <option value="">—</option>
                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><span className={styles.tag + (ended(r) ? '' : ' ' + styles.tagOk)}>{ended(r) ? 'סיים' : 'פעיל'}</span></td>
                    <td>
                      <div className={styles.toolbar} style={{ flexWrap: 'nowrap' }}>
                        <button type="button" className={styles.iconBtn} aria-label={'פתח כרטיס לקוח: ' + label(r)} title="פתח כרטיס" onClick={() => onOpen(r)}><svg {...svgProps}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></button>
                        {confirmingId === r.id ? (
                          <>
                            <button type="button" className={styles.btnGhost} onClick={() => { setConfirmingId(null); onRemove(r.id).then(reload); }}>לאשר ניתוק?</button>
                            <button type="button" className={styles.btnGhost} onClick={() => setConfirmingId(null)}>ביטול</button>
                          </>
                        ) : (
                          <button type="button" className={styles.iconBtn} aria-label={'נתק לקוח: ' + label(r)} title="נתק לקוח" onClick={() => setConfirmingId(r.id)}><svg {...svgProps}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></button>
                        )}
                      </div>
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
