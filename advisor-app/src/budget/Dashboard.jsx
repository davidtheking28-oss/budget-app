import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights } from './insights.js';
import { formatDateTime, getMonthTx } from './monthUtils.js';
import Skeleton from '../components/Skeleton.jsx';
import Button from '../components/Button.jsx';
import ActionMenu from '../components/ActionMenu.jsx';
import Hero from '../components/Hero.jsx';
import Donut, { donutSlices } from '../components/Donut.jsx';
import { Card, CardGrid, Row } from '../components/Rows.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Dashboard.module.css';
import { fmt } from '../format.js';

export default function Dashboard({ clientUserId, year, month, onOpenCategory, nextMeeting, openTasks = 0, onAction, onOpenMapping }) {
  const [expanded, setExpanded] = useState(false);
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
      : { label: 'מאוזן', tone: 'good' };

  const byCat = {};
  getMonthTx(data.transactions, year, month).filter(t => t.type === 'expense').forEach(t => {
    byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
  });
  const catLabels = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const catTotal = catLabels.reduce((s, l) => s + byCat[l], 0);
  const flagged = attention.filter(i => i.kind === 'danger' || i.kind === 'warn');
  const flaggedCats = [...new Set(flagged.map(i => i.category).filter(Boolean))];
  return (
    <div className={styles.page}>
      <Hero
        label={summary.net < 0 ? 'חריגה החודש' : 'נשאר החודש'}
        value={fmt(summary.net)}
        tone={summary.net < 0 ? 'neg' : 'pos'}
        note={<>
          {(
            <span className={styles.statusBadge + ' ' + styles[financialStatus.tone]}>
              <span className={styles.statusDot} aria-hidden="true" />{financialStatus.label}
            </span>
          )}
          {summary.income > 0 && <span>{savingsRate.toFixed(1)}% מההכנסה · יעד חיסכון {SAVINGS_TARGET}%</span>}
        </>}
        side={[
          { label: 'הכנסות', value: fmt(summary.income), tone: 'income' },
          { label: 'הוצאות', value: fmt(summary.expense), tone: 'expense' }
        ]}
        visual={catLabels.length ? <Donut title="הוצאות לפי קטגוריה" items={donutSlices(byCat)} /> : null}
      />

      <section className={styles.tiles} aria-label="סיכום וניהול הלקוח">
        <div className={styles.tile + (flagged.length ? ' ' + styles.tileAlert : '')}>
          <span className={styles.tileKey}>דורש בדיקה</span>
          <strong className={styles.tileValue}>{flagged.length ? `${flagged.length} חריגות` : 'הכול תקין'}</strong>
          <span className={styles.tileSub}>{flaggedCats.length ? flaggedCats.slice(0, 3).join(', ') : 'אין חריגות החודש'}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileKey}>חיסכון החודש</span>
          <strong className={styles.tileValue}>{hasData && summary.income > 0 ? `${savingsRate.toFixed(1)}%` : '—'}</strong>
          <span className={styles.tileSub}>מההכנסה, יעד {SAVINGS_TARGET}%</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileKey}>הפגישה הבאה</span>
          <strong className={styles.tileValue}>{nextMeeting ? formatDateTime(nextMeeting) : 'לא נקבעה'}</strong>
          <span className={styles.tileSub}>{openTasks} משימות פתוחות</span>
          <div className={styles.tileActions}>
            <Button onClick={() => onAction('task')}>משימה חדשה</Button>
            <ActionMenu>
              <Button variant="ghost" onClick={() => onAction('meeting')}>פגישה חדשה</Button>
              <Button variant="ghost" onClick={onOpenMapping}>מיפוי מסמכים</Button>
            </ActionMenu>
          </div>
        </div>
      </section>
      <CardGrid alignStart>
        <Card title="לאן הולך הכסף">
          {catLabels.length ? (
            <>
              {catLabels.slice(0, 4).map(l => {
                const pct = Math.round((byCat[l] / catTotal) * 100);
                return <Row key={l} name={l} sub={pct + '% מסך ההוצאות'} amount={fmt(byCat[l])} pct={pct} />;
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

        <Card title="תובנות לחודש">
          {attention.length ? (
            <>
            <ul id="dashboard-insights" className={styles.insights}>
              {(expanded ? attention : attention.slice(0, 3)).map((ins, i) => (
                <li key={i} className={styles.insight + ' ' + styles[ins.kind]}>
                  <span className={styles.insightKind}>{{danger: 'דורש בדיקה', warn: 'לתשומת לב', tip: 'כדאי לדעת', good: 'נקודה חיובית'}[ins.kind]}</span>
                  <b className={styles.insightTitle}><span className={styles.insightDot + ' ' + styles[ins.kind]} aria-hidden="true" />{ins.text.split(' — ')[0]}</b>
                  {ins.text.includes(' — ') && <span className={styles.insightSub}>{ins.text.split(' — ').slice(1).join(' — ')}</span>}
                  {ins.category && onOpenCategory && <button type="button" className={styles.insightAction} onClick={() => onOpenCategory(ins.category)}>פתח תקציב · {ins.category} ←</button>}
                </li>
              ))}
            </ul>
            {attention.length > 3 && <button type="button" className={styles.expandInsights} aria-expanded={expanded} aria-controls="dashboard-insights" onClick={() => setExpanded(value => !value)}>{expanded ? 'הצג פחות' : `הצג עוד ${attention.length - 3} תובנות`}</button>}
            </>
          ) : (
            <div className={styles.empty}>אין התראות החודש</div>
          )}
        </Card>
      </CardGrid>
    </div>
  );
}
