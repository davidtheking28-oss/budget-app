import { useEffect, useRef, useState } from 'react';
import styles from './ActionMenu.module.css';

export default function ActionMenu({ children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function closeOutside(e) { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  return <details ref={ref} data-actions className={styles.actions} onToggle={e => setOpen(e.currentTarget.open)} onClickCapture={e => { if (e.target.closest('button')) setTimeout(() => { if (ref.current) ref.current.open = false; }, 0); }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ref.current.open = false; ref.current.querySelector('summary').focus(); } }}>
    <summary aria-label="פעולות נוספות">⋯</summary>
    <div className={styles.items}>{children}</div>
  </details>;
}
