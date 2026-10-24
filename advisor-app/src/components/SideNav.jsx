import Logo from './Logo.jsx';
import styles from './SideNav.module.css';

export default function SideNav({ clientName, clientSince, nav, activeNav, onNavChange }) {
  return (
    <aside className={styles.side}>
      <div className={styles.brand}><Logo size="sm" /><span>שקל שקל · יועץ</span></div>
      {clientName && (
        <div className={styles.client}>
          <div className={styles.clientName} title={clientName}>{clientName}</div>
          {clientSince && <div className={styles.clientSince}>לקוח מאז {clientSince}</div>}
        </div>
      )}
      <nav className={styles.nav} aria-label="ניווט לקוח">
        {nav.map((n, i) => (
          <div key={n.key}>
            {n.groupLabel && <div className={styles.group + (i === 0 ? ' ' + styles.groupFirst : '')}>{n.groupLabel}</div>}
            <button type="button" className={styles.item + (n.key === activeNav ? ' ' + styles.itemOn : '')} onClick={() => onNavChange(n.key)} aria-current={n.key === activeNav ? 'page' : undefined}>
              <span className={styles.icon} aria-hidden="true">{n.icon}</span>
              <span className={styles.itemText}>
                <span>{n.label}</span>
                {n.hint && <span className={styles.itemHint}>{n.hint}</span>}
              </span>
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
