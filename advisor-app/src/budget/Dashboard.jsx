import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights } from './insights.js';
import { addMonths, getMonthTx } from './monthUtils.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Hero from '../components/Hero.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { catColor, chartTheme } from '../categories.js';
import styles from './Dashboard.module.css';
import { fmt } from '../format.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

const MONTH_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];

export default function Dashboard({ clientUserId, year, month }) {
  const CT = chartTheme();
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
  const catColors = catLabels.map(catColor);

  const allTrendMonths = [];
  for (let i = 5; i >= 0; i--) {
    allTrendMonths.push(addMonths(year, month, -i));
  }
  const allTrendData = allTrendMonths.map(({ year: y, month: m }) => monthSummary(data, y, m));
  const firstWithData = allTrendData.findIndex(s => s.income > 0 || s.expense > 0);
  const hasTrendData = firstWithData >= 0;
  const trendMonths = hasTrendData ? allTrendMonths.slice(firstWithData) : allTrendMonths;
  const trendData = hasTrendData ? allTrendData.slice(firstWithData) : allTrendData;

  const chartData = {
    labels: trendMonths.map(({ month: m }) => MONTH_SHORT[m]),
    datasets: [
      { label: 'הכנסות', data: trendData.map(s => s.income), backgroundColor: CT.green, borderRadius: 6, maxBarThickness: 34, barPercentage: 0.55, categoryPercentage: 0.6, hoverBackgroundColor: CT.greenHover },
      { label: 'הוצאות', data: trendData.map(s => s.expense), backgroundColor: CT.red, borderRadius: 6, maxBarThickness: 34, barPercentage: 0.55, categoryPercentage: 0.6, hoverBackgroundColor: CT.redHover }
    ]
  };

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

      <div className={styles.cardRow}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>לאן הולך הכסף</h2>
          {catLabels.length ? (
            <div className={styles.catBox}>
              <div className={styles.catDonut}>
                <Pie
                  data={{ labels: catLabels, datasets: [{ data: catLabels.map(l => byCat[l]), backgroundColor: catColors, borderColor: CT.surface, borderWidth: 2 }] }}
                  options={{
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: CT.surface, borderColor: CT.border, borderWidth: 1, padding: 10, titleFont: { family: CT.font }, bodyFont: { family: CT.font } } }
                  }}
                />
              </div>
              <div className={styles.catList}>
                {catLabels.slice(0, 5).map((l, i) => {
                  const pct = Math.round((byCat[l] / catTotal) * 100);
                  return (
                    <div key={l} className={styles.catRow}>
                      <span className={styles.catIconWrap}>{getCategoryIcon(l)}</span>
                      <span className={styles.catName}>{l}</span>
                      <span className={styles.catBar}><span className={styles.catBarFill} style={{ width: pct + '%', background: catColors[i] }} /></span>
                      <span className={styles.catAmt}>{fmt(byCat[l])}</span>
                    </div>
                  );
                })}
                {catLabels.length > 5 && (
                  <div className={styles.catMore}>
                    ועוד {catLabels.length - 5} קטגוריות · {fmt(catLabels.slice(5).reduce((s, l) => s + byCat[l], 0))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.empty}>אין עדיין הוצאות החודש</div>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>דורש תשומת לב</h2>
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
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{trendMonths.length > 1 ? `מגמת ${trendMonths.length} חודשים` : 'הכנסות מול הוצאות'}</h2>
        {hasTrendData ? (
          <div className={styles.trendChart}>
            <Bar
              data={chartData}
              options={{
                maintainAspectRatio: false,
                animation: ChartJS.defaults.animation === false ? false : { duration: 700, easing: 'easeOutQuart' },
                scales: {
                  x: { ticks: { color: CT.text2, font: { family: CT.font }, maxRotation: 0, minRotation: 0 }, grid: { display: false } },
                  y: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { color: CT.border } }
                },
                plugins: {
                  legend: { align: 'end', labels: { color: CT.text2, font: { family: CT.font }, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 } },
                  tooltip: { backgroundColor: CT.surface, borderColor: CT.border, borderWidth: 1, padding: 10, titleFont: { family: CT.font }, bodyFont: { family: CT.font } }
                }
              }}
            />
          </div>
        ) : (
          <div className={styles.empty}>אין עדיין נתונים להצגת מגמה</div>
        )}
      </div>
    </div>
  );
}
