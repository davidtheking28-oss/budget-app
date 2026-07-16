import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights, computeHealthScore } from './insights.js';
import { addMonths } from './monthUtils.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Dashboard.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const MONTH_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];

function NetHero({ value }) {
  const display = useCountUp(value);
  return (
    <div className={styles.netValue + ' ' + (value < 0 ? styles.expense : styles.net)}>
      {fmt(display)}
    </div>
  );
}

function HealthRing({ score }) {
  const display = useCountUp(score);
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (display / 100) * c;
  const color = score >= 75 ? 'var(--green)' : score >= 45 ? 'var(--yellow)' : 'var(--red)';
  const label = score >= 75 ? 'מצב תקין' : score >= 45 ? 'דורש תשומת לב' : 'דורש טיפול';
  return (
    <div className={styles.healthRing}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 50 50)"
          className={styles.healthArc}
        />
        <text x="50" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)" fontFamily="var(--font-display)">{display}</text>
      </svg>
      <div className={styles.healthLabel}>{label}</div>
    </div>
  );
}

function SubStat({ label, value, kind }) {
  const display = useCountUp(value);
  return (
    <div className={styles.subStat}>
      <span className={styles.subStatValue + ' ' + styles[kind]}>{fmt(display)}</span>
      <span className={styles.subStatLabel}>{label}</span>
    </div>
  );
}

export default function Dashboard({ clientUserId, year, month }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return <Skeleton height="140px" radius="18px" />;
  }

  const summary = monthSummary(data, year, month);
  const insights = computeInsights(data, year, month);
  const healthScore = computeHealthScore(data, year, month);

  const insightGroups = [
    { key: 'danger', title: 'התראות סיכון' },
    { key: 'warn', title: 'כדאי לעקוב' },
    { key: 'tip', title: 'פעולות מומלצות' }
  ].map(g => ({ ...g, items: insights.filter(ins => ins.kind === g.key) })).filter(g => g.items.length > 0);

  const trendMonths = [];
  for (let i = 5; i >= 0; i--) {
    trendMonths.push(addMonths(year, month, -i));
  }
  const trendData = trendMonths.map(({ year: y, month: m }) => monthSummary(data, y, m));

  const chartData = {
    labels: trendMonths.map(({ month: m }) => MONTH_SHORT[m]),
    datasets: [
      { label: 'הכנסות', data: trendData.map(s => s.income), backgroundColor: '#52c99a', borderRadius: 5, hoverBackgroundColor: '#6adcb2' },
      { label: 'הוצאות', data: trendData.map(s => s.expense), backgroundColor: '#e8756a', borderRadius: 5, hoverBackgroundColor: '#f28e83' }
    ]
  };

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>מאזן החודש</div>
          <NetHero value={summary.net} />
          <div className={styles.subStats}>
            <SubStat label="הכנסות" value={summary.income} kind="income" />
            <SubStat label="הוצאות" value={summary.expense} kind="expense" />
          </div>
        </div>
        <HealthRing score={healthScore} />
      </div>

      <div className={styles.grid}>
        <div className={styles.insightsCol}>
          <div className={styles.colTitle}>תובנות</div>
          {insightGroups.length > 0 ? (
            <div className={styles.insightGroups}>
              {insightGroups.map(group => (
                <div key={group.key} className={styles.insightGroup}>
                  <div className={styles.groupTitle + ' ' + styles[group.key]}>{group.title}</div>
                  <div className={styles.insights}>
                    {group.items.map((ins, i) => (
                      <div key={i} className={styles.insight + ' ' + styles[ins.kind]} style={{ animationDelay: (i * 0.06) + 's' }}>{ins.text}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noInsights}>אין התראות מיוחדות החודש</div>
          )}
        </div>

        <div className={styles.trendWrap}>
          <div className={styles.colTitle}>מגמת 6 חודשים</div>
          <div className={styles.trendChart}>
          <Bar
            data={chartData}
            options={{
              maintainAspectRatio: false,
              animation: { duration: 700, easing: 'easeOutQuart' },
              scales: {
                x: { ticks: { color: '#9a9d9f', font: { family: 'Heebo' } }, grid: { display: false } },
                y: { ticks: { color: '#9a9d9f', font: { family: 'Heebo' } }, grid: { color: 'rgba(242,240,234,0.06)' } }
              },
              plugins: {
                legend: { labels: { color: '#9a9d9f', font: { family: 'Heebo' } } },
                tooltip: { backgroundColor: '#17130f', borderColor: 'rgba(255,122,61,0.3)', borderWidth: 1, padding: 10, titleFont: { family: 'Heebo' }, bodyFont: { family: 'Heebo' } }
              }
            }}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
