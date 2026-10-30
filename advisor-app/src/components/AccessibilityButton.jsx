import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './AccessibilityButton.module.css';

const KEY = 'advisor_a11y';
const STEPS = [90, 100, 112, 125, 140];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return { step: STEPS.includes(saved?.step) ? saved.step : 100, contrast: !!saved?.contrast };
  } catch {
    return { step: 100, contrast: false };
  }
}

export default function AccessibilityButton() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(load);

  useEffect(() => {
    document.documentElement.style.fontSize = prefs.step === 100 ? '' : prefs.step + '%';
    document.documentElement.classList.toggle('a11y-contrast', prefs.contrast);
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }, [prefs]);

  const index = STEPS.indexOf(prefs.step);
  const bump = delta => setPrefs(p => ({ ...p, step: STEPS[Math.min(STEPS.length - 1, Math.max(0, index + delta))] }));

  return createPortal(
    <div className={styles.wrap}>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="התאמות תצוגה">
          <div className={styles.row}>
            <span>גודל טקסט</span>
            <div className={styles.group}>
              <button type="button" className={styles.btn} onClick={() => bump(-1)} disabled={index === 0} aria-label="הקטנת טקסט">א-</button>
              <span className={styles.value}>{prefs.step}%</span>
              <button type="button" className={styles.btn} onClick={() => bump(1)} disabled={index === STEPS.length - 1} aria-label="הגדלת טקסט">א+</button>
            </div>
          </div>
          <div className={styles.row}>
            <span>ניגודיות גבוהה</span>
            <button type="button" className={prefs.contrast ? styles.btnOn : styles.btn} aria-label="ניגודיות גבוהה" aria-pressed={prefs.contrast} onClick={() => setPrefs(p => ({ ...p, contrast: !p.contrast }))}>{prefs.contrast ? 'פועל' : 'כבוי'}</button>
          </div>
          <button type="button" className={styles.reset} onClick={() => setPrefs({ step: 100, contrast: false })}>איפוס</button>
        </div>
      )}
      <button type="button" className={styles.fab} aria-expanded={open} aria-label="התאמות נגישות" title="התאמות נגישות" onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="4.5" r="1.8" /><path d="M5 8.5l7 1.5 7-1.5M12 10v4.5M9 21l3-6.5 3 6.5" /></svg>
      </button>
    </div>,
    document.body
  );
}
