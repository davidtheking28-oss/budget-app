import { useState } from 'react';
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { chartTheme } from '../categories.js';
import styles from './Business.module.css';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

export default function TrendChart({ title = 'מגמות לאורך הזמן', labels, metrics, footnote, controls }) {
  const [active, setActive] = useState(metrics[0].key);
  const metric = metrics.find(m => m.key === active) || metrics[0];
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
      <div className={styles.segment} role="group" aria-label="מדד להצגה בגרף" style={{ marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        {metrics.map(m => <button key={m.key} type="button" className={m.key === metric.key ? styles.segBtnOn : styles.segBtn} aria-pressed={m.key === metric.key} onClick={() => setActive(m.key)}>{m.label}</button>)}
      </div>
      <div className={styles.chartBox}><Line data={data} options={options} /></div>
      {footnote && <p className={styles.note}>{footnote}</p>}
    </section>
  );
}
