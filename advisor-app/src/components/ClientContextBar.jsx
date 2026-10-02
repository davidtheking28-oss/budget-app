import { useState } from 'react';
import { formatDate, formatDateTime } from '../budget/monthUtils.js';
import Hero from './Hero.jsx';
import styles from './ClientContextBar.module.css';

const iconProps = { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' };

export default function ClientContextBar({ isVip, phone, createdAt, nextMeeting, openTasks, household, tags, manualTags, onAddTag, onRemoveTag, onAction, budgetMode, onBudgetModeChange }) {
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const meeting = nextMeeting ? formatDateTime(nextMeeting) : null;
  const joined = createdAt ? formatDate(createdAt) : null;
  const digits = phone ? phone.replace(/\D/g, '') : null;
  const waHref = digits ? `https://wa.me/${digits}` : null;
  const telHref = digits ? `tel:${digits}` : null;

  function submitTag() {
    if (!tagDraft.trim() || !onAddTag) return;
    onAddTag(tagDraft);
    setTagDraft('');
    setAddingTag(false);
  }

  return (
    <>
      <Hero compact
        label="הפגישה הבאה"
        value={meeting || 'לא נקבעה'}
        note={<>
          <span className={styles.badgeActive}>פעיל</span>
          {isVip && <span className={styles.vipBadge}>★ VIP</span>}
          {joined && <span className={styles.badge}>לקוח מאז {joined}</span>}
          {phone ? (
            <span className={styles.contactItem} dir="ltr">
              <svg {...iconProps} width={14} height={14}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.7a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z" /></svg>
              {phone}
            </span>
          ) : (
            <button type="button" className={styles.contactMissing} onClick={() => onAction('profile')}>+ הוסף טלפון</button>
          )}
          {(tags || []).map(tag => <span key={tag} className={styles.tagBadge}>{tag}</span>)}
          {(manualTags || []).map(tag => (
            <span key={tag} className={styles.tagBadge}>
              {tag}
              {onRemoveTag && <button type="button" aria-label={`הסר תגית ${tag}`} onClick={() => onRemoveTag(tag)}>×</button>}
            </span>
          ))}
          {onAddTag && (addingTag ? (
            <span className={styles.tagAddForm}>
              <input
                autoFocus
                className={styles.tagAddInput}
                aria-label="שם התגית"
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitTag(); if (e.key === 'Escape') { setAddingTag(false); setTagDraft(''); } }}
                onBlur={submitTag}
              />
            </span>
          ) : (
            <button type="button" className={styles.addTagBtn} onClick={() => setAddingTag(true)}>+ הוסף תגית</button>
          ))}
        </>}
        side={[
          { label: 'משימות פתוחות', value: String(openTasks) },
          household && { label: 'שיתוף תקציב', value: household.partnerEmail || 'זוגי' }
        ].filter(Boolean)}
      />
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
        <button type="button" className={styles.actionTile} onClick={() => onAction('task')}>
          <svg {...iconProps} width={18} height={18}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
          משימה חדשה
        </button>
        <button type="button" className={styles.actionTile} onClick={() => onAction('meeting')}>
          <svg {...iconProps} width={18} height={18}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
          פגישה חדשה
        </button>
        {waHref && (
          <a className={styles.actionTile} href={waHref} target="_blank" rel="noreferrer">
            <svg {...iconProps} width={18} height={18}><path d="M3 21l1.5-4.5A8.5 8.5 0 1 1 8 19.5L3 21z" /><path d="M8.5 9.5c0 3.5 3 6.5 6.5 6.5.7 0 1.3-.5 1.3-1.2v-1l-2.3-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2.3h-1c-.7 0-1 .6-1 1.5z" /></svg>
            WhatsApp
          </a>
        )}
        {telHref && (
          <a className={styles.actionTile} href={telHref}>
            <svg {...iconProps} width={18} height={18}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.7a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z" /></svg>
            התקשר
          </a>
        )}
      </div>
    </>
  );
}
