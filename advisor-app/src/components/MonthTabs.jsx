import { MONTH_NAMES } from '../budget/monthUtils.js';
import styles from './MonthTabs.module.css';

export default function MonthTabs({ month, onSelectMonth }) {
  return (
    <div className={styles.monthTabs}>
      {MONTH_NAMES.map((name, i) => (
        <button
          key={i}
          type="button"
          className={styles.monthTab + (i === month ? ' ' + styles.monthTabActive : '')}
          onClick={() => onSelectMonth(i)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
