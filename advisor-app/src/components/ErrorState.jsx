import styles from './ErrorState.module.css';

export default function ErrorState({ message = 'משהו השתבש בטעינת הנתונים', onRetry }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.mark}>!</div>
      <div className={styles.text}>{message}</div>
      {onRetry && <button className={styles.retry} onClick={onRetry}>נסה שוב</button>}
    </div>
  );
}
