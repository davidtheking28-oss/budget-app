import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import styles from './Analysis.module.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = ['#2dd4bf', '#f87171', '#fbbf24', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fb923c'];

export default function Analysis({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);
  if (loading || !data) return null;

  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth())
    .filter(t => t.type === 'expense');

  if (!monthTx.length) {
    return <div className={styles.empty}>אין הוצאות החודש</div>;
  }

  const byCat = {};
  monthTx.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; });
  const labels = Object.keys(byCat);
  const values = labels.map(l => byCat[l]);

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length])
    }]
  };

  return (
    <div className={styles.wrap}>
      <Pie data={chartData} options={{ plugins: { legend: { labels: { color: '#f2f5f4' } } } }} />
    </div>
  );
}
