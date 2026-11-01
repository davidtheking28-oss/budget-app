import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Business.module.css';

export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    const onKey = e => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      const controls = [...ref.current.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el => el.tabIndex >= 0 && el.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { e.preventDefault(); ref.current.focus(); return; }
      if (!ref.current.contains(document.activeElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);
  return createPortal(
    <div className={styles.overlay} dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal + (wide ? ' ' + styles.modalWide : '')} role="dialog" tabIndex={-1} aria-modal="true" aria-label={title} ref={ref}>
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
