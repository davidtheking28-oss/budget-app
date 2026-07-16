import styles from './Logo.module.css';

export default function Logo({ size = 'sm' }) {
  return (
    <span className={styles.badge + ' ' + styles[size]} aria-hidden="true">B</span>
  );
}
