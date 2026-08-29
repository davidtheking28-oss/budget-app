import { relativeTime, isStale } from '../clients/useClientFreshness.js';
import { formatDateTime } from '../budget/monthUtils.js';
import styles from './ClientContextBar.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

export default function ClientContextBar({ email, nextMeeting, openTasks, household, onOpenCrm, freshness, budgetMode, onBudgetModeChange }) {
  const meeting = nextMeeting ? formatDateTime(nextMeeting) : null;
  const updated = freshness ? relativeTime(freshness.updatedAt) : null;
  const stale = freshness ? isStale(freshness.updatedAt) : false;
  return (
    <div className={styles.bar}>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">{initials(email)}</span>
        <span className={styles.email}>{email || '—'}</span>
        {household && (
          <span className={styles.fact} title={household.partnerEmail ? `משותף עם ${household.partnerEmail}` : 'התקציב משותף עם בן/בת זוג'}>
            <span className={styles.factLabel}>שיתוף</span>
            <span className={styles.factValue}>{household.partnerEmail || 'זוגי'}</span>
          </span>
        )}
        {onBudgetModeChange && (
          <span className={styles.modeToggle} role="group" aria-label="מצב תקציב">
            <button
              type="button"
              className={budgetMode !== 'business' ? styles.modeOn : styles.modeOff}
              aria-pressed={budgetMode !== 'business'}
              onClick={() => onBudgetModeChange('personal')}
            >פרטי</button>
            <button
              type="button"
              className={budgetMode === 'business' ? styles.modeOn : styles.modeOff}
              aria-pressed={budgetMode === 'business'}
              onClick={() => onBudgetModeChange('business')}
            >עסקי</button>
          </span>
        )}
      </div>
      <div className={styles.facts}>
        {updated && (
          <span className={styles.fact} title={formatDateTime(freshness.updatedAt)}>
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
