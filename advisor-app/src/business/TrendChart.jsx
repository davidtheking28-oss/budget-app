import { useState } from 'react';
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { chartTheme } from '../categories.js';
import styles from './Business.module.css';
import layout from './TrendChart.module.css';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

export default function TrendChart({ title = 'מגמות לאורך הזמן', labels, metrics, footnote, controls }) {
  const [active, setActive] = useState(metrics[0].key);
  const metric = metrics.find(m => m.key === active) || metrics[0];
  const hasValues = metric.values.some(value => Number(value) !== 0 && value != null);
  const CT = chartTheme();
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || CT.green;
  const data = {
    labels,
    datasets: [{ label: metric.label, data: metric.values, borderColor: accent, backgroundColor: accent, pointBackgroundColor: accent, pointRadius: 3, tension: 0.25 }]
  };
  const options = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${metric.label}: ${metric.format(ctx.parsed.y)}` } } },
    scales: {
      x: { ticks: { color: CT.text2, font: { family: CT.font }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: CT.text2, font: { family: CT.font }, precision: 0 }, grid: { color: CT.border } }
    }
  };
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}><h3 className={styles.cardTitle}>{title}</h3>{controls}</div>
      <label className={layout.metricPicker}>
        <span>מדד להצגה בגרף</span>
        <select className={styles.select} value={metric.key} onChange={e => setActive(e.target.value)}>
          {metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </label>
      {hasValues ? <div className={styles.chartBox}><Line aria-label={`${title} · ${metric.label}: ${labels.map((label, i) => `${label}: ${metric.format(metric.values[i])}`).join(' · ')}`} data={data} options={options} /></div> : <div className={styles.chartEmpty}><strong>כל הערכים במדד זה הם 0</strong><span>אפשר לבחור מדד אחר או לעדכן את נתוני התקופה.</span></div>}
      {footnote && <p className={styles.note}>{footnote}</p>}
    </section>
  );
}
