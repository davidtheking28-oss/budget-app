import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { BUSINESS_TYPES, financeSummary, percentLabel, ymKey, todayIso, num } from './bizMath.js';
import MonthPicker, { monthName } from './MonthPicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { fmt } from '../format.js';
import { toast } from '../toast.js';
import styles from './Business.module.css';

const VIEWS = [
  { key: 'month', label: 'חודשי' },
  { key: 'year', label: 'שנתי' },
  { key: 'all', label: 'מלא' }
];

const BUSINESS_TYPE_KEY = 'advisor_business_type';

function readBusinessType() {
  try { return localStorage.getItem(BUSINESS_TYPE_KEY) || BUSINESS_TYPES[0]; } catch { return BUSINESS_TYPES[0]; }
}

function SummaryStats({ s }) {
  return (
    <div className={styles.grid4}>
      <div className={styles.stat}><div className={styles.statLabel}>הכנסות</div><div className={styles.statValue}>{fmt(s.income)}</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>הוצאות</div><div className={styles.statValue}>{fmt(s.expense)}</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>רווח נטו משוער</div><div className={styles.statValue + ' ' + (s.net < 0 ? styles.statNeg : styles.statPos)}>{fmt(s.net)}</div><div className={styles.statNote}>אחוז רווחיות: {percentLabel(s.margin)}</div></div>
      <div className={styles.stat}><div className={styles.statLabel}>קבלות חסרות</div><div className={styles.statValue + (s.missingReceipts ? ' ' + styles.statNeg : '')}>{s.missingReceipts}</div><div className={styles.statNote}>הוצאות בלי קבלה</div></div>
    </div>
  );
}

function PeriodTable({ rows, labelHead }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>{labelHead}</th><th>הכנסות</th><th>הוצאות</th><th>רווח נטו</th><th>אחוז רווחיות</th><th>קבלות חסרות</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td><td className={styles.num}>{fmt(r.s.income)}</td><td className={styles.num}>{fmt(r.s.expense)}</td>
              <td className={styles.num + ' ' + (r.s.net < 0 ? styles.statNeg : '')}>{fmt(r.s.net)}</td><td className={styles.num}>{percentLabel(r.s.margin)}</td><td className={styles.num}>{r.s.missingReceipts || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EMPTY = { type: 'income', desc: '', amount: '', date: todayIso(), receipt: false };

export default function Finance({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'finance_entry');
  const now = new Date();
  const [view, setView] = useState('month');
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [businessType, setBusinessType] = useState(readBusinessType);
  const [form, setForm] = useState(EMPTY);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const entries = records.map(r => ({ id: r.id, period: r.period, ...r.data }));
  const inMonth = entries.filter(e => e.period === ymKey(ym.year, ym.month)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const inYear = entries.filter(e => e.period?.startsWith(String(ym.year)));
  const monthRows = Array.from({ length: 12 }, (_, i) => ({ label: monthName(i), s: financeSummary(inYear.filter(e => e.period === ymKey(ym.year, i))) }));
  const years = [...new Set(entries.map(e => e.period?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const yearRows = years.map(y => ({ label: y, s: financeSummary(entries.filter(e => e.period?.startsWith(y))) }));

  function pickBusinessType(value) {
    setBusinessType(value);
    try { localStorage.setItem(BUSINESS_TYPE_KEY, value); } catch { /* preference only */ }
  }

  async function submit(e) {
    e.preventDefault();
    const amount = num(form.amount);
    if (!(amount > 0)) { toast('הזן סכום תקין', 'error'); return; }
    if (!form.date) { toast('בחר תאריך', 'error'); return; }
    const row = await add({ type: form.type, desc: form.desc.trim(), amount, date: form.date, receipt: form.type === 'income' ? true : form.receipt }, form.date.slice(0, 7));
    if (row) setForm({ ...EMPTY, type: form.type, date: form.date });
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.pills} role="group" aria-label="תצוגה">
            {VIEWS.map(v => <button key={v.key} type="button" className={view === v.key ? styles.pillOn : styles.pill} aria-pressed={view === v.key} onClick={() => setView(v.key)}>{v.label}</button>)}
          </div>
          <label className={styles.toolbar}>סוג העסק
            <select className={styles.select} value={businessType} onChange={e => pickBusinessType(e.target.value)}>
              {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        {view !== 'all' && <MonthPicker year={ym.year} month={view === 'month' ? ym.month : null} onChange={(year, month) => setYm(prev => ({ year, month: month ?? prev.month }))} />}
      </section>

      {view === 'month' && (
        <>
          <SummaryStats s={financeSummary(inMonth)} />
          <section className={styles.card}>
            <div className={styles.cardHead}><h3 className={styles.cardTitle}>{monthName(ym.month)} {ym.year}</h3></div>
            <form className={styles.addForm} onSubmit={submit}>
              <select className={styles.select} aria-label="סוג" value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}>
                <option value="income">הכנסה</option>
                <option value="expense">הוצאה</option>
              </select>
              <input className={styles.input + ' ' + styles.inputGrow} placeholder="תיאור" aria-label="תיאור" value={form.desc} onChange={e => setForm(prev => ({ ...prev, desc: e.target.value }))} />
              <input className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="סכום" aria-label="סכום" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} />
              <input className={styles.input} type="date" aria-label="תאריך" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} />
              {form.type === 'expense' && <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={form.receipt} onChange={e => setForm(prev => ({ ...prev, receipt: e.target.checked }))} />יש קבלה</label>}
              <button type="submit" className={styles.btn}>הוסף</button>
            </form>
            {inMonth.length === 0 ? <div className={styles.empty}>עוד אין רשומות בחודש הזה</div> : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>תאריך</th><th>סוג</th><th>תיאור</th><th>סכום</th><th>קבלה</th><th /></tr></thead>
                  <tbody>
                    {inMonth.map(e => (
                      <tr key={e.id}>
                        <td className={styles.num}>{e.date}</td>
                        <td><span className={styles.tag}>{e.type === 'income' ? 'הכנסה' : 'הוצאה'}</span></td>
                        <td>{e.desc || '—'}</td>
                        <td className={styles.num + ' ' + (e.type === 'income' ? styles.statPos : styles.statNeg)}>{fmt(e.amount)}</td>
                        <td>{e.type === 'expense' ? <input type="checkbox" className={styles.check} aria-label={'יש קבלה: ' + (e.desc || e.date)} checked={!!e.receipt} onChange={ev => update(e.id, { receipt: ev.target.checked })} /> : '—'}</td>
                        <td><DeleteButton title="מחק רשומה" onClick={() => remove(e.id, 'הרשומה נמחקה')} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {view === 'year' && (
        <>
          <SummaryStats s={financeSummary(inYear)} />
          <section className={styles.card}><div className={styles.cardHead}><h3 className={styles.cardTitle}>חודש וחודש ב-{ym.year}</h3></div><PeriodTable rows={monthRows} labelHead="חודש" /></section>
        </>
      )}

      {view === 'all' && (
        <>
          <SummaryStats s={financeSummary(entries)} />
          <section className={styles.card}><div className={styles.cardHead}><h3 className={styles.cardTitle}>שנה אחרי שנה</h3></div>{yearRows.length ? <PeriodTable rows={yearRows} labelHead="שנה" /> : <div className={styles.empty}>עוד אין רשומות</div>}</section>
        </>
      )}
      <p className={styles.note}>הרווח הנטו הוא הערכה לפי הרשומות שהוזנו, לפני מס ולפני ניכויים.</p>
    </div>
  );
}
