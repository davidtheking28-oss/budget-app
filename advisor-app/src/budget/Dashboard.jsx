import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights } from './insights.js';
import { addMonths, getMonthTx } from './monthUtils.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import Skeleton from '../components/Skeleton.jsx';
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

  const insightGroups = [
    { key: 'danger', title: 'התראות סיכון' },
    { key: 'warn', title: 'כדאי לעקוב' },
    { key: 'tip', title: 'פעולות מומלצות' },
    { key: 'good', title: 'מגמות חיוביות' }
  ].map(g => ({ ...g, items: insights.filter(ins => ins.kind === g.key) })).filter(g => g.items.length > 0);

  const SAVINGS_TARGET = 15;
  const savingsRate = summary.income > 0 ? (summary.net / summary.income) * 100 : 0;
  const financialStatus = insights.some(i => i.kind === 'danger')
    ? { label: 'קריטי', tone: 'danger' }
    : insights.some(i => i.kind === 'warn')
      ? { label: 'לתשומת לב', tone: 'warn' }
      : { label: 'בתקן', tone: 'good' };

  const byCat = {};
  getMonthTx(data.transactions, year, month).filter(t => t.type === 'expense').forEach(t => {
    byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
  });
  const catLabels = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const catTotal = catLabels.reduce((s, l) => s + byCat[l], 0);
  const catColors = catLabels.map(catColor);

  const trendMonths = [];
  for (let i = 5; i >= 0; i--) {
    trendMonths.push(addMonths(year, month, -i));
  }
  const trendData = trendMonths.map(({ year: y, month: m }) => monthSummary(data, y, m));
  const hasTrendData = trendData.some(s => s.income > 0 || s.expense > 0);

  const chartData = {
    labels: trendMonths.map(({ month: m }) => MONTH_SHORT[m]),
    datasets: [
      { label: 'הכנסות', data: trendData.map(s => s.income), backgroundColor: CT.green, borderRadius: 5, hoverBackgroundColor: CT.greenHover },
      { label: 'הוצאות', data: trendData.map(s => s.expense), backgroundColor: CT.red, borderRadius: 5, hoverBackgroundColor: CT.redHover }
    ]
  };

  return (
    <div className={styles.bentoGrid}>
      <div className={styles.statRow}>
        <div className={styles.statTile}>
          <div className={styles.statTileLabel}>סך הכנסות</div>
          <div className={styles.statTileValue + ' ' + styles.income}>{fmt(summary.income)}</div>
          <div className={styles.statTileMeta}>ממוצע חודשי, בית + עסק</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileLabel}>סך הוצאות</div>
          <div className={styles.statTileValue + ' ' + styles.expense}>{fmt(summary.expense)}</div>
          <div className={styles.statTileMeta}>קבועות + משתנות</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileLabel}>עודף תזרימי</div>
          <div className={styles.statTileValue + ' ' + (summary.net < 0 ? styles.expense : styles.net)}>{fmt(summary.net)}</div>
          <div className={styles.statTileMeta}>לפני הפרשה לחיסכון</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileLabel}>אחוז חיסכון מהכנסה</div>
          <div className={styles.statTileValue}>{savingsRate.toFixed(1)}%</div>
          <div className={styles.statTileMeta}>יעד: {SAVINGS_TARGET}%+</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileLabel}>סטטוס פיננסי</div>
          <span className={styles.statusBadge + ' ' + styles[financialStatus.tone]}>
            <span className={styles.statusDot} aria-hidden="true" />{financialStatus.label}
          </span>
        </div>
      </div>

      <div className={styles.tileCategories}>
        <div className={styles.colTitle}>קטגוריות הוצאה</div>
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
              {catLabels.slice(0, 4).map((l, i) => {
                const pct = Math.round((byCat[l] / catTotal) * 100);
                return (
                  <div key={l} className={styles.catRow}>
                    <span className={styles.catDot} style={{ background: catColors[i] }} />
                    <span className={styles.catIconWrap}>{getCategoryIcon(l)}</span>
                    <span className={styles.catName}>{l}</span>
                    <span className={styles.catBar}><span className={styles.catBarFill} style={{ width: pct + '%', background: catColors[i] }} /></span>
                    <span className={styles.catPct}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.trendEmpty}>אין עדיין הוצאות החודש</div>
        )}
      </div>

      {(data.goals || []).length > 0 && (
        <div className={styles.tileGoals}>
          <div className={styles.colTitle}>יעדים</div>
          <div className={styles.goalList}>
            {(data.goals || []).slice(0, 4).map(g => {
              const target = parseFloat(g.target) || 0;
              const saved = parseFloat(g.saved) || 0;
              const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
              const monthly = g.months > 0 ? Math.max(0, target - saved) / g.months : 0;
              return (
                <div key={g.id} className={styles.goalItem}>
                  <div className={styles.goalHead}>
                    <span className={styles.goalName}>{g.name}</span>
                    <span className={styles.goalAmt}>{fmt(saved)} / {fmt(target)}</span>
                  </div>
                  <div className={styles.goalBarRow}>
                    <div className={styles.goalBar}>
                      <div className={styles.goalFill + (pct >= 100 ? ' ' + styles.goalFillDone : '')} style={{ transform: `scaleX(${pct / 100})` }} />
                    </div>
                    <span className={styles.goalPct}>{pct}%</span>
                  </div>
                  {monthly > 0 && <div className={styles.goalNote}>הפקדה חודשית נדרשת: {fmt(monthly)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.tileTrend}>
        <div className={styles.colTitle}>מגמת 6 חודשים</div>
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
                  legend: { labels: { color: CT.text2, font: { family: CT.font } } },
                  tooltip: { backgroundColor: CT.surface, borderColor: CT.border, borderWidth: 1, padding: 10, titleFont: { family: CT.font }, bodyFont: { family: CT.font } }
                }
              }}
            />
          </div>
        ) : (
          <div className={styles.trendEmpty}>אין עדיין נתונים להצגת מגמה</div>
        )}
      </div>

      {insightGroups.length > 0 && (
        <div className={styles.insightsRow}>
          {insightGroups.map(group => (
            <div key={group.key} className={styles.tileGroup}>
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
      )}
    </div>
  );
}
