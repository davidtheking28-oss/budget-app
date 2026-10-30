import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Business.module.css';

export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div className={styles.overlay} dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal + (wide ? ' ' + styles.modalWide : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className={styles.modalHead}>
          <h3 className={styles.cardTitle}>{title}</h3>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="סגור">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
