import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Analysis.module.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = ['#4f83ff', '#c9a875', '#8b95a8', '#e8756a', '#52c99a', '#7d8fb3', '#d9b25c', '#5f7a76'];
const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Analysis({ clientUserId, year, month }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return <Skeleton height="400px" radius="16px" style={{ maxWidth: 460, margin: '32px auto 0' }} />;
  }

  const monthTx = getMonthTx(data.transactions, year, month)
    .filter(t => t.type === 'expense');

  if (!monthTx.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyMark}></div>
        אין הוצאות החודש
      </div>
    );
  }

  const byCat = {};
  monthTx.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; });
  const labels = Object.keys(byCat);
  const values = labels.map(l => byCat[l]);
  const total = values.reduce((s, v) => s + v, 0);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: '#0b0d10',
      borderWidth: 2
    }]
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.donutBox}>
        <Pie
          data={chartData}
          options={{
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#14181c',
                titleColor: '#f2f0ea',
                bodyColor: '#9a9d9f',
                borderColor: 'rgba(242,240,234,0.1)',
                borderWidth: 1,
                padding: 12,
                titleFont: { family: 'Heebo' },
                bodyFont: { family: 'Heebo' }
              }
            }
          }}
        />
        <div className={styles.donutCenter}>
          <div className={styles.donutTotal}>{fmt(total)}</div>
          <div className={styles.donutTotalLabel}>סה"כ הוצאות</div>
        </div>
      </div>
      <div className={styles.legend}>
        {labels.map((l, i) => (
          <div key={l} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: colors[i] }} />
            <span className={styles.legendLabel}>{l}</span>
            <span className={styles.legendPct}>{Math.round((values[i] / total) * 100)}%</span>
            <span className={styles.legendValue}>{fmt(values[i])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
