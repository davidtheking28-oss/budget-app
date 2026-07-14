import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { BUDGET_CATS } from '../categories.js';
import styles from './Budget.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Budget({ clientUserId }) {
  const { data, loading, save } = useClientBudget(clientUserId);
  const [cat, setCat] = useState(BUDGET_CATS[0]);
  const [limit, setLimit] = useState('');

  if (loading || !data) return null;

  const budgets = data.budgets || {};
  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth());
  const spentByCat = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });

  async function setBudget() {
    const amt = parseFloat(limit);
    if (!amt || amt <= 0) return;
    await save({ budgets: { ...budgets, [cat]: amt } });
    setLimit('');
  }

  const activeCats = Object.keys(budgets).filter(c => budgets[c]).sort();

  return (
    <div>
      <div className={styles.form}>
        <select className={styles.select} value={cat} onChange={e => setCat(e.target.value)}>
          {BUDGET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} type="number" placeholder="תקרה חודשית" value={limit} onChange={e => setLimit(e.target.value)} />
        <button className={styles.button} onClick={setBudget}>שמור תקציב</button>
      </div>
      <div className={styles.list}>
        {activeCats.map(c => {
          const s = spentByCat[c] || 0;
          const l = budgets[c];
          const pct = Math.min(Math.round((s / l) * 100), 100);
          const color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
          return (
            <div key={c} className={styles.item}>
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
