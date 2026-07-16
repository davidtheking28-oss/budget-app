import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Goals.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Goals({ clientUserId }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div className={styles.list}>
        <Skeleton height="90px" radius="14px" />
        <Skeleton height="90px" radius="14px" />
      </div>
    );
  }

  const goals = data.goals || [];
  if (!goals.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyMark}></div>
        הלקוח עדיין לא הגדיר יעדי חיסכון
      </div>
    );
  }

  const totalSaved = goals.reduce((s, g) => s + (g.saved || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + (g.target || 0), 0);

  return (
    <div>
      <div className={styles.rollup}>{`${goals.length} יעדים פעילים · נחסכו ${fmt(totalSaved)} מתוך ${fmt(totalTarget)}`}</div>
      <div className={styles.list}>
      {goals.map((g, i) => {
        const pct = g.target ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
        return (
          <div key={g.id} className={styles.item} style={{ animationDelay: Math.min(i * 0.05, 0.3) + 's' }}>
            <div className={styles.top}>
              <div className={styles.name}>{g.name}</div>
              <div className={styles.amounts}>{fmt(g.saved || 0)} / {fmt(g.target || 0)}</div>
            </div>
            <div className={styles.bar}>
              <div className={styles.fill} style={{ width: pct + '%' }}>
                {pct >= 12 && <span className={styles.fillPct}>{pct}%</span>}
              </div>
              {pct < 12 && <span className={styles.pctOutside} style={{ insetInlineStart: `calc(${pct}% + 6px)` }}>{pct}%</span>}
            </div>
            {g.months && <div className={styles.meta}>יעד ל-{g.months} חודשים</div>}
          </div>
        );
      })}
      </div>
    </div>
  );
}
