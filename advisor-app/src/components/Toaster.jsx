import { useEffect, useState } from 'react';
import { subscribeToast } from '../toast.js';
import styles from './Toaster.module.css';

const ICONS = {
  success: <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>,
  error: <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  info: <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8v6M12 17.5v.01" /></svg>
};

const EXIT_MS = 220;

export default function Toaster() {
  const [items, setItems] = useState([]);
  const [leaving, setLeaving] = useState(() => new Set());

  function dismiss(id) {
    setLeaving(prev => new Set(prev).add(id));
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), EXIT_MS);
  }

  useEffect(() => subscribeToast(item => {
    setItems(prev => [...prev, item]);
    setTimeout(() => dismiss(item.id), item.action ? 5000 : 3200);
  }), []);

  if (!items.length) return null;

  return (
    <div className={styles.wrap} dir="rtl" role="status" aria-live="polite" aria-atomic="true">
      {items.map(i => (
        <div key={i.id} className={styles.toast + ' ' + styles[i.kind] + (leaving.has(i.id) ? ' ' + styles.toastLeaving : '')}>
          <span className={styles.icon}>{ICONS[i.kind] || ICONS.info}</span>
          <span>{i.message}</span>
          {i.action && (
            <button
              className={styles.undo}
              onClick={() => { i.action.onClick(); dismiss(i.id); }}
            >
              {i.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
