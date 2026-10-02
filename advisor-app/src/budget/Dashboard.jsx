import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights } from './insights.js';
import { getMonthTx } from './monthUtils.js';
import Skeleton from '../components/Skeleton.jsx';
import Hero from '../components/Hero.jsx';
import { Card, CardGrid, Row } from '../components/Rows.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Dashboard.module.css';
import { fmt } from '../format.js';

export default function Dashboard({ clientUserId, year, month }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return <Skeleton height="140px" radius="18px" />;
  }

  const summary = monthSummary(data, year, month);
  const insights = computeInsights(data, year, month);

  const KIND_ORDER = ['danger', 'warn', 'tip', 'good'];
  const attention = [...insights].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

  const SAVINGS_TARGET = 15;
  const savingsRate = summary.income > 0 ? (summary.net / summary.income) * 100 : 0;
  const hasData = summary.income > 0 || summary.expense > 0;
  const financialStatus = !hasData
    ? { label: 'אין נתונים לחודש', tone: 'neutral' }
    : summary.net < 0
    ? { label: 'קריטי', tone: 'danger' }
    : insights.some(i => i.kind === 'danger' || i.kind === 'warn')
      ? { label: 'לתשומת לב', tone: 'warn' }
      : { label: 'בתקן', tone: 'good' };

  const byCat = {};
  getMonthTx(data.transactions, year, month).filter(t => t.type === 'expense').forEach(t => {
    byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
  });
  const catLabels = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const catTotal = catLabels.reduce((s, l) => s + byCat[l], 0);
  return (
    <div className={styles.page}>
      <Hero
        label={summary.net < 0 ? 'חריגה החודש' : 'נשאר החודש'}
        value={fmt(summary.net)}
        tone={summary.net < 0 ? 'neg' : 'pos'}
        note={<>
          <span className={styles.statusBadge + ' ' + styles[financialStatus.tone]}>
            <span className={styles.statusDot} aria-hidden="true" />{financialStatus.label}
          </span>
          {summary.income > 0 && <span>{savingsRate.toFixed(1)}% מההכנסה · יעד חיסכון {SAVINGS_TARGET}%</span>}
        </>}
        side={[
          { label: 'הכנסות', value: fmt(summary.income), tone: 'income' },
          { label: 'הוצאות', value: fmt(summary.expense), tone: 'expense' }
        ]}
      />

      <CardGrid>
        <Card title="לאן הולך הכסף">
          {catLabels.length ? (
            <>
              {catLabels.slice(0, 4).map(l => {
                const pct = Math.round((byCat[l] / catTotal) * 100);
                return <Row key={l} name={l} amount={fmt(byCat[l])} pct={pct} />;
              })}
              {catLabels.length > 4 && (
                <Row
                  name={`ועוד ${catLabels.length - 4} קטגוריות`}
                  amount={fmt(catLabels.slice(4).reduce((s, l) => s + byCat[l], 0))}
                  pct={Math.round(catLabels.slice(4).reduce((s, l) => s + byCat[l], 0) / catTotal * 100)}
                />
              )}
            </>
          ) : (
            <div className={styles.empty}>אין עדיין הוצאות החודש</div>
          )}
        </Card>

        <Card title="דורש תשומת לב">
          {attention.length ? (
            <ul className={styles.insights}>
              {attention.map((ins, i) => (
                <li key={i} className={styles.insight}>
                  <span className={styles.insightDot + ' ' + styles[ins.kind]} aria-hidden="true" />
                  {ins.text}
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>אין התראות החודש</div>
          )}
        </Card>
      </CardGrid>
    </div>
  );
}
