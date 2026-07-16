import { useEffect, useState } from 'react';
import { subscribeToast } from '../toast.js';
import styles from './Toaster.module.css';

const ICONS = {
  success: <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>,
  error: <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  info: <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8v6M12 17.5v.01" /></svg>
};

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeToast(item => {
    setItems(prev => [...prev, item]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), item.action ? 5000 : 3200);
  }), []);

  if (!items.length) return null;

  return (
    <div className={styles.wrap} dir="rtl" role="status" aria-live="polite" aria-atomic="true">
      {items.map(i => (
        <div key={i.id} className={styles.toast + ' ' + styles[i.kind]}>
          <span className={styles.icon}>{ICONS[i.kind] || ICONS.info}</span>
          <span>{i.message}</span>
          {i.action && (
            <button
              className={styles.undo}
              onClick={() => { i.action.onClick(); setItems(prev => prev.filter(x => x.id !== i.id)); }}
            >
              {i.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
