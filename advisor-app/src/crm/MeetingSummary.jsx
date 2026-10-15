import { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import { suggestTasksFromSummary } from './useClientCrm.js';
import { toast } from '../toast.js';
import styles from './Crm.module.css';

export default function MeetingSummary({ meeting, tasks, onSave, onAddTasks, onDirtyChange, onChange }) {
  const [summary, setSummary] = useState(meeting.summary || '');
  const [decisions, setDecisions] = useState(meeting.decisions || '');
  const [titles, setTitles] = useState('');
  const [due, setDue] = useState('');
  const [responsible, setResponsible] = useState('advisor');
  const [kind, setKind] = useState('action');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const changed = summary !== (meeting.summary || '') || decisions !== (meeting.decisions || '');
  const dirty = changed || !!titles.trim() || busy;
  useEffect(() => { onDirtyChange(meeting.id, dirty); }, [meeting.id, dirty, onDirtyChange]);
  async function save() {
    setBusy(true);
    try { if (await onSave(meeting.id, summary.trim(), decisions.trim())) onChange(); }
    finally { setBusy(false); }
  }
  async function suggest() {
    setBusy(true);
    try {
      const suggested = await suggestTasksFromSummary([summary, decisions].filter(Boolean).join('\n'));
      if (suggested) setTitles(suggested.join('\n'));
      else toast('לא התקבלו הצעות. אפשר לכתוב משימות המשך כאן.', 'info');
    } finally { setBusy(false); }
  }
  async function add() {
    setBusy(true);
    try {
      if (await onAddTasks(titles, due, visible, { responsible, task_kind: kind, meeting_id: meeting.id })) {
        setTitles(''); setDue(''); onChange();
      }
    } finally { setBusy(false); }
  }
  return <div className={styles.summaryBlock}>
    <label className={styles.fieldLabel}>סיכום פגישה<textarea className={styles.textarea} aria-label="סיכום פגישה" value={summary} onChange={e => setSummary(e.target.value)} /></label>
    <label className={styles.fieldLabel}>החלטות שהתקבלו<textarea className={styles.textarea} aria-label="החלטות שהתקבלו" value={decisions} onChange={e => setDecisions(e.target.value)} /></label>
    <p className={styles.meta}>הסיכום וההחלטות מוצגים ללקוח בהתאם להרשאת הפגישה.</p>
    <div className={styles.workflowActions}><Button disabled={!changed || busy} onClick={save}>שמור סיכום והחלטות</Button><Button variant="ghost" disabled={!summary.trim() || busy} onClick={suggest}>הצע משימות המשך</Button></div>
    <details className={styles.followup}>
      <summary>משימות המשך מהפגישה ({tasks.length})</summary>
      {tasks.map(t => <p key={t.id} className={styles.meta}>{t.done ? '✓ ' : ''}{t.title} · {t.responsible === 'client' ? 'באחריות הלקוח' : 'באחריות היועץ'}</p>)}
      <label className={styles.fieldLabel}>משימות חדשות<textarea className={styles.textarea} aria-label="משימות המשך" placeholder="כל משימה בשורה נפרדת" value={titles} onChange={e => setTitles(e.target.value)} /></label>
      <div className={styles.workflowActions}>
        <label className={styles.fieldLabel}>תאריך יעד<input className={styles.input} aria-label="תאריך יעד להמשך" type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
        <label className={styles.fieldLabel}>אחראי<select className={styles.input} aria-label="אחראי למשימות ההמשך" value={responsible} onChange={e => setResponsible(e.target.value)}><option value="advisor">היועץ</option><option value="client">הלקוח</option></select></label>
        <label className={styles.fieldLabel}>סוג<select className={styles.input} aria-label="סוג משימות ההמשך" value={kind} onChange={e => setKind(e.target.value)}><option value="action">פעולה</option><option value="document">מסמך שממתינים לו</option></select></label>
      </div>
      <label className={styles.forClientLabel}><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />גלוי ללקוח</label>
      <Button disabled={!titles.trim() || busy} onClick={add}>הוסף משימות המשך</Button>
    </details>
  </div>;
}
