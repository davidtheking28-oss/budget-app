import { useClientList } from './useClientList.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './ClientList.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

function RemainingChip({ value }) {
  const display = useCountUp(value ?? 0);
  if (value === null) return null;
  return <div className={styles.remaining}>{fmt(display)} נותר</div>;
}

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading } = useClientList(advisorId);

  if (loading) {
    return (
      <div className={styles.list}>
        {[0, 1, 2].map(i => (
          <div key={i} className={styles.row}>
            <Skeleton width="42px" height="42px" radius="50%" />
            <Skeleton width="160px" />
          </div>
        ))}
      </div>
    );
  }

  if (!clients.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyMark}></div>
        אין עדיין לקוחות מחוברים
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {clients.map((c, i) => (
        <div
          key={c.id}
          className={styles.row}
          style={{ animationDelay: (i * 0.04) + 's' }}
          onClick={() => onSelect(c.client_id, c.client_email)}
        >
          <div className={styles.avatar}>{initials(c.client_email)}</div>
          <div className={styles.info}>
            <div className={styles.email}>{c.client_email}</div>
            <div className={styles.chips}>
              <RemainingChip value={c.remaining} />
              {c.hasOverage && <div className={styles.overageChip}>חריגת תקציב</div>}
              {c.openTasks > 0 && <div className={styles.taskChip}>{c.openTasks} משימות פתוחות</div>}
            </div>
          </div>
          <div className={styles.arrow}>כניסה לתקציב ←</div>
        </div>
      ))}
    </div>
  );
}
