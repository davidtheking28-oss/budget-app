import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights, computeHealthScore } from './insights.js';
import Logo from '../components/Logo.jsx';
import styles from './Report.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Report({ clientUserId, year, month, email, onClose }) {
  const { data, loading } = useClientBudget(clientUserId);
  if (loading || !data) return null;

  const summary = monthSummary(data, year, month);
  const insights = computeInsights(data, year, month);
  const healthScore = computeHealthScore(data, year, month);
  const healthLabel = healthScore >= 75 ? 'מצב תקין' : healthScore >= 45 ? 'דורש תשומת לב' : 'דורש טיפול';
  const cats = Object.keys(data.budgets || {}).filter(c => data.budgets[c]).sort();

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.printButton}>
        <button onClick={() => window.print()}>הדפס</button>
        <button className={styles.closeButton} onClick={onClose}>סגור</button>
      </div>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Logo size="sm" />
          <div>
            <div className={styles.title}>דוח חודשי</div>
            <div className={styles.sub}>{email}</div>
          </div>
        </div>
        <div className={styles.sub}>{MONTH_NAMES[month]} {year}</div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}><div className={styles.statLabel}>הכנסות</div><div className={styles.statValue}>{fmt(summary.income)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>הוצאות</div><div className={styles.statValue}>{fmt(summary.expense)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>מאזן</div><div className={styles.statValue}>{fmt(summary.net)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>ציון בריאות</div><div className={styles.statValue}>{healthScore} · {healthLabel}</div></div>
      </div>

      {cats.length > 0 && (
        <>
          <div className={styles.sectionTitle}>תקציב מול ביצוע</div>
          <table>
            <thead><tr><th>קטגוריה</th><th>תקציב</th><th>בפועל</th></tr></thead>
            <tbody>
              {cats.map(c => (
                <tr key={c}>
                  <td>{c}</td>
                  <td>{fmt(data.budgets[c])}</td>
                  <td>{fmt(summary.spentByCat[c] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {insights.length > 0 && (
        <>
          <div className={styles.sectionTitle}>תובנות</div>
          {insights.map((ins, i) => <div key={i} className={styles.insight}>{ins.text}</div>)}
        </>
      )}

      {(data.goals || []).length > 0 && (
        <>
          <div className={styles.sectionTitle}>יעדי חיסכון</div>
          <table>
            <thead><tr><th>יעד</th><th>נחסך</th><th>מטרה</th></tr></thead>
            <tbody>
              {data.goals.map(g => (
                <tr key={g.id}><td>{g.name}</td><td>{fmt(g.saved || 0)}</td><td>{fmt(g.target || 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
