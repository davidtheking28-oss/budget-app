import styles from './Business.module.css';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const monthName = index => MONTHS[index];

export default function MonthPicker({ year, month, onChange, withYear = true }) {
  return (
    <div className={styles.toolbar}>
      {withYear && (
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnGhost} aria-label="שנה קודמת" onClick={() => onChange(year - 1, month)}>‹</button>
          <strong className={styles.num}>{year}</strong>
          <button type="button" className={styles.btnGhost} aria-label="שנה הבאה" onClick={() => onChange(year + 1, month)}>›</button>
        </div>
      )}
      {month !== null && (
        <div className={styles.months} role="group" aria-label="חודש">
          {MONTHS.map((name, i) => (
            <button key={name} type="button" className={i === month ? styles.monthOn : styles.month} aria-pressed={i === month} onClick={() => onChange(year, i)}>{name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
