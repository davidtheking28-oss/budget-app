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
  const payments = data.payments || [];
  const fixedExpenses = data.fixed_expenses || [];
  const monthlySubsCost = subs.reduce((s, x) => s + (x.cycle === 'yearly' ? (x.amount || 0) / 12 : (x.amount || 0)), 0);
  const loansBalance = loans.reduce((s, l) => s + (l.remaining || 0), 0);
  const loansMonthly = loans.reduce((s, l) => s + (l.monthly || 0), 0);
  const paymentsLeft = payments.reduce((s, p) => s + Math.max(0, (parseFloat(p.total) || 0) - (parseFloat(p.current) || 0)) * (parseFloat(p.amount) || 0), 0);
  const fixedMonthly = fixedExpenses.reduce((s, f) => s + (f.amount || 0), 0);
  const subShares = subs
    .map(s => ({ name: s.name, monthly: s.cycle === 'yearly' ? (s.amount || 0) / 12 : (s.amount || 0) }))
    .sort((a, b) => b.monthly - a.monthly);
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const renewingSoon = subs.filter(s => s.nextDate && new Date(s.nextDate) <= in7Days && new Date(s.nextDate) >= new Date());

  return (
    <div>
      {renewingSoon.length > 0 && (
        <div className={styles.renewalBanner}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {renewingSoon.map(s => `${s.name} מתחדש ב-${s.nextDate}`).join(' · ')}
        </div>
      )}
      {(subs.length > 0 || loans.length > 0 || payments.length > 0 || fixedExpenses.length > 0) && (
        <div className={styles.rollup}>
          {subs.length > 0 && <div className={styles.rollupChip}>{fmt(monthlySubsCost)} לחודש במנויים</div>}
          {loans.length > 0 && <div className={styles.rollupChip}>{fmt(loansBalance)} יתרת הלוואות</div>}
          {payments.length > 0 && <div className={styles.rollupChip}>{fmt(paymentsLeft)} יתרת תשלומים</div>}
          {fixedExpenses.length > 0 && <div className={styles.rollupChip}>{fmt(fixedMonthly)} לחודש בהוצאות קבועות</div>}
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
        <div className={styles.sectionTitle}>הלוואות{loansMonthly > 0 ? ` · ${fmt(loansMonthly)} לחודש` : ''}</div>
        {loans.length ? (
          <div className={styles.list}>
            {loans.map((l, i) => {
              const pct = l.original ? Math.min(100, Math.max(0, Math.round(((l.original - (l.remaining || 0)) / l.original) * 100))) : null;
              return (
                <div key={l.id} className={pct !== null ? `${styles.row} ${styles.rowStacked}` : styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                  <div className={styles.rowMain}>
                    <div>
                      <div className={styles.name}>{l.name || 'הלוואה'}</div>
                      <div className={styles.meta}>{l.lender ? l.lender + ' · ' : ''}{l.remaining !== undefined ? 'יתרה ' + fmt(l.remaining) + (l.original ? ' מתוך ' + fmt(l.original) : '') : ''}</div>
                    </div>
                    <div className={styles.amount}>{fmt(l.monthly || 0)}</div>
                  </div>
                  {pct !== null && (
                    <div className={styles.loanBar}>
                      <div className={styles.loanBarFill} style={{ width: pct + '%' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : <div className={styles.empty}>אין הלוואות רשומות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>תשלומים בכרטיס אשראי</div>
        {payments.length ? (
          <div className={styles.list}>
            {payments.map((p, i) => {
              const total = parseFloat(p.total) || 0;
              const cur = parseFloat(p.current) || 0;
              const left = Math.max(0, total - cur);
              return (
                <div key={p.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                  <div>
                    <div className={styles.name}>{p.name || 'תשלום'}</div>
                    <div className={styles.meta}>{total ? `נותרו ${left} מתוך ${total} תשלומים` : ''}</div>
                  </div>
                  <div className={styles.amount}>{fmt(left * (parseFloat(p.amount) || 0))}</div>
                </div>
              );
            })}
          </div>
        ) : <div className={styles.empty}>אין תשלומים רשומים</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>הוצאות קבועות{fixedMonthly > 0 ? ` · ${fmt(fixedMonthly)} לחודש` : ''}</div>
        {fixedExpenses.length ? (
          <div className={styles.list}>
            {fixedExpenses.map((f, i) => (
              <div key={f.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div className={styles.name}>{f.id}</div>
                <div className={styles.amount}>{fmt(f.amount || 0)}</div>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין הוצאות קבועות רשומות</div>}
      </div>
    </div>
  );
}
