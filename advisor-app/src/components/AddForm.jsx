import { useEffect, useRef, useState } from 'react';
import styles from './AddForm.module.css';

export default function AddForm({ label, open: forceOpen = false, openSignal = 0, closeSignal = 0, onEscape, className, children }) {
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const formRef = useRef(null);

  const triggerRef = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (closeSignal) setOpen(false);
  }, [closeSignal]);

  useEffect(() => {
    const isOpen = open || forceOpen;
    if (wasOpen.current && !isOpen) {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) triggerRef.current?.focus();
      });
    }
    wasOpen.current = isOpen;
  }, [open, forceOpen]);

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
      <button ref={triggerRef} type="button" className={styles.trigger} onClick={() => { setOpen(true); setFocusOnOpen(true); }}>
        <span aria-hidden="true">+</span> {label}
      </button>
    );
  }
  return <div ref={formRef} className={className} onKeyDown={onEscape ? e => { if (e.key === 'Escape') onEscape(); } : undefined}>{children}</div>;
}
