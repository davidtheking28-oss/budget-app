import { useEffect, useRef, useState } from 'react';
import PipelineTable from './PipelineTable.jsx';
import styles from './PipelineModal.module.css';

// How it enters is how it should leave (same path, reversed) — the parent
// unmounts this instantly on close, so the exit animation has to run here
// first, then hand off to the real onClose once it's done.
const EXIT_MS = 180;

export default function PipelineModal({ leads, loading, addLead, setStage, deleteLead, onClose }) {
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(onClose, EXIT_MS);
  }

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    setTimeout(() => closeBtnRef.current?.focus(), 10);
    function onKeyDown(e) {
      if (e.key === 'Escape') { requestClose(); return; }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.overlay + (closing ? ' ' + styles.closing : '')} onClick={requestClose}>
      <div ref={panelRef} className={styles.panel + (closing ? ' ' + styles.closing : '')} role="dialog" aria-modal="true" aria-label="צינור טיפול בלקוחות" onClick={e => e.stopPropagation()}>
        <button ref={closeBtnRef} type="button" className={styles.closeBtn} aria-label="סגור" onClick={requestClose}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <PipelineTable leads={leads} loading={loading} addLead={addLead} setStage={setStage} deleteLead={deleteLead} />
      </div>
    </div>
  );
}
