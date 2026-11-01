import { useState } from 'react';
import { useClientBudget } from '../budget/useClientBudget.js';
import MonthTransactions from '../budget/MonthTransactions.jsx';
import Donut, { donutSlices } from '../components/Donut.jsx';
import MonthNav from '../components/MonthNav.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { addMonths, getMonthTx, localISODate } from '../budget/monthUtils.js';
import { addItem } from '../budget/itemHelpers.js';
import { budgetCatsFor } from '../categories.js';
import { toast } from '../toast.js';
import { fmt } from '../format.js';
import styles from './Business.module.css';

const MODE = 'personal';

export default function PersonalExpenses({ userId }) {
  const { data, loading, error, reload, save } = useClientBudget(userId, userId);
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', cat: budgetCatsFor(MODE)[0], date: localISODate(now), desc: '' });
  const [saving, setSaving] = useState(false);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) return <Skeleton height="220px" radius="18px" />;

  const month = getMonthTx(data.transactions, ym.year, ym.month);
  const spent = month.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const income = month.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const byCat = {};
  for (const t of month) if (t.type === 'expense') byCat[t.cat || 'שונות'] = (byCat[t.cat || 'שונות'] || 0) + (Number(t.amount) || 0);

  async function submit(e) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast('הזן סכום תקין', 'error'); return; }
    if (!form.date) { toast('בחר תאריך', 'error'); return; }
    setSaving(true);
    const ok = await addItem(save, 'transactions', { type: 'expense', cat: form.cat, desc: form.desc.trim() || form.cat, amount, date: form.date });
    setSaving(false);
    if (!ok) return;
    toast('ההוצאה נשמרה', 'success');
    setForm(f => ({ ...f, amount: '', desc: '' }));
    setOpen(false);
  }

  const changeMonth = delta => setYm(prev => addMonths(prev.year, prev.month, delta));

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
        <MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={() => setYm({ year: now.getFullYear(), month: now.getMonth() })} />
        <button type="button" className={styles.btn} aria-expanded={open} onClick={() => setOpen(v => !v)}>+ הוספת הוצאה</button>
      </div>

      {open && (
        <form className={styles.card} onSubmit={submit} aria-label="הוספת הוצאה">
          <div className={styles.cardHead}><h2 className={styles.cardTitle}>הוספת הוצאה</h2></div>
          <div className={styles.grid2}>
            <label className={styles.fieldLabel}>סכום (₪)
              <input className={styles.input} type="number" inputMode="decimal" min="0" step="any" autoFocus value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </label>
            <label className={styles.fieldLabel}>קטגוריה
              <select className={styles.select} value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))}>
                {budgetCatsFor(MODE).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>תאריך
              <input className={styles.input} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </label>
            <label className={styles.fieldLabel}>פירוט (לא חובה)
              <input className={styles.input} value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="למשל: קניות לשבת" />
            </label>
          </div>
          <div className={styles.toolbar} style={{ marginTop: 'var(--space-3)' }}>
            <button type="submit" className={styles.btn} disabled={saving}>{saving ? 'שומר...' : 'שמירת הוצאה'}</button>
            <button type="button" className={styles.btnGhost} onClick={() => setOpen(false)}>ביטול</button>
          </div>
        </form>
      )}

      <section className={styles.card}>
        <div className={styles.grid3}>
          <div className={styles.stat}><div className={styles.statLabel}>הוצאות החודש</div><div className={styles.statValue}>{fmt(spent)}</div></div>
          <div className={styles.stat}><div className={styles.statLabel}>הכנסות החודש</div><div className={styles.statValue}>{fmt(income)}</div></div>
          <div className={styles.stat}><div className={styles.statLabel}>יתרה לחודש</div><div className={styles.statValue}>{fmt(income - spent)}</div></div>
        </div>
      </section>

      {Object.keys(byCat).length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}><h2 className={styles.cardTitle}>לאן הולך הכסף</h2></div>
          <Donut items={donutSlices(byCat, 6)} title="הוצאות לפי קטגוריה" />
        </section>
      )}

      <MonthTransactions data={data} save={save} mode={MODE} year={ym.year} month={ym.month} />
    </div>
  );
}
