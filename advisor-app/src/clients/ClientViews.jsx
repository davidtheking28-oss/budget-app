import { useState } from 'react';
import Button from '../components/Button.jsx';
import styles from './ClientList.module.css';

export const CLIENT_FILTERS = [['all', 'כל הלקוחות'], ['meetings', 'לקראת פגישה'], ['documents', 'ממתינים למסמכים'], ['attention', 'דורשים מעקב'], ['overage', 'חריגות תקציב'], ['tasks', 'משימות פתוחות']];

export function clientMatches(client, filter) {
  if (filter === 'overage') return client.hasOverage;
  if (filter === 'tasks') return client.openTasks > 0;
  if (filter === 'meetings') return !!client.nextMeetingAt && new Date(client.nextMeetingAt) <= new Date(Date.now() + 7 * 86400000);
  if (filter === 'documents') return client.waitingDocuments > 0;
  if (filter === 'attention') return client.hasOverage || client.hasFailedUpload || client.hasDeclinedMeeting || client.overdueTasks > 0;
  return true;
}

export default function ClientViews({ current, onChange, saved, onSave, onRemove }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  function save() { if (!name.trim()) return; onSave(name.trim()); setName(''); setSaving(false); }
  return <section className={styles.clientViews} aria-label="תצוגות לקוחות">
    <div className={styles.queueHeader}><h2>הלקוחות שלי</h2><Button variant="ghost" aria-expanded={advanced} aria-controls="client-view-options" onClick={() => setAdvanced(v => !v)}>סינון ומיון</Button></div>
    <div className={styles.viewFields}><label>חיפוש ברשימה<input aria-label="חיפוש ברשימת הלקוחות" placeholder="חיפוש לפי שם או אימייל" value={current.query} onChange={e => onChange({ ...current, query: e.target.value })} /></label></div>
    <div id="client-view-options" hidden={!advanced}>
    <div className={styles.viewButtons} role="group" aria-label="תצוגת לקוחות">{CLIENT_FILTERS.map(([key, label]) => <button key={key} type="button" aria-pressed={(current.filter || 'all') === key} onClick={() => onChange({ ...current, filter: key === 'all' ? null : key })}>{label}</button>)}</div>
    <div className={styles.viewFields}><label>מיון<select aria-label="מיון לקוחות" value={current.sort} onChange={e => onChange({ ...current, sort: e.target.value })}><option value="urgency">לפי דחיפות</option><option value="name">לפי שם</option><option value="meeting">לפי פגישה קרובה</option></select></label><Button variant="ghost" onClick={() => setSaving(v => !v)}>שמור תצוגה</Button></div>
    {saving && <div className={styles.viewFields}><label>שם התצוגה<input autoFocus aria-label="שם התצוגה" maxLength={60} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} /></label><Button disabled={!name.trim()} onClick={save}>שמור בשם</Button></div>}
    {!!saved.length && <div className={styles.savedViews} aria-label="תצוגות שמורות">{saved.map(v => <span key={v.id}><button type="button" onClick={() => onChange(v.settings)}>{v.name}</button><button type="button" aria-label={`מחק תצוגה ${v.name}`} onClick={() => onRemove(v.id)}>×</button></span>)}</div>}
    <p className={styles.queueEmpty}>התצוגות נשמרות בדפדפן הזה עבור החשבון שלך.</p>
    </div>
  </section>;
}
