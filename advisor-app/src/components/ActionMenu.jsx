import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ActionMenu.module.css';

export default function ActionMenu({ children }) {
  const ref = useRef(null);
  const itemsRef = useRef(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open || !itemsRef.current) return;
    const trigger = ref.current.querySelector('summary').getBoundingClientRect();
    const menu = itemsRef.current.getBoundingClientRect();
    const top = trigger.bottom + menu.height + 8 <= window.innerHeight ? trigger.bottom + 6 : Math.max(8, trigger.top - menu.height - 6);
    const left = Math.max(8, Math.min(trigger.left, window.innerWidth - menu.width - 8));
    setPosition({ top, left });
    itemsRef.current.querySelector('button')?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function closeOutside(e) {
      if (ref.current && !ref.current.contains(e.target) && !itemsRef.current?.contains(e.target)) ref.current.open = false;
    }
    function closeOnScroll(e) {
      if (ref.current && !itemsRef.current?.contains(e.target)) ref.current.open = false;
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [open]);
  return <details ref={ref} data-actions className={styles.actions} onToggle={e => setOpen(e.currentTarget.open)} onClickCapture={e => { if (e.target.closest('button')) setTimeout(() => { if (ref.current) { if (itemsRef.current?.contains(document.activeElement)) ref.current.querySelector('summary').focus(); ref.current.open = false; } }, 0); }} onClick={e => e.stopPropagation()} onKeyDown={e => {
    if (e.key === 'Tab' && itemsRef.current?.contains(e.target)) {
      e.stopPropagation();
      const buttons = [...itemsRef.current.querySelectorAll('button:not([disabled])')];
      if (e.shiftKey ? e.target === buttons[0] : e.target === buttons[buttons.length - 1]) {
        e.preventDefault(); ref.current.open = false; ref.current.querySelector('summary').focus();
      }
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ref.current.open = false; ref.current.querySelector('summary').focus(); } }}>
    <summary aria-label="פעולות נוספות" aria-controls={open ? id : undefined}>⋯</summary>
    {open && createPortal(<div ref={itemsRef} id={id} className={styles.items} style={position} dir="rtl" role="group" aria-label="פעולות לפריט">{children}</div>, document.body)}
  </details>;
}
