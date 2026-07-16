import { useState } from 'react';
import { useClientCrm } from './useClientCrm.js';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Crm.module.css';

export default function Crm({ advisorId, clientId }) {
  const { notes, tasks, meetings, loading, error, reload, addNote, deleteNote, addTask, toggleTask, deleteTask, addMeeting, deleteMeeting } = useClientCrm(advisorId, clientId);
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) {
    return (
      <div>
        <Skeleton height="140px" radius="14px" style={{ marginBottom: 24 }} />
        <Skeleton height="140px" radius="14px" style={{ marginBottom: 24 }} />
        <Skeleton height="140px" radius="14px" />
      </div>
    );
  }

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>פגישות</div>
        <div className={styles.form}>
          <input className={styles.input} type="datetime-local" value={meetingAt} onChange={e => setMeetingAt(e.target.value)} />
          <input className={styles.input} placeholder="נושא / הערה" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && meetingAt && (addMeeting(new Date(meetingAt).toISOString(), meetingNotes), setMeetingAt(''), setMeetingNotes(''))} />
          <Button disabled={!meetingAt} onClick={() => { addMeeting(meetingAt ? new Date(meetingAt).toISOString() : null, meetingNotes); setMeetingAt(''); setMeetingNotes(''); }}>קבע פגישה</Button>
        </div>
        {meetings.length ? (
          <div className={styles.list}>
            {meetings.map((m, i) => (
              <div key={m.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div>
                  <div>{new Date(m.scheduled_at).toLocaleString('he-IL')}</div>
                  {m.notes && <div className={styles.meta}>{m.notes}</div>}
                </div>
                <DeleteButton onClick={() => deleteMeeting(m.id)} />
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין פגישות מתוזמנות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>משימות</div>
        <div className={styles.form}>
          <input className={styles.input} placeholder="כותרת המשימה" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && taskTitle.trim() && (addTask(taskTitle, taskDue), setTaskTitle(''), setTaskDue(''))} />
          <input className={styles.input} type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
          <Button disabled={!taskTitle.trim()} onClick={() => { addTask(taskTitle, taskDue); setTaskTitle(''); setTaskDue(''); }}>הוסף משימה</Button>
        </div>
        {tasks.length ? (
          <div className={styles.list}>
            {tasks.map((t, i) => (
              <div key={t.id} className={styles.row + ' ' + styles.taskRow} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <input className={styles.checkbox} type="checkbox" checked={t.done} onChange={e => toggleTask(t.id, e.target.checked)} />
                <div className={styles.taskBody + (t.done ? ' ' + styles.done : '')}>
                  <div>{t.title}</div>
                  {t.due_date && <div className={styles.meta}>יעד: {t.due_date}</div>}
                </div>
                <DeleteButton onClick={() => deleteTask(t.id)} />
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין משימות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>הערות</div>
        <div className={styles.form}>
          <textarea className={styles.textarea} placeholder="הערה חדשה על הלקוח" value={noteBody} onChange={e => setNoteBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && noteBody.trim() && (e.preventDefault(), addNote(noteBody), setNoteBody(''))} />
          <Button disabled={!noteBody.trim()} onClick={() => { addNote(noteBody); setNoteBody(''); }}>שמור הערה</Button>
        </div>
        {notes.length ? (
          <div className={styles.list}>
            {notes.map((n, i) => (
              <div key={n.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div>
                  <div>{n.body}</div>
                  <div className={styles.meta}>{new Date(n.created_at).toLocaleDateString('he-IL')}</div>
                </div>
                <DeleteButton onClick={() => deleteNote(n.id)} />
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין הערות</div>}
      </div>
    </div>
  );
}
