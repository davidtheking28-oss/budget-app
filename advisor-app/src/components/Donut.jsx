import styles from './Donut.module.css';
import { fmt } from '../format.js';

const COLORS = ['var(--donut-1)', 'var(--donut-2)', 'var(--donut-3)', 'var(--donut-4)', 'var(--donut-5)'];
const R = 72;
const C = 2 * Math.PI * R;

export function donutSlices(byCat, max = 4) {
  const sorted = Object.keys(byCat).map(label => ({ label, value: byCat[label] })).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, max);
  const rest = sorted.slice(max).reduce((s, x) => s + x.value, 0);
  return rest > 0 ? [...head, { label: 'אחר', value: rest }] : head;
}

export default function Donut({ items, title }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return null;
  let offset = 0;
  const top = items[0];
  return (
    <div className={styles.box}>
      <svg className={styles.donut} viewBox="0 0 200 200" role="img" aria-label={title}>
        {items.map((it, i) => {
          const len = (it.value / total) * C;
          const el = (
            <circle key={it.label} cx="100" cy="100" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="22"
              strokeDasharray={`${Math.max(0, len - 2.5).toFixed(2)} ${(C - len + 2.5).toFixed(2)}`} strokeDashoffset={(-offset).toFixed(2)} transform="rotate(-90 100 100)" />
          );
          offset += len;
          return el;
        })}
        <text x="100" y="99" textAnchor="middle" className={styles.centerValue}>{Math.round((top.value / total) * 100)}%</text>
        <text x="100" y="119" textAnchor="middle" className={styles.centerLabel}>{top.label}</text>
      </svg>
      <div className={styles.side}>
        <div className={styles.title}>{title}</div>
        <ul className={styles.legend}>
          {items.map((it, i) => (
            <li key={it.label}>
              <i style={{ background: COLORS[i % COLORS.length] }} />
              <span className={styles.name}>{it.label}</span>
              <b className={styles.amt}>{fmt(it.value)}</b>
              <b className={styles.pct}>{Math.round((it.value / total) * 100)}%</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
