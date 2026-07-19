import { useEffect } from 'react';
import Logo from './Logo.jsx';
import styles from './Shell.module.css';

export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, children }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeNav]);

  if (!nav) {
    return (
      <div className={styles.shell} dir="rtl">
        <div className={styles.topbar}>
          <div className={styles.logo}><Logo />Budget Advisor</div>
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
        <div className={styles.logo}><Logo />Budget Advisor</div>
        {sidebarInfo}
        {onPrint && (
          <button className={styles.reportButton} onClick={onPrint}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9V2h9l3 3v4M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2" />
              <path d="M6 14h12v8H6z" />
            </svg>
            דוח חודשי
          </button>
        )}
        <nav className={styles.nav}>
          {nav.map(n => (
            <button
              key={n.key}
              className={styles.navItem + (n.key === activeNav ? ' ' + styles.navItemActive : '')}
              onClick={() => onNavChange(n.key)}
            >
              {n.icon && <span className={styles.navIcon} aria-hidden="true">{n.icon}</span>}
              {n.label}
            </button>
          ))}
        </nav>
        <button className={styles.backButton} onClick={onBack}>→ חזרה ללקוחות</button>
      </aside>
      <div className={styles.mainArea}>
        <div className={styles.contentSidebar} key={activeNav}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
