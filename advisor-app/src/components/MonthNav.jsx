import styles from './MonthNav.module.css';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function MonthNav({ year, month, onChange, onReset, email }) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  return (
    <div className={styles.wrap}>
      {email && <div className={styles.email}>{email}</div>}
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
