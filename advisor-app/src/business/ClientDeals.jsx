import { useState } from 'react';
import { useClientDeals } from './useClientDeals.js';
import { num } from './bizMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { fmt } from '../format.js';
import styles from './Business.module.css';

const PAYMENT_STATUSES = [
  { key: 'unpaid', label: 'לא שולם' },
  { key: 'partial', label: 'שולם חלקית' },
  { key: 'paid', label: 'שולם' }
];
const PAYMENT_METHODS = ['העברה בנקאית', 'כרטיס אשראי', 'ביט', 'מזומן', 'צ׳ק'];
const SOURCES = ['דף נחיתה', 'הודעות בפרטי', 'פה לאוזן · לקוח ישן', 'המלצה'];

function formatDay(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function ClientDeals({ advisorId }) {
  const { rows, loading, error, reload, saveDeal, saveContact } = useClientDeals(advisorId);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const statusOf = r => r.deal?.payment_status || 'unpaid';
  const visible = rows
    .filter(r => !status || statusOf(r) === status)
    .filter(r => !search.trim() || [r.name, r.client_email, r.phone].some(v => (v || '').includes(search.trim())));
  const totalPrice = rows.reduce((s, r) => s + num(r.deal?.price), 0);
  const paidCount = rows.filter(r => statusOf(r) === 'paid').length;
  const missingReceipts = rows.filter(r => num(r.deal?.price) > 0 && !r.deal?.receipt_issued).length;
  const label = r => r.name || r.client_email;

  return (
    <div className={styles.stack}>
      <div className={styles.grid3}>
        <div className={styles.stat}><div className={styles.statLabel}>סך העסקאות</div><div className={styles.statValue}>{fmt(totalPrice)}</div><div className={styles.statNote}>{rows.length} לקוחות</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>שילמו במלואם</div><div className={styles.statValue}>{paidCount}</div><div className={styles.statNote}>מתוך {rows.length} לקוחות</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>קבלות שחסרות</div><div className={styles.statValue + (missingReceipts ? ' ' + styles.statNeg : '')}>{missingReceipts}</div><div className={styles.statNote}>עסקאות בלי קבלה</div></div>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש לפי שם, טלפון או אימייל..." aria-label="חיפוש לקוח" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} aria-label="סטטוס תשלום" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {PAYMENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <p className={styles.note} style={{ margin: 0 }}>אפשר לשנות כל פרט ישירות בטבלה. פרטי העסקה נשמרים אצלך בלבד והלקוח לא רואה אותם.</p>

      <section className={styles.card}>
        {visible.length === 0 ? <div className={styles.emptyState}><span>אין לקוחות בתצוגה הזו</span></div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>שם מלא</th><th>טלפון</th><th>אימייל</th><th>הצטרפות</th><th>סיום</th><th>מחיר העסקה</th><th>תשלום</th><th>אמצעי תשלום</th><th>קבלה</th><th>מקור</th></tr></thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.id}>
                    <td><input className={styles.input} style={{ minWidth: 150 }} aria-label={'שם: ' + label(r)} defaultValue={r.name || ''} onBlur={e => { if (e.target.value.trim() !== (r.name || '')) saveContact(r, { name: e.target.value.trim() || null }); }} /></td>
                    <td><input className={styles.input} dir="ltr" style={{ width: 130 }} aria-label={'טלפון: ' + label(r)} defaultValue={r.phone || ''} onBlur={e => { if (e.target.value.trim() !== (r.phone || '')) saveContact(r, { phone: e.target.value.trim() || null }); }} /></td>
                    <td dir="ltr" className={styles.rowMeta}>{r.client_email}</td>
                    <td className={styles.num}>{formatDay(r.created_at)}</td>
                    <td><input className={styles.input} type="date" aria-label={'תאריך סיום: ' + label(r)} value={r.deal?.ends_at || ''} onChange={e => saveDeal(r, { ends_at: e.target.value || null })} /></td>
                    <td><input className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="₪" aria-label={'מחיר העסקה: ' + label(r)} defaultValue={r.deal?.price ?? ''} onBlur={e => { const v = e.target.value.trim(); if (v !== String(r.deal?.price ?? '')) saveDeal(r, { price: v === '' ? null : Math.max(0, num(v)) }); }} /></td>
                    <td>
                      <select className={styles.select} aria-label={'סטטוס תשלום: ' + label(r)} value={statusOf(r)} onChange={e => saveDeal(r, { payment_status: e.target.value })}>
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
