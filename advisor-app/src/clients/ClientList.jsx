import { useClientList } from './useClientList.js';
import styles from './ClientList.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading } = useClientList(advisorId);

  if (loading) return null;
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
          <div className={styles.email}>{c.client_email}</div>
          <div className={styles.arrow}>כניסה לתקציב ←</div>
        </div>
      ))}
    </div>
  );
}
