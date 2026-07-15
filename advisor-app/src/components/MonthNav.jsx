import styles from './MonthNav.module.css';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function MonthNav({ year, month, onChange, onReset, email, nextMeeting }) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  return (
    <div className={styles.wrap}>
      {email && <div className={styles.email}>{email}</div>}
      {nextMeeting && (
        <div className={styles.nextMeeting}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {new Date(nextMeeting).toLocaleString('he-IL')}
        </div>
      )}
      <div className={styles.row}>
        <button className={styles.arrow} onClick={() => onChange(-1)} aria-label="חודש קודם">▶</button>
        <div className={styles.label} onClick={isCurrent ? undefined : onReset} style={{ cursor: isCurrent ? 'default' : 'pointer' }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button className={styles.arrow} onClick={() => onChange(1)} aria-label="חודש הבא">◀</button>
      </div>
    </div>
  );
}
