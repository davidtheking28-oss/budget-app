import styles from './Business.module.css';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const monthName = index => MONTHS[index];
export const MONTH_NAMES = MONTHS;

export function yearOptions(center = new Date().getFullYear()) {
  return Array.from({ length: 7 }, (_, i) => center - 4 + i);
}

export default function MonthPicker({ year, month, onChange, withMonth = true }) {
  function step(delta) {
    if (!withMonth) { onChange(year + delta, month); return; }
    const total = year * 12 + month + delta;
    onChange(Math.floor(total / 12), ((total % 12) + 12) % 12);
  }
  return (
    <div className={styles.periodPicker} role="group" aria-label={withMonth ? 'בחירת חודש ושנה' : 'בחירת שנה'}>
      <button type="button" className={styles.iconBtn} aria-label={withMonth ? 'החודש הקודם' : 'השנה הקודמת'} onClick={() => step(-1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
      {withMonth && (
        <select className={styles.select} aria-label="חודש" value={month} onChange={e => onChange(year, parseInt(e.target.value, 10))}>
          {MONTHS.map((name, i) => <option key={name} value={i}>{name}</option>)}
        </select>
      )}
      <select className={styles.select} aria-label="שנה" value={year} onChange={e => onChange(parseInt(e.target.value, 10), month)}>
        {yearOptions().map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <button type="button" className={styles.iconBtn} aria-label={withMonth ? 'החודש הבא' : 'השנה הבאה'} onClick={() => step(1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button>
    </div>
  );
}
