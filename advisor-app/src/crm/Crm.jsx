import { useState } from 'react';
import { useClientCrm } from './useClientCrm.js';
import styles from './Crm.module.css';

export default function Crm({ advisorId, clientId }) {
  const { notes, tasks, meetings, loading, addNote, deleteNote, addTask, toggleTask, deleteTask, addMeeting, deleteMeeting } = useClientCrm(advisorId, clientId);
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');

  if (loading) return null;

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>פגישות</div>
        <div className={styles.form}>
          <input className={styles.input} type="datetime-local" value={meetingAt} onChange={e => setMeetingAt(e.target.value)} />
          <input className={styles.input} placeholder="נושא / הערה" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} />
          <button className={styles.button} disabled={!meetingAt} onClick={() => { addMeeting(meetingAt ? new Date(meetingAt).toISOString() : null, meetingNotes); setMeetingAt(''); setMeetingNotes(''); }}>קבע פגישה</button>
        </div>
        {meetings.length ? (
          <div className={styles.list}>
            {meetings.map(m => (
              <div key={m.id} className={styles.row}>
                <div>
                  <div>{new Date(m.scheduled_at).toLocaleString('he-IL')}</div>
                  {m.notes && <div className={styles.meta}>{m.notes}</div>}
                </div>
                <button className={styles.del} onClick={() => deleteMeeting(m.id)}>✕</button>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין פגישות מתוזמנות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>משימות</div>
        <div className={styles.form}>
          <input className={styles.input} placeholder="כותרת המשימה" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
          <input className={styles.input} type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
          <button className={styles.button} disabled={!taskTitle.trim()} onClick={() => { addTask(taskTitle, taskDue); setTaskTitle(''); setTaskDue(''); }}>הוסף משימה</button>
        </div>
        {tasks.length ? (
          <div className={styles.list}>
            {tasks.map(t => (
              <div key={t.id} className={styles.row + ' ' + styles.taskRow}>
                <input className={styles.checkbox} type="checkbox" checked={t.done} onChange={e => toggleTask(t.id, e.target.checked)} />
                <div className={styles.taskBody + (t.done ? ' ' + styles.done : '')}>
                  <div>{t.title}</div>
                  {t.due_date && <div className={styles.meta}>יעד: {t.due_date}</div>}
                </div>
                <button className={styles.del} onClick={() => deleteTask(t.id)}>✕</button>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין משימות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>הערות</div>
        <div className={styles.form}>
          <textarea className={styles.textarea} placeholder="הערה חדשה על הלקוח" value={noteBody} onChange={e => setNoteBody(e.target.value)} />
          <button className={styles.button} disabled={!noteBody.trim()} onClick={() => { addNote(noteBody); setNoteBody(''); }}>שמור הערה</button>
        </div>
        {notes.length ? (
          <div className={styles.list}>
            {notes.map(n => (
              <div key={n.id} className={styles.row}>
                <div>
                  <div>{n.body}</div>
                  <div className={styles.meta}>{new Date(n.created_at).toLocaleDateString('he-IL')}</div>
                </div>
                <button className={styles.del} onClick={() => deleteNote(n.id)}>✕</button>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין הערות</div>}
      </div>
    </div>
  );
}
