import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Goals.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Goals({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);

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
    return <div className={styles.empty}>הלקוח עדיין לא הגדיר יעדי חיסכון</div>;
  }

  return (
    <div className={styles.list}>
      {goals.map(g => {
        const pct = g.target ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
        return (
          <div key={g.id} className={styles.item}>
            <div className={styles.top}>
              <div className={styles.name}>{g.name}</div>
              <div className={styles.amounts}>{fmt(g.saved || 0)} / {fmt(g.target || 0)}</div>
            </div>
            <div className={styles.bar}><div className={styles.fill} style={{ width: pct + '%' }} /></div>
            <div className={styles.meta}>{pct}% הושלם{g.months ? ' · יעד ל-' + g.months + ' חודשים' : ''}</div>
          </div>
        );
      })}
    </div>
  );
}
