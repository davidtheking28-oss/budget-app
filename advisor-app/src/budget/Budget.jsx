import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { BUDGET_CATS } from '../categories.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import styles from './Budget.module.css';

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');

export default function Budget({ clientUserId, advisorId, year, month }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [cat, setCat] = useState(BUDGET_CATS[0]);
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [incName, setIncName] = useState('');
  const [incAmount, setIncAmount] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="72px" radius="14px" />
      </div>
    );
  }

  const budgets = data.budgets || {};
  const incomeSources = data.settings?.incomeSources || [];
  const monthTx = getMonthTx(data.transactions, year, month);
  const spentByCat = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });

  async function addIncomeSource() {
    const amt = parseFloat(incAmount);
    if (!incName.trim() || !amt || amt <= 0) { toast('הזן שם וסכום תקינים', 'error'); return; }
    await save(cur => ({ settings: { ...(cur.settings || {}), incomeSources: [...(cur.settings?.incomeSources || []), { name: incName.trim(), amount: amt }] } }));
    toast('מקור הכנסה נוסף', 'success');
    setIncName('');
    setIncAmount('');
  }

  async function removeIncomeSource(i) {
    await save(cur => ({ settings: { ...(cur.settings || {}), incomeSources: (cur.settings?.incomeSources || []).filter((_, idx) => idx !== i) } }));
    toast('מקור הכנסה הוסר', 'success');
  }

  async function setBudget() {
    const amt = parseFloat(limit);
    if (!amt || amt <= 0) { toast('הזן תקרה תקינה', 'error'); return; }
    setSaving(true);
    await save(cur => ({ budgets: { ...(cur.budgets || {}), [cat]: amt } }));
    setSaving(false);
    toast('תקציב עודכן', 'success');
    setLimit('');
  }

  async function removeBudget(c) {
    let removedValue;
    await save(cur => {
      const rest = { ...(cur.budgets || {}) };
      removedValue = rest[c];
      delete rest[c];
      return { budgets: rest };
    });
    toast(`תקציב ${c} הוסר`, 'success', { label: 'בטל', onClick: () => save(cur => ({ budgets: { ...(cur.budgets || {}), [c]: removedValue } })) });
  }

  const activeCats = Object.keys(budgets).filter(c => budgets[c]).sort();
  const overCount = activeCats.filter(c => (spentByCat[c] || 0) > budgets[c]).length;

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>מקורות הכנסה קבועים</div>
        {incomeSources.length > 0 && (
          <div className={styles.list}>
            {incomeSources.map((src, i) => (
              <div key={i} className={styles.row}>
                <div className={styles.name}>{src.name}</div>
                <div className={styles.rowActions}>
                  <span>{fmt(src.amount)}</span>
                  <DeleteButton onClick={() => removeIncomeSource(i)} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם מקור ההכנסה" value={incName} onChange={e => setIncName(e.target.value)} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום חודשי" value={incAmount} onChange={e => setIncAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addIncomeSource()} />
          <Button onClick={addIncomeSource}>הוסף מקור הכנסה</Button>
        </div>
        <div className={styles.meta}>משמש כברירת מחדל להכנסת החודש כשאין עדיין תנועות הכנסה רשומות.</div>
      </div>
      {activeCats.length > 0 && (
        <div className={styles.rollup + ' ' + (overCount > 0 ? styles.rollupWarn : styles.rollupOk)}>
          {overCount > 0 ? `${overCount} מתוך ${activeCats.length} קטגוריות בחריגה` : `כל ${activeCats.length} הקטגוריות בתקציב`}
        </div>
      )}
      <div className={styles.form}>
        <select className={styles.select} aria-label="קטגוריה" value={cat} onChange={e => setCat(e.target.value)}>
          {BUDGET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} type="number" inputMode="decimal" aria-label="תקרה חודשית" placeholder="תקרה חודשית" value={limit} onChange={e => setLimit(e.target.value)} onKeyDown={e => e.key === 'Enter' && setBudget()} />
        <Button onClick={setBudget} disabled={saving}>שמור תקציב</Button>
      </div>
      {!activeCats.length && (
        <div className={styles.empty}>
          <div className={styles.emptyMark}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="12" cy="12" r="0.8" fill="currentColor" />
            </svg>
          </div>
          עדיין לא הוגדרו תקציבי קטגוריה
        </div>
      )}
      <div className={styles.grid}>
        {activeCats.map((c, i) => {
          const s = spentByCat[c] || 0;
          const l = budgets[c];
          const pct = Math.min(Math.round((s / l) * 100), 100);
          const over = s > l;
          const color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
          return (
            <div key={c} className={styles.item + (over ? ' ' + styles.itemOver : '')} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
              <div className={styles.itemTop}>
                <span className={styles.catLabel}>{getCategoryIcon(c)}{c}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>{fmt(s)} / {fmt(l)}</span>
                  <DeleteButton title="הסר תקציב" onClick={() => removeBudget(c)} />
                </div>
              </div>
              <div className={styles.bar}>
                <div className={styles.fill} style={{ transform: `scaleX(${pct / 100})`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
