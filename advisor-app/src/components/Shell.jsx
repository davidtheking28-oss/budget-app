import styles from './Shell.module.css';

export default function Shell({ title, right, children }) {
  return (
    <div className={styles.shell} dir="rtl">
      <div className={styles.topbar}>
        <div className={styles.logo}>Velora Advisor</div>
        {right}
      </div>
      <div className={styles.content}>
        {title && <h1>{title}</h1>}
        {children}
      </div>
    </div>
  );
}
