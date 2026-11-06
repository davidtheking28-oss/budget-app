import styles from './CategorySelect.module.css';

export default function CategorySelect({ label, value, options, onChange, prominent = false }) {
  const selected = options.find(option => option.key === value);
  return (
    <div className={styles.wrap + (prominent ? ' ' + styles.prominent : '') + (selected?.icon ? ' ' + styles.withIcon : '')}>
      {selected?.icon && <span className={styles.icon} aria-hidden="true">{selected.icon}</span>}
      <select className={styles.select} aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
      <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}
