import Logo from './Logo.jsx';
import styles from './IconRail.module.css';

const svgProps = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function IconRail({ onBack, onSearch, onPrint }) {
  const actions = [
    onBack && {
      key: 'clients',
      label: 'הלקוחות שלי',
      onClick: onBack,
      icon: <svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8" /><path d="M17 8.5a3 3 0 0 0 0 5" /><path d="M18.5 20c0-2.6-.9-4.4-2.3-5.4" /></svg>
    },
    onSearch && {
      key: 'search',
      label: 'חיפוש לקוח',
      onClick: onSearch,
      icon: <svg {...svgProps}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    },
    onPrint && {
      key: 'report',
      label: 'דוח חודשי',
      onClick: onPrint,
      icon: <svg {...svgProps}><path d="M6 9V2h9l3 3v4M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2" /><path d="M6 14h12v8H6z" /></svg>
    }
  ].filter(Boolean);

  return (
    <div className={styles.rail}>
      <div className={styles.mark} aria-hidden="true"><Logo /></div>
      <nav className={styles.actions} aria-label="פעולות">
        {actions.map(a => (
          <button key={a.key} type="button" className={styles.railBtn} onClick={a.onClick} title={a.label} aria-label={a.label}>
            {a.icon}
          </button>
        ))}
      </nav>
    </div>
  );
}
