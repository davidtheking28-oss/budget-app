import styles from './Shell.module.css';

export default function Shell({ title, right, onBack, tabs, activeTab, onTabChange, children }) {
  return (
    <div className={styles.shell} dir="rtl">
      <div className={styles.topbar}>
        <div className={styles.logo}><span className={styles.logoMark}></span>Budget Advisor</div>
        {onBack ? <button className={styles.backButton} onClick={onBack}>← חזרה ללקוחות</button> : right}
      </div>
      {tabs && (
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t}
              className={styles.tab + (t === activeTab ? ' ' + styles.tabActive : '')}
              onClick={() => onTabChange(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className={styles.content}>
        {title && <h1>{title}</h1>}
        {children}
      </div>
    </div>
  );
}
