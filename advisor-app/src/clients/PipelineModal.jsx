import { useEffect, useRef } from 'react';
import PipelineTable from './PipelineTable.jsx';
import styles from './PipelineModal.module.css';

export default function PipelineModal({ leads, loading, addLead, setStage, deleteLead, onClose }) {
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    setTimeout(() => closeBtnRef.current?.focus(), 10);
    function onKeyDown(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll('input, select, button, a[href]');
      if (!focusable || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label="צינור טיפול בלקוחות" onClick={e => e.stopPropagation()}>
        <button ref={closeBtnRef} type="button" className={styles.closeBtn} aria-label="סגור" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <PipelineTable leads={leads} loading={loading} addLead={addLead} setStage={setStage} deleteLead={deleteLead} />
      </div>
    </div>
  );
}
