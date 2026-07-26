import { relativeTime, isStale } from '../clients/useClientFreshness.js';
import styles from './ClientContextBar.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

function formatMeeting(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' בשעה ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export default function ClientContextBar({ email, nextMeeting, openTasks, onOpenCrm, freshness }) {
  const meeting = formatMeeting(nextMeeting);
  const updated = freshness ? relativeTime(freshness.updatedAt) : null;
  const stale = freshness ? isStale(freshness.updatedAt) : false;
  return (
    <div className={styles.bar}>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">{initials(email)}</span>
        <span className={styles.email}>{email || '—'}</span>
        <span className={styles.statusPill}>פעיל</span>
      </div>
      <div className={styles.facts}>
        {updated && (
          <span className={styles.fact} title={new Date(freshness.updatedAt).toLocaleString('he-IL')}>
            <span className={styles.factLabel}>{freshness.byClient ? 'הלקוח עדכן' : 'עודכן'}</span>
            <span className={styles.factValue + (stale ? ' ' + styles.factStale : '')}>{updated}</span>
          </span>
        )}
        {meeting && (
          <span className={styles.fact}>
            <span className={styles.factLabel}>הפגישה הבאה</span>
            <span className={styles.factValue}>{meeting}</span>
          </span>
        )}
        <button type="button" className={styles.fact + ' ' + styles.factButton} onClick={onOpenCrm}>
          <span className={styles.factLabel}>משימות פתוחות</span>
          <span className={styles.factValue + (openTasks > 0 ? ' ' + styles.factAlert : '')}>{openTasks}</span>
        </button>
      </div>
    </div>
  );
}
