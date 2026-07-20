import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { CHART_PALETTE } from '../categories.js';
import styles from './Subscriptions.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const CYCLE_LABELS = { monthly: 'חודשי', yearly: 'שנתי' };
const AUTO_FIXED_CATS = ['החזר הלוואות + חיוב קבוע', 'עסקאות בתשלומים', 'מנויים ושירותים'];
const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

function loanPayoffMonths(remaining, monthly, annualRate) {
  if (!remaining || !monthly || remaining <= 0 || monthly <= 0) return null;
  const r = (annualRate || 0) / 1200;
  if (r <= 0) return Math.ceil(remaining / monthly);
  if (monthly <= remaining * r) return Infinity;
  return Math.ceil(Math.log(monthly / (monthly - remaining * r)) / Math.log(1 + r));
}

function loanPayoffLabel(l) {
  const n = loanPayoffMonths(l.remaining, l.monthly, l.rate);
  if (n === null) return null;
  if (n === Infinity) return { text: 'ההחזר לא מכסה את הריבית, היתרה תגדל', danger: true };
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return { text: `סילוק משוער: ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`, danger: false };
}

const ICONS = {
  subs: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg>,
  loans: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 3.5" /></svg>,
  payments: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>,
  fixed: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7" /><path d="M5 10v9h14v-9" /></svg>
};

export default function Subscriptions({ clientUserId }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="60px" radius="8px" style={{ marginBottom: 10 }} />
        <Skeleton height="60px" radius="8px" />
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
        <div className={styles.statStrip}>
          {subs.length > 0 && <div className={styles.stat}><div className={styles.statValue}>{fmt(monthlySubsCost)}</div><div className={styles.statLabel}>לחודש במנויים</div></div>}
          {loans.length > 0 && <div className={styles.stat}><div className={styles.statValue}>{fmt(loansBalance)}</div><div className={styles.statLabel}>יתרת הלוואות</div></div>}
          {payments.length > 0 && <div className={styles.stat}><div className={styles.statValue}>{fmt(paymentsLeft)}</div><div className={styles.statLabel}>יתרת תשלומים</div></div>}
          {fixedExpenses.length > 0 && <div className={styles.stat}><div className={styles.statValue}>{fmt(fixedMonthly)}</div><div className={styles.statLabel}>לחודש בהוצאות קבועות</div></div>}
        </div>
      )}
      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconSubs}>{ICONS.subs}</span>מנויים</div>
        {subShares.length > 1 && (
          <div className={styles.miniBar}>
            {subShares.map((s, i) => (
              <div
                key={s.name}
                className={styles.miniBarSeg}
                style={{ width: (s.monthly / monthlySubsCost * 100) + '%', background: CHART_PALETTE[i % CHART_PALETTE.length] }}
                title={s.name}
              />
            ))}
          </div>
        )}
        {subs.length ? (
          <div className={styles.list}>
            {subs.map((s, i) => {
              const days = daysUntil(s.nextDate);
              const soon = days !== null && days >= 0 && days <= 7;
              const overdue = days !== null && days < 0;
              return (
                <div key={s.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                  <div className={styles.nameRow}>
                    {subShares.length > 1 && <span className={styles.dot} style={{ background: CHART_PALETTE[subShares.findIndex(x => x.name === s.name) % CHART_PALETTE.length] }} />}
                    <div>
                      <div className={styles.name}>{s.name}{overdue && <span className={styles.overdueBadge}>באיחור</span>}{soon && <span className={styles.soonBadge}>בעוד {days === 0 ? 'היום' : days + ' ימים'}</span>}</div>
                      <div className={styles.meta}>{CYCLE_LABELS[s.cycle] || s.cycle}{s.nextDate ? ' · חידוש ' + s.nextDate : ''}</div>
                    </div>
                  </div>
                  <div className={styles.amount}>{fmt(s.amount || 0)}</div>
                </div>
              );
            })}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.subs}</span>אין מנויים רשומים</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconLoans}>{ICONS.loans}</span>הלוואות{loansMonthly > 0 ? ` · ${fmt(loansMonthly)} לחודש` : ''}</div>
        {loans.length ? (
          <div className={styles.grid}>
            {loans.map((l, i) => {
              const pct = l.original ? Math.min(100, Math.max(0, Math.round(((l.original - (l.remaining || 0)) / l.original) * 100))) : null;
              const payoff = loanPayoffLabel(l);
              return (
                <div key={l.id} className={pct !== null ? `${styles.row} ${styles.rowCard} ${styles.rowStacked} ${styles.rowWide}` : `${styles.row} ${styles.rowCard}`} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                  <div className={styles.rowMain}>
                    <div>
                      <div className={styles.name}>{l.name || 'הלוואה'}</div>
                      <div className={styles.meta}>{l.lender ? l.lender + ' · ' : ''}{l.remaining !== undefined ? 'יתרה ' + fmt(l.remaining) + (l.original ? ' מתוך ' + fmt(l.original) : '') : ''}</div>
                    </div>
                    <div className={styles.amount}>{fmt(l.monthly || 0)}</div>
                  </div>
                  {pct !== null && (
                    <div className={styles.loanBar}>
                      <div className={styles.loanBarFill} style={{ transform: `scaleX(${pct / 100})` }} />
                    </div>
                  )}
                  {payoff && <div className={payoff.danger ? styles.payoffDanger : styles.payoffLabel}>{payoff.text}</div>}
                </div>
              );
            })}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.loans}</span>אין הלוואות רשומות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconPayments}>{ICONS.payments}</span>תשלומים בכרטיס אשראי</div>
        {payments.length ? (
          <div className={styles.list}>
            {payments.map((p, i) => {
              const total = parseFloat(p.total) || 0;
              const cur = parseFloat(p.current) || 0;
              const left = Math.max(0, total - cur);
              const done = total > 0 && left <= 0;
              return (
                <div key={p.id} className={styles.row + (done ? ' ' + styles.rowDone : '')} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                  <div>
                    <div className={styles.name}>{p.name || 'תשלום'}{done && <span className={styles.doneBadge}><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg> הושלם</span>}</div>
                    <div className={styles.meta}>{total ? `נותרו ${left} מתוך ${total} תשלומים` : ''}</div>
                  </div>
                  <div className={styles.amount}>{fmt(left * (parseFloat(p.amount) || 0))}</div>
                </div>
              );
            })}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.payments}</span>אין תשלומים רשומים</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconFixed}>{ICONS.fixed}</span>הוצאות קבועות{fixedMonthly > 0 ? ` · ${fmt(fixedMonthly)} לחודש` : ''}</div>
        {fixedExpenses.length ? (
          <div className={styles.list}>
            {fixedExpenses.map((f, i) => (
              <div key={f.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div className={styles.name}>{f.id}{AUTO_FIXED_CATS.includes(f.id) && <span className={styles.autoBadge}>אוטומטי</span>}</div>
                <div className={styles.amount}>{fmt(f.amount || 0)}</div>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.fixed}</span>אין הוצאות קבועות רשומות</div>}
      </div>
    </div>
  );
}
