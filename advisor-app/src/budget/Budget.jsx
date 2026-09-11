import { useClientBudget } from './useClientBudget.js';
import { getMonthTx, MONTH_NAMES } from './monthUtils.js';
import { effectiveLimit } from './budgetMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import BudgetWizard from './BudgetWizard.jsx';
import ModuleHeader from '../components/ModuleHeader.jsx';
import MonthTabs from '../components/MonthTabs.jsx';
import styles from './Budget.module.css';
import { fmt } from '../format.js';

const CALENDAR_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
  </svg>
);

export default function Budget({ clientUserId, advisorId, year, month, onSelectMonth }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);

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

  const activeCats = Object.keys(budgets).filter(c => budgets[c]);
  const limitOf = c => effectiveLimit(data, c, year, month);

  const monthlyIncome = incomeSources.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const totalBudgeted = activeCats.reduce((s, c) => s + limitOf(c), 0);
  const totalSpent = activeCats.reduce((s, c) => s + (spentByCat[c] || 0), 0);
  const flow = monthlyIncome - totalSpent;

  return (
    <div>
      {onSelectMonth && <MonthTabs month={month} onSelectMonth={onSelectMonth} />}

      <ModuleHeader
        icon={CALENDAR_ICON}
        title={`תקציב ${MONTH_NAMES[month]}`}
        subtitle="תכנון מול ביצוע בפועל"
        right={<div className={styles.yearBadge}>שנה: {year}</div>}
      />

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

      <BudgetWizard data={data} save={save} year={year} month={month} />
    </div>
  );
}
