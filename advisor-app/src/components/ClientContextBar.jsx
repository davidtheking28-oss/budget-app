import { formatDate, formatDateTime } from '../budget/monthUtils.js';
import { initials } from '../clientIdentity.js';
import styles from './ClientContextBar.module.css';

const iconProps = { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' };

export default function ClientContextBar({ email, phone, createdAt, nextMeeting, openTasks, household, onOpenCrm, budgetMode, onBudgetModeChange }) {
  const meeting = nextMeeting ? formatDateTime(nextMeeting) : null;
  const joined = createdAt ? formatDate(createdAt) : null;
  const digits = phone ? phone.replace(/\D/g, '') : null;
  const waHref = digits ? `https://wa.me/${digits}` : null;
  const telHref = digits ? `tel:${digits}` : null;

  return (
    <div className={styles.bar}>
      <div className={styles.top}>
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">{initials(email)}</div>
          <div className={styles.identityInfo}>
            <div className={styles.contactRow}>
              <span className={styles.contactItem} dir="ltr" title={email}>
                <svg {...iconProps} width={14} height={14}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                {email}
              </span>
              {phone && (
                <span className={styles.contactItem} dir="ltr">
                  <svg {...iconProps} width={14} height={14}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.7a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z" /></svg>
                  {phone}
                </span>
              )}
            </div>
            <div className={styles.badges}>
              <span className={styles.badgeActive}>פעיל</span>
              {joined && <span className={styles.badge}>לקוח מאז {joined}</span>}
            </div>
          </div>
        </div>

        <div className={styles.actionsRow}>
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
          <button type="button" className={styles.actionBtn} onClick={onOpenCrm}>משימה חדשה</button>
          <button type="button" className={styles.actionBtn} onClick={onOpenCrm}>פגישה חדשה</button>
          {waHref && (
            <a className={styles.iconBtn} href={waHref} target="_blank" rel="noreferrer" aria-label="שלח הודעת WhatsApp ללקוח">
              <svg {...iconProps}><path d="M3 21l1.5-4.5A8.5 8.5 0 1 1 8 19.5L3 21z" /><path d="M8.5 9.5c0 3.5 3 6.5 6.5 6.5.7 0 1.3-.5 1.3-1.2v-1l-2.3-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2.3h-1c-.7 0-1 .6-1 1.5z" /></svg>
            </a>
          )}
          {telHref && (
            <a className={styles.iconBtn} href={telHref} aria-label="התקשר ללקוח">
              <svg {...iconProps}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.7a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z" /></svg>
            </a>
          )}
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statIcon}>
            <svg {...iconProps} width={18} height={18}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{meeting || 'לא נקבעה'}</span>
            <span className={styles.statLabel}>הפגישה הבאה</span>
          </div>
        </div>

        <button type="button" className={styles.stat + ' ' + styles.statClickable} onClick={onOpenCrm}>
          <div className={styles.statIcon + (openTasks > 0 ? ' ' + styles.statGold : '')}>
            <svg {...iconProps} width={18} height={18}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{openTasks}</span>
            <span className={styles.statLabel}>משימות פתוחות</span>
          </div>
        </button>

        {household && (
          <div className={styles.stat}>
            <div className={styles.statIcon + ' ' + styles.statAccent}>
              <svg {...iconProps} width={18} height={18}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6" /><circle cx="17" cy="8" r="2.6" /><path d="M16 14.6c2.6.4 4.5 2.2 4.5 5.4" /></svg>
            </div>
            <div className={styles.statBody}>
              <span className={styles.statValue}>{household.partnerEmail || 'זוגי'}</span>
              <span className={styles.statLabel}>שיתוף תקציב</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
