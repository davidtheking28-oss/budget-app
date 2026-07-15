import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Subscriptions.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const CYCLE_LABELS = { monthly: 'חודשי', yearly: 'שנתי' };

export default function Subscriptions({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);

  if (loading || !data) {
    return (
      <div>
        <Skeleton height="60px" radius="10px" style={{ marginBottom: 10 }} />
        <Skeleton height="60px" radius="10px" />
      </div>
    );
  }

  const subs = data.subscriptions || [];
  const loans = data.loans || [];

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>מנויים</div>
        {subs.length ? (
          <div className={styles.list}>
            {subs.map((s, i) => (
              <div key={s.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div>
                  <div className={styles.name}>{s.name}</div>
                  <div className={styles.meta}>{CYCLE_LABELS[s.cycle] || s.cycle}{s.nextDate ? ' · חידוש ' + s.nextDate : ''}</div>
                </div>
                <div className={styles.amount}>{fmt(s.amount || 0)}</div>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין מנויים רשומים</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>הלוואות</div>
        {loans.length ? (
          <div className={styles.list}>
            {loans.map((l, i) => (
              <div key={l.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div>
                  <div className={styles.name}>{l.name || 'הלוואה'}</div>
                  <div className={styles.meta}>{l.current !== undefined ? 'יתרה ' + fmt(l.current) + ' מתוך ' + fmt(l.total) : ''}</div>
                </div>
                <div className={styles.amount}>{fmt(l.amount || 0)}</div>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין הלוואות רשומות</div>}
      </div>
    </div>
  );
}
