import { useEffect, useState } from 'react';
import { subscribeToast } from '../toast.js';
import styles from './Toaster.module.css';

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeToast(item => {
    setItems(prev => [...prev, item]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), item.action ? 5000 : 3200);
  }), []);

  if (!items.length) return null;

  return (
    <div className={styles.wrap} dir="rtl">
      {items.map(i => (
        <div key={i.id} className={styles.toast + ' ' + styles[i.kind]}>
          <span className={styles.icon}>{i.kind === 'success' ? '✓' : i.kind === 'error' ? '✕' : 'i'}</span>
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
