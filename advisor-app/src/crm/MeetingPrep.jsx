import { useEffect, useState } from 'react';
import { useClientBudget } from '../budget/useClientBudget.js';
import { formatDateTime } from '../budget/monthUtils.js';
import { lastHeldMeeting, meetingChanges } from './workflow.js';
import { fmt } from '../format.js';
import styles from './Crm.module.css';

export default function MeetingPrep({ advisorId, clientId, tasks, meetings, openSignal }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const { data, loading, error } = useClientBudget(clientId, advisorId);
  const last = lastHeldMeeting(meetings);
  const changes = meetingChanges(data?.transactions, last?.scheduled_at);
  const pending = tasks.filter(t => !t.done);
  const next = meetings.filter(m => m.status !== 'declined' && new Date(m.scheduled_at) > new Date()).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
  return <section className={styles.prep} aria-label="הכנה לפגישה">
    <div className={styles.prepHeader}><div><h2>הכנה לפגישה</h2><p>{next ? `הפגישה הבאה: ${formatDateTime(next.scheduled_at)}` : 'ריכוז הנושאים לשיחה הבאה'}</p></div><button type="button" className={styles.icsButton} aria-expanded={open} onClick={() => setOpen(v => !v)}>פתח הכנה לפגישה</button></div>
    {(open) && <div className={styles.prepGrid}>
      <div><h3>מהפגישה הקודמת</h3>{last ? <><p>{formatDateTime(last.scheduled_at)}</p><p className={styles.prepText}>{last.summary || 'לא נשמר סיכום לפגישה הקודמת.'}</p>{last.decisions && <p className={styles.prepText}>החלטות: {last.decisions}</p>}</> : <p>אין פגישה קודמת שנרשמה במערכת.</p>}</div>
      <div><h3>תנועות מאז הפגישה</h3>{loading ? <p>טוען נתונים…</p> : error ? <p>לא ניתן לטעון כרגע את נתוני התקציב.</p> : changes ? <><strong>{changes.count} תנועות · {fmt(changes.expense)} הוצאות</strong><p>לפי תאריך התנועה, מהיום שאחרי הפגישה ועד היום, בתקציב שנבחר. זה אינו מועד הזנת התנועה.</p></> : <p>לאחר רישום פגישה קודמת יוצגו כאן התנועות מאז תאריכה.</p>}</div>
      <div><h3>מה נשאר פתוח ({pending.length})</h3>{pending.length ? <ul>{pending.map(t => <li key={t.id}>{t.title} · {t.responsible === 'client' ? 'הלקוח' : 'היועץ'}{t.due_date ? ` · ${t.due_date}` : ''}</li>)}</ul> : <p>אין משימות פתוחות.</p>}</div>
    </div>}
  </section>;
}
