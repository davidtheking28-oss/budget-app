import { useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { CHART_PALETTE, CHART_THEME } from '../categories.js';
import styles from './Analysis.module.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');

export default function Analysis({ clientUserId, year, month }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId);
  const [whatIfCat, setWhatIfCat] = useState('');
  const [cutPct, setCutPct] = useState(20);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return <Skeleton height="400px" radius="14px" style={{ maxWidth: 460, margin: '32px auto 0' }} />;
  }

  const monthTx = getMonthTx(data.transactions, year, month)
    .filter(t => t.type === 'expense');

  if (!monthTx.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyMark}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 3.5v8.5h8.5" />
          </svg>
        </div>
        אין הוצאות החודש
      </div>
    );
  }

  const byCat = {};
  monthTx.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; });
  const labels = Object.keys(byCat);
  const values = labels.map(l => byCat[l]);
  const total = values.reduce((s, v) => s + v, 0);
  const colors = labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: CHART_THEME.bg,
      borderWidth: 2
    }]
  };

  const activeCat = labels.includes(whatIfCat) ? whatIfCat : labels[0];
  const catAmount = byCat[activeCat] || 0;
  const savings = Math.round(catAmount * (cutPct / 100));
  const newTotal = total - savings;

  return (
    <div className={styles.wrapOuter}>
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
                backgroundColor: CHART_THEME.surface,
                titleColor: CHART_THEME.text,
                bodyColor: CHART_THEME.text2,
                borderColor: CHART_THEME.border,
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
      <div className={styles.whatIf}>
        <div className={styles.whatIfTitle}>מה אם נצמצם קטגוריה?</div>
        <div className={styles.whatIfRow}>
          <select
            className={styles.whatIfSelect}
            aria-label="קטגוריה לצמצום"
            value={activeCat}
            onChange={e => setWhatIfCat(e.target.value)}
          >
            {labels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input
            className={styles.whatIfSlider}
            type="range"
            min="0"
            max="100"
            step="5"
            value={cutPct}
            aria-label="אחוז צמצום"
            onChange={e => setCutPct(Number(e.target.value))}
          />
          <span className={styles.whatIfPct}>{cutPct}%-</span>
        </div>
        <div className={styles.whatIfResult}>
          חיסכון של <b>{fmt(savings)}</b> בחודש · סה"כ הוצאות יורד ל-<b>{fmt(newTotal)}</b>
        </div>
      </div>
    </div>
  );
}
