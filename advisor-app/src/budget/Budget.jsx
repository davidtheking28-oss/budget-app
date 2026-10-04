import { useContext, useState } from 'react';
import { useClientBudget, BudgetModeContext } from './useClientBudget.js';
import MonthTransactions from './MonthTransactions.jsx';
import { effectiveLimit, incomeSourcesFor, monthSummary } from './budgetMath.js';
import Skeleton from '../components/Skeleton.jsx';
import Hero from '../components/Hero.jsx';
import Button from '../components/Button.jsx';
import { Card, CardGrid, Row } from '../components/Rows.jsx';
import ErrorState from '../components/ErrorState.jsx';
import BudgetWizard from './BudgetWizard.jsx';
import { getMonthTx } from './monthUtils.js';
import { fmt } from '../format.js';
import styles from './Budget.module.css';

export default function Budget({ clientUserId, advisorId, year, month }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const mode = useContext(BudgetModeContext);
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
  const summary = monthSummary(data, year, month);
  const plannedIncome = incomeSourcesFor(data.settings, year, month).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const totalBudgeted = Object.keys(budgets).filter(c => budgets[c]).reduce((s, c) => s + effectiveLimit(data, c, year, month), 0);
  const flow = summary.net;
  const spentByCat = {};
  getMonthTx(data.transactions, year, month).filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });
  const budgetRows = Object.keys(budgets).filter(c => budgets[c]).map(c => {
    const limit = effectiveLimit(data, c, year, month);
    const spent = spentByCat[c] || 0;
    return { cat: c, limit, spent, ratio: limit > 0 ? spent / limit : 0 };
  }).sort((a, b) => b.limit - a.limit);
  if (budgetRows.length === 0 && !wizardOpen) setWizardOpen(true);

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

      {budgetRows.length > 0 && (
        <CardGrid single>
          <Card title="קטגוריות">
            {budgetRows.map(r => (
              <Row
                key={r.cat}
                name={r.cat}
                pct={r.ratio * 100}
                barTone={r.ratio > 1 ? 'over' : r.ratio >= 0.85 ? 'warn' : undefined}
                amount={`${fmt(r.spent)} / ${fmt(r.limit)}`}
                amountTone={r.ratio > 1 ? 'neg' : undefined}
              />
            ))}
          </Card>
        </CardGrid>
      )}

      <MonthTransactions data={data} save={save} mode={mode} year={year} month={month} />

      {wizardOpen
        ? <BudgetWizard data={data} save={save} year={year} month={month} />
        : <Button variant="ghost" className={styles.addBtn} onClick={() => setWizardOpen(true)}>בניית תקציב עם הלקוח</Button>}
    </div>
  );
}
