import { useEffect, useRef } from 'react';
import PipelineTable from './PipelineTable.jsx';
import styles from './PipelineModal.module.css';

export default function PipelineModal({ leads, loading, addLead, setStage, deleteLead, onClose }) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    function onKeyDown(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label="צינור טיפול בלקוחות" onClick={e => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} aria-label="סגור" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <PipelineTable leads={leads} loading={loading} addLead={addLead} setStage={setStage} deleteLead={deleteLead} />
      </div>
    </div>
  );
}
