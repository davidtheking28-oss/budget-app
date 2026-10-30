import Logo from './Logo.jsx';
import AccessibilityButton from './AccessibilityButton.jsx';
import LegalLinks from './LegalLinks.jsx';
import styles from './SideNav.module.css';

export default function SideNav({ nav, activeNav, onNavChange, footer }) {
  return (
    <aside className={styles.side}>
      <div className={styles.brand}><Logo size="sm" /><span>שקל שקל · יועץ</span></div>
      <nav className={styles.nav} aria-label="ניווט מחלקה">
        {nav.map((n, i) => (
          <div key={n.key}>
            {n.groupLabel && <div className={styles.group + (i === 0 ? ' ' + styles.groupFirst : '')}>{n.groupLabel}</div>}
            <button type="button" className={styles.item + (n.key === activeNav ? ' ' + styles.itemOn : '')} onClick={() => onNavChange(n.key)} aria-current={n.key === activeNav ? 'page' : undefined} title={n.hint}>
              <span className={styles.icon} aria-hidden="true">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          </div>
        ))}
      </nav>
      {footer && <div className={styles.footer}>{footer}</div>}
      <LegalLinks />
      <AccessibilityButton />
    </aside>
  );
}
