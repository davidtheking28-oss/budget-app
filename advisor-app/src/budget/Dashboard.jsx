import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights } from './insights.js';
import { addMonths } from './monthUtils.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Dashboard.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const MONTH_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];

function StatCard({ label, value, kind, glow }) {
  const display = useCountUp(value);
  return (
    <div className={styles.card}>
      <div className={styles.glow + ' ' + styles[glow]}></div>
      <div className={styles.label}>{label}</div>
      <div className={styles.value + ' ' + (kind ? styles[kind] : '')}>{fmt(display)}</div>
    </div>
  );
}

export default function Dashboard({ clientUserId, year, month }) {
  const { data, loading } = useClientBudget(clientUserId);

  if (loading || !data) {
    return (
      <div className={styles.cards}>
        <Skeleton height="112px" radius="16px" />
        <Skeleton height="112px" radius="16px" />
        <Skeleton height="112px" radius="16px" />
      </div>
    );
  }

  const summary = monthSummary(data, year, month);
  const insights = computeInsights(data, year, month);

  const trendMonths = [];
  for (let i = 5; i >= 0; i--) {
    trendMonths.push(addMonths(year, month, -i));
  }
  const trendData = trendMonths.map(({ year: y, month: m }) => monthSummary(data, y, m));

  const chartData = {
    labels: trendMonths.map(({ month: m }) => MONTH_SHORT[m]),
    datasets: [
      { label: 'הכנסות', data: trendData.map(s => s.income), backgroundColor: '#52c99a' },
      { label: 'הוצאות', data: trendData.map(s => s.expense), backgroundColor: '#e8756a' }
    ]
  };

  return (
    <div>
      <div className={styles.cards}>
        <StatCard label="הכנסות החודש" value={summary.income} kind="income" glow="glowGreen" />
        <StatCard label="הוצאות החודש" value={summary.expense} kind="expense" glow="glowRed" />
        <StatCard label="מאזן" value={summary.net} kind={summary.net < 0 ? 'expense' : 'net'} glow="glowGold" />
      </div>

      {insights.length > 0 && (
        <div className={styles.insights}>
          {insights.map((ins, i) => (
            <div key={i} className={styles.insight + ' ' + styles[ins.kind]}>{ins.text}</div>
          ))}
        </div>
      )}

      <div className={styles.trendWrap}>
        <div className={styles.trendTitle}>מגמת 6 חודשים</div>
        <div className={styles.trendChart}>
          <Bar
            data={chartData}
            options={{
              maintainAspectRatio: false,
              scales: {
                x: { ticks: { color: '#9a9d9f', font: { family: 'Heebo' } }, grid: { display: false } },
                y: { ticks: { color: '#9a9d9f', font: { family: 'Heebo' } }, grid: { color: 'rgba(242,240,234,0.06)' } }
              },
              plugins: { legend: { labels: { color: '#9a9d9f', font: { family: 'Heebo' } } } }
            }}
          />
        </div>
      </div>
    </div>
  );
}
