import { useClientBudget } from './useClientBudget.js';
import { effectiveLimit, incomeSourcesFor, monthSummary } from './budgetMath.js';
import Skeleton from '../components/Skeleton.jsx';
import Hero from '../components/Hero.jsx';
import ErrorState from '../components/ErrorState.jsx';
import BudgetWizard from './BudgetWizard.jsx';
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
      <Hero
        label={flow < 0 ? 'חריגה מההכנסות' : 'פנוי החודש'}
        value={fmt(flow)}
        tone={flow < 0 ? 'neg' : 'pos'}
        note={totalBudgeted > 0 ? `נוצל ${Math.round((summary.expense / totalBudgeted) * 100)}% מהתקציב` : 'אין תקציב מוגדר'}
        side={[
          { label: 'הכנסות', value: fmt(summary.income), tone: 'income', meta: plannedIncome > 0 ? `מתוך ${fmt(plannedIncome)} מתוכנן` : null },
          { label: 'הוצאות', value: fmt(summary.expense), tone: 'expense', meta: totalBudgeted > 0 ? `מתוך ${fmt(totalBudgeted)} מתוקצב` : null }
        ]}
      />

      <BudgetWizard data={data} save={save} year={year} month={month} />
    </div>
  );
}
