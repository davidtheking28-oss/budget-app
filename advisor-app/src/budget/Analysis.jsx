import { useState } from 'react';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { addMonths, getMonthTx } from './monthUtils.js';
import Skeleton from '../components/Skeleton.jsx';
import Hero from '../components/Hero.jsx';
import { Card, CardGrid, Row } from '../components/Rows.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { catColor, chartTheme } from '../categories.js';
import styles from './Analysis.module.css';
import { fmt } from '../format.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const MONTH_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];

export default function Analysis({ clientUserId, year, month }) {
  const CT = chartTheme();
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
  const labels = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const values = labels.map(l => byCat[l]);
  const total = values.reduce((s, v) => s + v, 0);
  const colors = labels.map(catColor);

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: CT.bg,
      borderWidth: 2
    }]
  };

  const prev = addMonths(year, month, -1);
  const prevTotal = getMonthTx(data.transactions, prev.year, prev.month).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const diff = total - prevTotal;

  const prevByCat = {};
  getMonthTx(data.transactions, prev.year, prev.month).filter(t => t.type === 'expense').forEach(t => {
    prevByCat[t.cat] = (prevByCat[t.cat] || 0) + t.amount;
  });
  const changes = prevTotal > 0
    ? [...new Set([...labels, ...Object.keys(prevByCat)])]
        .map(c => ({ cat: c, delta: (byCat[c] || 0) - (prevByCat[c] || 0) }))
        .filter(x => x.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 4)
    : [];

  const allTrendMonths = [];
  for (let i = 5; i >= 0; i--) allTrendMonths.push(addMonths(year, month, -i));
  const allTrendData = allTrendMonths.map(({ year: y, month: m }) => monthSummary(data, y, m));
  const firstWithData = allTrendData.findIndex(x => x.income > 0 || x.expense > 0);
  const trendMonths = allTrendMonths.slice(Math.max(0, firstWithData));
  const trendData = allTrendData.slice(Math.max(0, firstWithData));
  const trendChart = {
    labels: trendMonths.map(({ month: m }) => MONTH_SHORT[m]),
    datasets: [
      { label: 'הכנסות', data: trendData.map(x => x.income), backgroundColor: CT.green, borderRadius: 6, maxBarThickness: 34, hoverBackgroundColor: CT.greenHover },
      { label: 'הוצאות', data: trendData.map(x => x.expense), backgroundColor: CT.red, borderRadius: 6, maxBarThickness: 34, hoverBackgroundColor: CT.redHover }
    ]
  };

  const activeCat = labels.includes(whatIfCat) ? whatIfCat : labels[0];
  const catAmount = byCat[activeCat] || 0;
  const savings = Math.round(catAmount * (cutPct / 100));
  const newTotal = total - savings;

  return (
    <>
      <Hero
        label="סה״כ הוצאות החודש"
        value={fmt(total)}
        note={prevTotal > 0 ? (diff === 0 ? 'זהה לחודש הקודם' : `${diff < 0 ? 'פחות' : 'יותר'} ב־${fmt(Math.abs(diff))} מהחודש הקודם (${Math.round(Math.abs(diff) / prevTotal * 100)}%)`) : null}
        side={[
          { label: 'הקטגוריה הגדולה', value: labels[0], meta: `${Math.round((values[0] / total) * 100)}% · ${fmt(values[0])}` },
          { label: 'קטגוריות', value: String(labels.length) }
        ]}
      />
      <CardGrid>
        <Card title="הכנסות מול הוצאות">
          <div className={styles.trendChart}>
            <Bar
              data={trendChart}
              options={{
                maintainAspectRatio: false,
                animation: ChartJS.defaults.animation === false ? false : { duration: 700, easing: 'easeOutQuart' },
                scales: {
                  x: { ticks: { color: CT.text2, font: { family: CT.font }, maxRotation: 0, minRotation: 0 }, grid: { display: false } },
                  y: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { color: CT.border } }
                },
                plugins: {
                  legend: { align: 'end', labels: { color: CT.text2, font: { family: CT.font }, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 } },
                  tooltip: { backgroundColor: CT.surface, borderColor: CT.border, borderWidth: 1, padding: 10, titleFont: { family: CT.font }, bodyFont: { family: CT.font } }
                }
              }}
            />
          </div>
        </Card>
        <Card title="שינויים בולטים">
          {changes.length ? changes.map(c => (
            <Row key={c.cat} name={c.cat} amount={(c.delta > 0 ? '+' : '−') + fmt(Math.abs(c.delta))} amountTone={c.delta > 0 ? 'neg' : 'pos'} />
          )) : <div className={styles.cardEmpty}>אין חודש קודם להשוואה</div>}
        </Card>
      </CardGrid>
    <div className={styles.wrapOuter}>
    <h2 className={styles.cardTitle}>פילוח לפי קטגוריה</h2>
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
                backgroundColor: CT.surface,
                titleColor: CT.text,
                bodyColor: CT.text2,
                borderColor: CT.border,
                borderWidth: 1,
                padding: 12,
                titleFont: { family: CT.font },
                bodyFont: { family: CT.font }
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
          <span className={styles.whatIfPct}>-{cutPct}%</span>
        </div>
        <div className={styles.whatIfResult}>
          חיסכון של <b>{fmt(savings)}</b> בחודש · סה"כ הוצאות יורד ל-<b>{fmt(newTotal)}</b>
        </div>
      </div>
    </div>
    </>
  );
}
