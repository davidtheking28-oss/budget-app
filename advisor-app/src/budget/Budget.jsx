import { useContext, useState } from 'react';
import { useClientBudget, BudgetModeContext } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { effectiveLimit } from './budgetMath.js';
import { BUDGET_CATS, budgetCatsFor } from '../categories.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import BudgetWizard from './BudgetWizard.jsx';
import styles from './Budget.module.css';

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');
const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const CALENDAR_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
  </svg>
);

export default function Budget({ clientUserId, advisorId, year, month, onSelectMonth }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const mode = useContext(BudgetModeContext);
  const [cat, setCat] = useState(BUDGET_CATS[0]);
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

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

  async function setBudget() {
    const amt = parseFloat(limit);
    if (!amt || amt <= 0) { toast('הזן תקרה תקינה', 'error'); return; }
    setSaving(true);
    await save(cur => ({ budgets: { ...(cur.budgets || {}), [selectedCat]: amt } }));
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
  // the client can define custom categories (settings.customCats), so offer those too
  // instead of only the built-in list — otherwise the advisor can't budget for them
  const selectableCats = [...new Set([
    ...budgetCatsFor(mode),
    ...(data?.settings?.customCats || []),
    ...Object.keys(budgets),
  ])];
  // `cat` may still hold the other mode's category after a toggle — fall back rather than
  // leaving the select on a value that doesn't exist in this mode
  const selectedCat = selectableCats.includes(cat) ? cat : selectableCats[0];
  const limitOf = c => effectiveLimit(data, c, year, month);
  const overCount = activeCats.filter(c => (spentByCat[c] || 0) > limitOf(c)).length;

  if (wizardOpen) {
    return <BudgetWizard data={data} save={save} onClose={() => setWizardOpen(false)} />;
  }

  const monthlyIncome = incomeSources.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const totalBudgeted = activeCats.reduce((s, c) => s + limitOf(c), 0);
  const totalSpent = activeCats.reduce((s, c) => s + (spentByCat[c] || 0), 0);
  const flow = monthlyIncome - totalSpent;

  return (
    <div>
      {onSelectMonth && (
        <div className={styles.monthTabs}>
          {MONTH_NAMES.map((name, i) => (
            <button
              key={i}
              type="button"
              className={styles.monthTab + (i === month ? ' ' + styles.monthTabActive : '')}
              onClick={() => onSelectMonth(i)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className={styles.brandHeader}>
        <div className={styles.brandHeaderLeft}>
          <span className={styles.brandIcon} aria-hidden="true">{CALENDAR_ICON}</span>
          <div>
            <div className={styles.brandTitle}>תקציב {MONTH_NAMES[month]}</div>
            <div className={styles.brandSub}>תכנון מול ביצוע בפועל</div>
          </div>
        </div>
        <div className={styles.yearBadge}>שנה: {year}</div>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>סך הכל הכנסות</div>
          <div className={styles.kpiValue}>{fmt(monthlyIncome)}</div>
          <div className={styles.kpiSub}>{incomeSources.length ? `${incomeSources.length} מקורות` : 'מקורות ההכנסה מנוהלים בתזרים'}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>סך הכל הוצאות</div>
          <div className={styles.kpiValue}>{fmt(totalSpent)}</div>
          <div className={styles.kpiSub}>{totalBudgeted > 0 ? `מתוך ${fmt(totalBudgeted)} מתוקצב` : 'אין תקציב מוגדר'}</div>
        </div>
        <div className={styles.kpi + ' ' + styles.kpiFlow}>
          <div className={styles.kpiLabel}>תזרים</div>
          <div className={styles.kpiValue + ' ' + (flow < 0 ? styles.kpiNeg : styles.kpiPos)}>{fmt(flow)}</div>
          <div className={styles.kpiSub}>{flow < 0 ? 'חריגה מההכנסות' : 'פנוי החודש'}</div>
        </div>
      </div>

      <div className={styles.wizardCta}>
        <div>
          <div className={styles.wizardCtaTitle}>בניית תקציב עם הלקוח</div>
          <div className={styles.wizardCtaText}>אשף מודרך: הכנסות, הוצאות קבועות, תקציב משתנה ויעדים. בסיום נשמר ועובר לאפליקציה של הלקוח.</div>
        </div>
        <Button onClick={() => setWizardOpen(true)}>פתח אשף</Button>
      </div>

      {activeCats.length > 0 && (
        <div className={styles.rollup + ' ' + (overCount > 0 ? styles.rollupWarn : styles.rollupOk)}>
          {overCount > 0 ? `${overCount} מתוך ${activeCats.length} קטגוריות בחריגה` : `כל ${activeCats.length} הקטגוריות בתקציב`}
        </div>
      )}
      <div className={styles.form}>
        <select className={styles.select} aria-label="קטגוריה" value={selectedCat} onChange={e => setCat(e.target.value)}>
          {selectableCats.map(c => <option key={c} value={c}>{c}</option>)}
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
      <div className={styles.rows}>
        {activeCats.map((c, i) => {
          const s = spentByCat[c] || 0;
          const l = limitOf(c);
          const over = s > l;
          return (
            <div key={c} className={styles.catRow + (over ? ' ' + styles.catRowOver : '')} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
              <span className={styles.catRowIcon} aria-hidden="true">{getCategoryIcon(c)}</span>
              <span className={styles.catRowName} title={c}>{c}</span>
              <div className={styles.catRowField}>
                <div className={styles.catRowLabel}>תכנון</div>
                <div className={styles.catRowValue}>{fmt(l)}</div>
              </div>
              <div className={styles.catRowField}>
                <div className={styles.catRowLabel}>ביצוע</div>
                <div className={styles.catRowValue + (over ? ' ' + styles.catRowValueOver : '')}>{fmt(s)}</div>
              </div>
              <DeleteButton title="מחק תקציב" onClick={() => removeBudget(c)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
