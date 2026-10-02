import { useEffect, useRef, useState } from 'react';
import styles from './AddForm.module.css';

export default function AddForm({ label, open: forceOpen = false, openSignal = 0, className, children }) {
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (openSignal) { setOpen(true); setFocusOnOpen(true); }
  }, [openSignal]);

  useEffect(() => {
    if (!focusOnOpen || !(open || forceOpen)) return;
    formRef.current?.querySelector('input, textarea, select')?.focus();
    setFocusOnOpen(false);
  }, [focusOnOpen, open, forceOpen]);

  if (!open && !forceOpen) {
    return (
      <button type="button" className={styles.trigger} onClick={() => { setOpen(true); setFocusOnOpen(true); }}>
        <span aria-hidden="true">+</span> {label}
      </button>
    );
  }
  return <div ref={formRef} className={className}>{children}</div>;
}
