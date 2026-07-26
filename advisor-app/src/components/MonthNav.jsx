import styles from './MonthNav.module.css';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function MonthNav({ year, month, onChange, onReset }) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  return (
    <div className={styles.wrap}>
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
