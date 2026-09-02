import { formatDateTime } from '../budget/monthUtils.js';
import styles from './ClientContextBar.module.css';

export default function ClientContextBar({ nextMeeting, openTasks, household, onOpenCrm, budgetMode, onBudgetModeChange }) {
  const meeting = nextMeeting ? formatDateTime(nextMeeting) : null;
  return (
    <div className={styles.bar}>
      <div className={styles.identity}>
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
