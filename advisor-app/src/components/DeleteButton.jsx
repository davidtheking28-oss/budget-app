import styles from './DeleteButton.module.css';

export default function DeleteButton({ onClick, title = 'מחק' }) {
  return (
    <button className={styles.del} onClick={onClick} title={title} aria-label={title}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
