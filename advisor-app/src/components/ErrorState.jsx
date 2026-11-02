import styles from './ErrorState.module.css';

export default function ErrorState({ message = 'משהו השתבש בטעינת הנתונים', onRetry }) {
  return (
    <div className={styles.wrap} role="alert">
      <div className={styles.mark} aria-hidden="true">!</div>
      <div className={styles.text}>{message}</div>
      {onRetry && <button type="button" className={styles.retry} onClick={onRetry}>נסה שוב</button>}
    </div>
  );
}
