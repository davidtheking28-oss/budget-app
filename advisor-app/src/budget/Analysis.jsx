import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Analysis.module.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = ['#ff7a3d', '#c9a875', '#8b95a8', '#e8756a', '#52c99a', '#7d8fb3', '#d9b25c', '#5f7a76'];

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

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
      borderColor: '#fdfefe',
      borderWidth: 2
    }]
  };

  return (
    <div className={styles.wrap}>
      <Pie
        data={chartData}
        options={{
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#5c6b66', font: { family: 'Heebo', size: 12 }, padding: 16, boxWidth: 10, boxHeight: 10 }
            },
            tooltip: {
              backgroundColor: '#12201c',
              titleColor: '#f4fbfa',
              bodyColor: '#dbe8e4',
              borderColor: 'rgba(18,32,28,0.1)',
              borderWidth: 1,
              padding: 12,
              titleFont: { family: 'Heebo' },
              bodyFont: { family: 'Heebo' }
            }
          }
        }}
      />
    </div>
  );
}
