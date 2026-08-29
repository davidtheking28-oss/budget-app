import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { useAdvisorProfile } from '../auth/useAdvisorProfile.js';
import { monthSummary, effectiveLimit } from './budgetMath.js';
import { loanPayoffMonths, currentInstallments } from './Credit.jsx';
import { monthlyEquivalent } from './Subscriptions.jsx';
import { chartTheme } from '../categories.js';
import Logo from '../components/Logo.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Presentation.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');
const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function inSelectedMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

function Bar1({ label, value, max, over }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={styles.barRow}>
      <div className={styles.barLabelRow}>
        <span className={styles.barLabelName}>{label}</span>
        <span className={styles.barLabelValue}>{fmt(value)}{max > 0 ? ` / ${fmt(max)}` : ''}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill + (over ? ' ' + styles.barFillOver : '')} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

export default function Presentation({ clientUserId, advisorId, year, month, email, onClose }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId, advisorId);
  const { profile } = useAdvisorProfile(advisorId);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="200px" radius="14px" />
      </div>
    );
  }

  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const summary = monthSummary(data, year, month);
  const cats = Object.keys(data.budgets || {}).filter(c => data.budgets[c]).sort();
  const CT = chartTheme();
  const chartData = {
    labels: ['החודש'],
    datasets: [
      { label: 'הכנסה', data: [summary.income], backgroundColor: CT.green, borderRadius: 5 },
      { label: 'הוצאה', data: [summary.expense], backgroundColor: CT.red, borderRadius: 5 }
    ]
  };

  const subs = (data.subscriptions || []).filter(s => s.active);
  const subsRenewingThisMonth = subs.filter(s => inSelectedMonth(s.nextDate, year, month));

  const fixed = data.fixed_expenses || [];

  const loans = data.loans || [];
  const loansFinishingSoon = isCurrentMonth ? loans.filter(l => {
    const n = loanPayoffMonths(l.remaining, l.monthly, l.rate);
    return n !== null && n !== Infinity && n <= 1;
  }) : [];

  const payments = data.payments || [];
  const paymentsFinishingSoon = isCurrentMonth ? payments.filter(p => {
    const total = parseFloat(p.total) || 0;
    const left = Math.max(0, total - currentInstallments(p, total));
    return total > 0 && left === 1;
  }) : [];

  const goals = data.goals || [];
  const assets = data.assets || [];
  const assetsTotal = assets.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  const hasAnyData = cats.length > 0 || subs.length > 0 || fixed.length > 0 || loans.length > 0 || payments.length > 0 || goals.length > 0 || assets.length > 0;

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.topBar}>
        <Button variant="ghost" onClick={onClose}>סגור</Button>
      </div>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {profile?.logo_url ? <img className={styles.advisorLogo} src={profile.logo_url} alt="" /> : <Logo size="sm" />}
          <div>
            <h1 className={styles.title}>{profile?.display_name ? `${profile.display_name} · תמונת מצב` : 'תמונת מצב'}</h1>
            <div className={styles.sub}>{email}</div>
          </div>
        </div>
        <div className={styles.sub}>{MONTH_NAMES[month]} {year}</div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}><div className={styles.statLabel}>הכנסות</div><div className={styles.statValue + ' ' + styles.income}>{fmt(summary.income)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>הוצאות</div><div className={styles.statValue + ' ' + styles.expense}>{fmt(summary.expense)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>תזרים</div><div className={styles.statValue + ' ' + (summary.net < 0 ? styles.expense : styles.net)}>{fmt(summary.net)}</div></div>
      </div>

      <div className={styles.chartCard}>
        <Bar
          data={chartData}
          options={{
            maintainAspectRatio: false,
            indexAxis: 'y',
            animation: ChartJS.defaults.animation === false ? false : { duration: 600, easing: 'easeOutQuart' },
            scales: {
              x: { reverse: true, ticks: { color: CT.text2, font: { family: CT.font } }, grid: { color: CT.border } },
              y: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: CT.text2, font: { family: CT.font } } } }
          }}
        />
      </div>

      {!hasAnyData && (
        <div className={styles.section}>
          <div className={styles.sub}>אין עדיין נתונים להצגה עבור {MONTH_NAMES[month]} {year}</div>
        </div>
      )}

      {cats.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>תקציב מול ביצוע</h2>
          {cats.map(c => {
            const limit = effectiveLimit(data, c, year, month);
            const spent = summary.spentByCat[c] || 0;
            return <Bar1 key={c} label={c} value={spent} max={limit} over={limit > 0 && spent > limit} />;
          })}
        </div>
      )}

      {subs.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>מנויים פעילים</h2>
          {subs.map(s => (
            <div key={s.id} className={styles.listRow}>
              <div>
                <div className={styles.listName}>{s.name}{subsRenewingThisMonth.includes(s) && <span className={styles.soonBadge}>מתחדש החודש</span>}</div>
              </div>
              <div className={styles.listAmount}>{fmt(monthlyEquivalent(s.cycle, s.amount || 0))}</div>
            </div>
          ))}
        </div>
      )}

      {fixed.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>הוצאות קבועות</h2>
          {fixed.map(f => (
            <div key={f.id} className={styles.listRow}>
              <div className={styles.listName}>{f.id}</div>
              <div className={styles.listAmount}>{fmt(f.amount || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {loans.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>הלוואות</h2>
          {loans.map(l => (
            <div key={l.id} className={styles.listRow}>
              <div>
                <div className={styles.listName}>{l.name}{loansFinishingSoon.includes(l) && <span className={styles.soonBadge}>מסתיימת בקרוב</span>}</div>
                <div className={styles.listMeta}>{l.lender}</div>
              </div>
              <div className={styles.listAmount}>{fmt(l.monthly || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {payments.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>תשלומים בכרטיס אשראי</h2>
          {payments.map(p => (
            <div key={p.id} className={styles.listRow}>
              <div>
                <div className={styles.listName}>{p.name}{paymentsFinishingSoon.includes(p) && <span className={styles.soonBadge}>תשלום אחרון</span>}</div>
              </div>
              <div className={styles.listAmount}>{fmt(p.amount || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {goals.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>יעדי חיסכון</h2>
          {goals.map(g => <Bar1 key={g.id} label={g.name} value={g.saved || 0} max={g.target || 0} over={false} />)}
        </div>
      )}

      {assets.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>נכסים <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· סה״כ {fmt(assetsTotal)}</span></h2>
          {assets.map(a => (
            <div key={a.id} className={styles.listRow}>
              <div>
                <div className={styles.listName}>{a.name}</div>
                <div className={styles.listMeta}>{a.category}</div>
              </div>
              <div className={styles.listAmount}>{fmt(a.amount || 0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
