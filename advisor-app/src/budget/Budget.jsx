import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { BUDGET_CATS } from '../categories.js';
import Skeleton from '../components/Skeleton.jsx';
import { toast } from '../toast.js';
import styles from './Budget.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Budget({ clientUserId, advisorId, year, month }) {
  const { data, loading, save } = useClientBudget(clientUserId, advisorId);
  const [cat, setCat] = useState(BUDGET_CATS[0]);
  const [limit, setLimit] = useState('');

  if (loading || !data) {
    return (
      <div>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="72px" radius="14px" />
      </div>
    );
  }

  const budgets = data.budgets || {};
  const monthTx = getMonthTx(data.transactions, year, month);
  const spentByCat = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });

  async function setBudget() {
    const amt = parseFloat(limit);
    if (!amt || amt <= 0) return;
    await save({ budgets: { ...budgets, [cat]: amt } });
    toast('תקציב עודכן', 'success');
    setLimit('');
  }

  const activeCats = Object.keys(budgets).filter(c => budgets[c]).sort();

  return (
    <div>
      <div className={styles.form}>
        <select className={styles.select} value={cat} onChange={e => setCat(e.target.value)}>
          {BUDGET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} type="number" placeholder="תקרה חודשית" value={limit} onChange={e => setLimit(e.target.value)} onKeyDown={e => e.key === 'Enter' && setBudget()} />
        <button className={styles.button} onClick={setBudget}>שמור תקציב</button>
      </div>
      {!activeCats.length && <div className={styles.empty}>עדיין לא הוגדרו תקציבי קטגוריה</div>}
      <div className={styles.list}>
        {activeCats.map((c, i) => {
          const s = spentByCat[c] || 0;
          const l = budgets[c];
          const pct = Math.min(Math.round((s / l) * 100), 100);
          const over = s > l;
          const color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
          return (
            <div key={c} className={styles.item + (over ? ' ' + styles.itemOver : '')} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
              <div className={styles.itemTop}>
                <span>{c}</span>
                <span>{fmt(s)} / {fmt(l)}</span>
              </div>
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: pct + '%', background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
