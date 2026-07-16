import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Subscriptions.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const CYCLE_LABELS = { monthly: 'חודשי', yearly: 'שנתי' };
const PALETTE = ['#4f83ff', '#c9a875', '#8b95a8', '#e8756a', '#52c99a', '#7d8fb3', '#d9b25c', '#5f7a76'];

export default function Subscriptions({ clientUserId }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId);

  if (error) return <ErrorState onRetry={reload} />;
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
  const monthlySubsCost = subs.reduce((s, x) => s + (x.cycle === 'yearly' ? (x.amount || 0) / 12 : (x.amount || 0)), 0);
  const loansBalance = loans.reduce((s, l) => s + (l.current ?? l.total ?? 0), 0);
  const subShares = subs
    .map(s => ({ name: s.name, monthly: s.cycle === 'yearly' ? (s.amount || 0) / 12 : (s.amount || 0) }))
    .sort((a, b) => b.monthly - a.monthly);

  return (
    <div>
      {(subs.length > 0 || loans.length > 0) && (
        <div className={styles.rollup}>
          {subs.length > 0 && <span>{fmt(monthlySubsCost)} לחודש במנויים</span>}
          {subs.length > 0 && loans.length > 0 && <span className={styles.rollupSep}>·</span>}
          {loans.length > 0 && <span>{fmt(loansBalance)} יתרת הלוואות</span>}
        </div>
      )}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>מנויים</div>
        {subShares.length > 1 && (
          <div className={styles.miniBar}>
            {subShares.map((s, i) => (
              <div
                key={s.name}
                className={styles.miniBarSeg}
                style={{ width: (s.monthly / monthlySubsCost * 100) + '%', background: PALETTE[i % PALETTE.length] }}
                title={s.name}
              />
            ))}
          </div>
        )}
        {subs.length ? (
          <div className={styles.list}>
            {subs.map((s, i) => (
              <div key={s.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div className={styles.nameRow}>
                  {subShares.length > 1 && <span className={styles.dot} style={{ background: PALETTE[subShares.findIndex(x => x.name === s.name) % PALETTE.length] }} />}
                  <div>
                    <div className={styles.name}>{s.name}</div>
                    <div className={styles.meta}>{CYCLE_LABELS[s.cycle] || s.cycle}{s.nextDate ? ' · חידוש ' + s.nextDate : ''}</div>
                  </div>
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
