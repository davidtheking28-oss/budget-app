import { useEffect, useState } from 'react';
import styles from './SearchBar.module.css';

export default function SearchBar({ onOpen }) {
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  return (
    <button type="button" className={styles.search} onClick={onOpen} aria-label="חיפוש לקוח">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span className={styles.placeholder}>חיפוש לקוח</span>
      <kbd className={styles.kbd}>{mac ? '⌘' : 'Ctrl'} K</kbd>
    </button>
  );
}
