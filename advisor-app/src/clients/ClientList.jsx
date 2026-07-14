import { useClientList } from './useClientList.js';
import styles from './ClientList.module.css';

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading } = useClientList(advisorId);

  if (loading) return null;
  if (!clients.length) {
    return <div className={styles.empty}>אין עדיין לקוחות מחוברים</div>;
  }

  return (
    <div className={styles.list}>
      {clients.map(c => (
        <div key={c.id} className={styles.row} onClick={() => onSelect(c.client_id, c.client_email)}>
          <div className={styles.email}>{c.client_email}</div>
          <div className={styles.arrow}>כניסה לתקציב ←</div>
        </div>
      ))}
    </div>
  );
}
