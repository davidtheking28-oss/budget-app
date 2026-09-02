import { currentInstallments } from './Credit.jsx';
import { MONTH_NAMES as MONTHS_HE } from './monthUtils.js';
import styles from './PaymentsTimeline.module.css';
import { fmt } from '../format.js';

const MONTHS_HE_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

export function offsetLabel(offset, now = new Date(), long = false) {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const names = long ? MONTHS_HE : MONTHS_HE_SHORT;
  return `${names[d.getMonth()]} ${d.getFullYear()}`;
}

// Builds the stepped schedule of the client's monthly installment burden: how much they pay
// each month from now on, when each card plan ends, and what the burden drops to afterwards.
export function paymentSchedule(payments, now = new Date()) {
  const items = (payments || [])
    .map(p => {
      const total = parseFloat(p.total) || 0;
      const amount = parseFloat(p.amount) || 0;
      return { name: (p.name || '').trim() || 'תשלום', amount, left: Math.max(0, total - currentInstallments(p, total)) };
    })
    .filter(x => x.left > 0 && x.amount > 0);

  if (!items.length) return { periods: [], monthlyNow: 0, horizon: 0, totalLeft: 0 };

  const burdenAt = k => items.reduce((s, x) => s + (x.left > k ? x.amount : 0), 0);
  const horizon = Math.max(...items.map(x => x.left));
  const ends = [...new Set(items.map(x => x.left))].sort((a, b) => a - b);

  const periods = [];
  let start = 0;
  for (const e of ends) {
    const ending = items.filter(x => x.left === e);
    periods.push({
      startOffset: start,
      endOffset: e - 1,
      months: e - start,
      monthly: burdenAt(start),
      monthlyAfter: burdenAt(e),
      ending,
      freed: ending.reduce((s, x) => s + x.amount, 0),
    });
    start = e;
  }

  return {
    periods,
    monthlyNow: burdenAt(0),
    horizon,
    totalLeft: items.reduce((s, x) => s + x.amount * x.left, 0),
  };
}

export default function PaymentsTimeline({ payments, now = new Date() }) {
  const { periods, monthlyNow, horizon, totalLeft } = paymentSchedule(payments, now);
  if (!periods.length) return null;

  const freeFrom = offsetLabel(horizon, now, true);

  return (
    <div className={styles.wrap}>
      <p className={styles.summary}>
        היום משלם <b>{fmt(monthlyNow)}</b> לחודש.
        {' '}ב<b>{freeFrom}</b> הכל נגמר — ויתפנו <b className={styles.free}>{fmt(monthlyNow)}</b> בחודש.
      </p>

      <ol className={styles.rows}>
        {periods.map((p, i) => (
          <li key={i} className={styles.row} style={{ animationDelay: Math.min(i * 0.05, 0.3) + 's' }}>
            <span className={styles.when}>עד {offsetLabel(p.endOffset, now)}</span>
            <span className={styles.amount}>{fmt(p.monthly)}<span className={styles.per}> לחודש</span></span>
            <span className={styles.note}>
              {p.ending.map(e => e.name).join(', ')} נגמר — מתפנים {fmt(p.freed)}
            </span>
          </li>
        ))}
        <li className={styles.done}>
          <span className={styles.when}>מ{freeFrom}</span>
          <span className={styles.amountDone}>₪0</span>
          <span className={styles.note}>אין יותר תשלומים</span>
        </li>
      </ol>
    </div>
  );
}
