import styles from './Logo.module.css';

export default function Logo({ size = 'sm' }) {
  return (
    <img className={styles.badge + ' ' + styles[size]} src="/logo.png" alt="" aria-hidden="true"/>
  );
}
