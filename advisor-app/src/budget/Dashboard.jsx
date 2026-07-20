import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights, computeHealthScore } from './insights.js';
import { addMonths, getMonthTx } from './monthUtils.js';
import { useCountUp } from '../useCountUp.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { CHART_PALETTE, CHART_THEME } from '../categories.js';
import styles from './Dashboard.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');
const MONTH_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];

function NetHero({ value }) {
  const display = useCountUp(value);
  return (
    <div className={styles.netValue + ' ' + (value < 0 ? styles.expense : styles.net)}>
      {fmt(display)}
    </div>
  );
}

function Sparkline({ values }) {
  const w = 120, h = 32, pad = 3;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const rising = values[values.length - 1] >= values[0];
  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" stroke={rising ? 'var(--green)' : 'var(--red)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function TrendBadge({ current, previous, kind }) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  const rising = pct > 0;
  const good = kind === 'income' ? rising : !rising;
  return (
    <span className={styles.trendBadge + ' ' + (good ? styles.trendGood : styles.trendBad)}>
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {rising ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
      {Math.abs(pct)}%
    </span>
  );
}

function SubStat({ label, value, prevValue, kind }) {
  const display = useCountUp(value);
  return (
    <div className={styles.subStat}>
      <span className={styles.subStatValue + ' ' + styles[kind]}>{fmt(display)}</span>
      <span className={styles.subStatLabel}>{label}</span>
      <TrendBadge current={value} previous={prevValue} kind={kind} />
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
    { key: 'tip', title: 'פעולות מומלצות' },
    { key: 'good', title: 'מגמות חיוביות' }
  ].map(g => ({ ...g, items: insights.filter(ins => ins.kind === g.key) })).filter(g => g.items.length > 0);

  const topInsight = ['danger', 'warn', 'tip', 'good'].map(k => insights.find(ins => ins.kind === k)).find(Boolean);

  const byCat = {};
  getMonthTx(data.transactions, year, month).filter(t => t.type === 'expense').forEach(t => {
    byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
  });
  const catLabels = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const catTotal = catLabels.reduce((s, l) => s + byCat[l], 0);
  const catColors = catLabels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

  const trendMonths = [];
  for (let i = 5; i >= 0; i--) {
    trendMonths.push(addMonths(year, month, -i));
  }
  const trendData = trendMonths.map(({ year: y, month: m }) => monthSummary(data, y, m));
  const hasTrendData = trendData.some(s => s.income > 0 || s.expense > 0);
  const netTrend = trendData.map(s => s.income - s.expense);

  const chartData = {
    labels: trendMonths.map(({ month: m }) => MONTH_SHORT[m]),
    datasets: [
      { label: 'הכנסות', data: trendData.map(s => s.income), backgroundColor: CHART_THEME.green, borderRadius: 5, hoverBackgroundColor: CHART_THEME.greenLight },
      { label: 'הוצאות', data: trendData.map(s => s.expense), backgroundColor: CHART_THEME.red, borderRadius: 5, hoverBackgroundColor: CHART_THEME.redLight }
    ]
  };

  return (
    <div className={styles.bentoGrid}>
      <div className={styles.tileBalance}>
        <div className={styles.heroLabel}>מאזן החודש</div>
        <div className={styles.heroRow}>
          <NetHero value={summary.net} />
          {hasTrendData && <Sparkline values={netTrend} />}
        </div>
        <div className={styles.subStats}>
          <SubStat label="הכנסות" value={summary.income} prevValue={trendData[trendData.length - 2]?.income} kind="income" />
          <SubStat label="הוצאות" value={summary.expense} prevValue={trendData[trendData.length - 2]?.expense} kind="expense" />
        </div>
      </div>

      <div className={styles.tileHealth}>
        <HealthRing score={healthScore} />
      </div>

      <div className={styles.tileHighlight + ' ' + styles[topInsight ? topInsight.kind : 'good']}>
        <div className={styles.tileLabel}>{topInsight ? 'לתשומת לבך' : 'מצב כללי'}</div>
        <div className={styles.tileHighlightText}>{topInsight ? topInsight.text : 'אין התראות מיוחדות החודש'}</div>
      </div>

      <div className={styles.tileCategories}>
        <div className={styles.colTitle}>קטגוריות הוצאה</div>
        {catLabels.length ? (
          <div className={styles.catBox}>
            <div className={styles.catDonut}>
              <Pie
                data={{ labels: catLabels, datasets: [{ data: catLabels.map(l => byCat[l]), backgroundColor: catColors, borderColor: CHART_THEME.surface, borderWidth: 2 }] }}
                options={{
                  maintainAspectRatio: false,
                  cutout: '70%',
                  plugins: { legend: { display: false }, tooltip: { backgroundColor: CHART_THEME.surface, borderColor: 'rgba(79,131,255,0.3)', borderWidth: 1, padding: 10, titleFont: { family: 'Heebo' }, bodyFont: { family: 'Heebo' } } }
                }}
              />
            </div>
            <div className={styles.catList}>
              {catLabels.slice(0, 4).map((l, i) => (
                <div key={l} className={styles.catRow}>
                  <span className={styles.catDot} style={{ background: catColors[i] }} />
                  <span className={styles.catIconWrap}>{getCategoryIcon(l)}</span>
                  <span className={styles.catName}>{l}</span>
                  <span className={styles.catPct}>{Math.round((byCat[l] / catTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.trendEmpty}>אין עדיין הוצאות החודש</div>
        )}
      </div>

      <div className={styles.tileTrend}>
        <div className={styles.colTitle}>מגמת 6 חודשים</div>
        {hasTrendData ? (
          <div className={styles.trendChart}>
            <Bar
              data={chartData}
              options={{
                maintainAspectRatio: false,
                animation: { duration: 700, easing: 'easeOutQuart' },
                scales: {
                  x: { ticks: { color: CHART_THEME.text2, font: { family: 'Heebo' } }, grid: { display: false } },
                  y: { ticks: { color: CHART_THEME.text2, font: { family: 'Heebo' } }, grid: { color: 'rgba(242,240,234,0.06)' } }
                },
                plugins: {
                  legend: { labels: { color: CHART_THEME.text2, font: { family: 'Heebo' } } },
                  tooltip: { backgroundColor: CHART_THEME.surface, borderColor: 'rgba(79,131,255,0.3)', borderWidth: 1, padding: 10, titleFont: { family: 'Heebo' }, bodyFont: { family: 'Heebo' } }
                }
              }}
            />
          </div>
        ) : (
          <div className={styles.trendEmpty}>אין עדיין נתונים להצגת מגמה</div>
        )}
      </div>

      {insightGroups.map(group => (
        <div key={group.key} className={styles.tileGroup + (group.items.length > 1 ? ' ' + styles.tileGroupWide : '')}>
          <div className={styles.groupTitle + ' ' + styles[group.key]}>{group.title}</div>
          <div className={styles.insights}>
            {group.items.map((ins, i) => (
              <div key={i} className={styles.insight + ' ' + styles[ins.kind]} style={{ animationDelay: (i * 0.06) + 's' }}>
                <span className={styles.insightDot} />
                {ins.text}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
