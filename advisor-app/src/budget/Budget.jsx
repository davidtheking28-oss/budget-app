import { useClientBudget } from './useClientBudget.js';
import { effectiveLimit, incomeSourcesFor, monthSummary } from './budgetMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import BudgetWizard from './BudgetWizard.jsx';
import styles from './Budget.module.css';
import { fmt } from '../format.js';

export default function Budget({ clientUserId, advisorId, year, month }) {
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
  const summary = monthSummary(data, year, month);
  const plannedIncome = incomeSourcesFor(data.settings, year, month).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const totalBudgeted = Object.keys(budgets).filter(c => budgets[c]).reduce((s, c) => s + effectiveLimit(data, c, year, month), 0);
  const flow = summary.net;

  return (
    <div>

      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>סך הכל הכנסות</div>
          <div className={styles.kpiValue}>{fmt(summary.income)}</div>
          <div className={styles.kpiSub}>{plannedIncome > 0 ? `מתוך ${fmt(plannedIncome)} מתוכנן` : 'אין הכנסה מתוכננת'}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>סך הכל הוצאות</div>
          <div className={styles.kpiValue}>{fmt(summary.expense)}</div>
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
