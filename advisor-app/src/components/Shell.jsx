import styles from './Shell.module.css';

export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, children }) {
  if (!nav) {
    return (
      <div className={styles.shell} dir="rtl">
        <div className={styles.topbar}>
          <div className={styles.logo}><span className={styles.logoMark}></span>Budget Advisor</div>
        </div>
        <div className={styles.content}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shellSidebar} dir="rtl">
      <aside className={styles.sidebar}>
        <div className={styles.logo}><span className={styles.logoMark}></span>Budget Advisor</div>
        {sidebarInfo}
        <nav className={styles.nav}>
          {nav.map(n => (
            <button
              key={n.key}
              className={styles.navItem + (n.key === activeNav ? ' ' + styles.navItemActive : '')}
              onClick={() => onNavChange(n.key)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <button className={styles.backButton} onClick={onBack}>← חזרה ללקוחות</button>
      </aside>
      <div className={styles.mainArea}>
        <div className={styles.contentSidebar}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
