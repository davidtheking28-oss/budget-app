import { currentInstallments } from './Subscriptions.jsx';
import styles from './PaymentsTimeline.module.css';

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const MONTHS_HE_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

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
      <div className={styles.head}>
        <div className={styles.headMain}>
          <div className={styles.headLabel}>התשלומים מסתיימים</div>
          <div className={styles.headValue}>{freeFrom}</div>
          <div className={styles.headSub}>
            {horizon === 1 ? 'החודש האחרון' : `עוד ${horizon} חודשים`} · נותרו {fmt(totalLeft)}
          </div>
        </div>
        <div className={styles.headFree}>
          <div className={styles.headLabel}>ואז יתפנו</div>
          <div className={styles.headFreeValue}>{fmt(monthlyNow)}</div>
          <div className={styles.headSub}>לחודש</div>
        </div>
      </div>

      <ol className={styles.steps}>
        {periods.map((p, i) => {
          const width = monthlyNow > 0 ? Math.max(4, Math.round((p.monthly / monthlyNow) * 100)) : 0;
          const range = p.months === 1
            ? offsetLabel(p.startOffset, now)
            : `${offsetLabel(p.startOffset, now)} – ${offsetLabel(p.endOffset, now)}`;
          return (
            <li key={i} className={styles.step} style={{ animationDelay: Math.min(i * 0.05, 0.3) + 's' }}>
              <div className={styles.stepTop}>
                <span className={styles.range}>{range}</span>
                <span className={styles.monthly}>{fmt(p.monthly)} <span className={styles.per}>לחודש</span></span>
              </div>
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: width + '%' }} />
              </div>
              <div className={styles.after}>
                <span className={styles.endsPill}>
                  מסתיים: {p.ending.map(e => e.name).join(', ')}
                </span>
                <span className={styles.freed}>+{fmt(p.freed)} פנוי</span>
                <span className={styles.thenText}>
                  {p.monthlyAfter > 0 ? `→ ${fmt(p.monthlyAfter)} לחודש` : '→ אין עוד תשלומים'}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
