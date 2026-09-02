import styles from './ModuleHeader.module.css';

export default function ModuleHeader({ icon, title, subtitle, right }) {
  return (
    <div className={styles.brandHeader}>
      <div className={styles.brandHeaderLeft}>
        <span className={styles.brandIcon} aria-hidden="true">{icon}</span>
        <div>
          <div className={styles.brandTitle}>{title}</div>
          <div className={styles.brandSub}>{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}
