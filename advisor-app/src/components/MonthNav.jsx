import styles from './MonthNav.module.css';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function MonthNav({ year, month, onChange, onReset, email, nextMeeting, openTasks }) {
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
      {openTasks > 0 && (
        <div className={styles.openTasks}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {openTasks} משימות פתוחות
        </div>
      )}
      <div className={styles.row}>
        <button className={styles.arrow} onClick={() => onChange(-1)} aria-label="חודש קודם">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <button
          type="button"
          className={styles.label}
          onClick={onReset}
          disabled={isCurrent}
          aria-label={isCurrent ? undefined : 'חזרה לחודש הנוכחי'}
        >
          {MONTH_NAMES[month]} {year}
        </button>
        <button className={styles.arrow} onClick={() => onChange(1)} aria-label="חודש הבא">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
