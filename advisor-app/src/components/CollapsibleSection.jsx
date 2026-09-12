import { useState } from 'react';
import styles from './CollapsibleSection.module.css';

const CHEVRON = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;

// Shared collapse mechanics for a card section whose header is icon + label +
// count badge (the pattern repeated across Crm/Subscriptions/Credit/Assets) —
// collapsed by default so a page with several of these doesn't dump every
// list and form on screen at once. The page keeps styling its own header
// content (icon chip colors, badge) and just hands it in as `title`.
export default function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button type="button" className={styles.sectionTitle} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {title}
        <span className={styles.chevron + (open ? ' ' + styles.chevronOpen : '')}>{CHEVRON}</span>
      </button>
      <div className={styles.sectionBody + (open ? ' ' + styles.sectionBodyOpen : '')}>
        <div className={styles.sectionBodyInner}>{children}</div>
      </div>
    </>
  );
}
