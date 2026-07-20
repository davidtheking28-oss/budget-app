import { useState } from 'react';
import { useClientCrm } from './useClientCrm.js';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Crm.module.css';

const ICONS = {
  meetings: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  tasks: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  notes: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4V4z" /></svg>
};

function downloadIcs(meeting) {
  const dt = new Date(meeting.scheduled_at);
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@budget-advisor`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${stamp}`,
    `SUMMARY:פגישת ייעוץ${meeting.notes ? ' - ' + meeting.notes.replace(/\n/g, ' ') : ''}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meeting.ics';
  a.click();
  URL.revokeObjectURL(url);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

export default function Crm({ advisorId, clientId }) {
  const { notes, tasks, meetings, loading, error, reload, addNote, editNote, deleteNote, addTask, editTask, toggleTask, deleteTask, addMeeting, editMeeting, deleteMeeting } = useClientCrm(advisorId, clientId);
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');

  const [editingNote, setEditingNote] = useState(null);
  const [editNoteBody, setEditNoteBody] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDue, setEditTaskDue] = useState('');
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [editMeetingAt, setEditMeetingAt] = useState('');
  const [editMeetingNotes, setEditMeetingNotes] = useState('');

  function startEditNote(n) { setEditingNote(n.id); setEditNoteBody(n.body); }
  function saveEditNote(id) { editNote(id, editNoteBody); setEditingNote(null); }
  function startEditTask(t) { setEditingTask(t.id); setEditTaskTitle(t.title); setEditTaskDue(t.due_date || ''); }
  function saveEditTask(id) { editTask(id, editTaskTitle, editTaskDue); setEditingTask(null); }
  function startEditMeeting(m) { setEditingMeeting(m.id); setEditMeetingAt(new Date(m.scheduled_at).toISOString().slice(0, 16)); setEditMeetingNotes(m.notes || ''); }
  function saveEditMeeting(id) { editMeeting(id, new Date(editMeetingAt).toISOString(), editMeetingNotes); setEditingMeeting(null); }

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
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconMeetings}>{ICONS.meetings}</span>פגישות{meetings.length > 0 && <span className={styles.countBadge}>{meetings.length}</span>}</div>
        <div className={styles.form}>
          <input className={styles.input} aria-label="נושא הפגישה" placeholder="נושא / הערה" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && meetingAt && (addMeeting(new Date(meetingAt).toISOString(), meetingNotes), setMeetingAt(''), setMeetingNotes(''))} />
          <input className={styles.input} type="datetime-local" aria-label="תאריך ושעת הפגישה" value={meetingAt} onChange={e => setMeetingAt(e.target.value)} />
          <Button disabled={!meetingAt} onClick={() => { addMeeting(meetingAt ? new Date(meetingAt).toISOString() : null, meetingNotes); setMeetingAt(''); setMeetingNotes(''); }}>קבע פגישה</Button>
        </div>
        {meetings.length ? (
          <div className={styles.list}>
            {meetings.map((m, i) => editingMeeting === m.id ? (
              <div key={m.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div className={styles.form} style={{ margin: 0, flex: 1 }}>
                  <input className={styles.input} aria-label="נושא הפגישה" value={editMeetingNotes} onChange={e => setEditMeetingNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditMeeting(m.id)} />
                  <input className={styles.input} type="datetime-local" aria-label="תאריך ושעת הפגישה" value={editMeetingAt} onChange={e => setEditMeetingAt(e.target.value)} />
                  <Button onClick={() => saveEditMeeting(m.id)}>שמור</Button>
                  <Button variant="ghost" onClick={() => setEditingMeeting(null)}>ביטול</Button>
                </div>
              </div>
            ) : (() => {
              const days = daysUntil(m.scheduled_at);
              const soon = days !== null && days >= 0 && days <= 3;
              const past = days !== null && days < 0;
              return (
                <div key={m.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                  <div role="button" tabIndex={0} className={styles.rowBody} onClick={() => startEditMeeting(m)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditMeeting(m))}>
                    <div className={styles.name}>
                      {new Date(m.scheduled_at).toLocaleString('he-IL')}
                      {soon && <span className={styles.soonBadge}>בעוד {days === 0 ? 'היום' : days + ' ימים'}</span>}
                      {past && <span className={styles.pastBadge}>עברה</span>}
                    </div>
                    {m.notes && <div className={styles.meta}>{m.notes}</div>}
                  </div>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.icsButton} title="הורד ליומן" aria-label="הורד ליומן" onClick={() => downloadIcs(m)}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M12 14v4M10 16h4" />
                      </svg>
                    </button>
                    <DeleteButton onClick={() => deleteMeeting(m.id)} />
                  </div>
                </div>
              );
            })())}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.meetings}</span>אין פגישות מתוזמנות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconTasks}>{ICONS.tasks}</span>משימות{tasks.length > 0 && <span className={styles.countBadge}>{tasks.length}</span>}</div>
        <div className={styles.form}>
          <input className={styles.input} aria-label="כותרת המשימה" placeholder="כותרת המשימה" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && taskTitle.trim() && (addTask(taskTitle, taskDue), setTaskTitle(''), setTaskDue(''))} />
          <input className={styles.input} type="date" aria-label="תאריך יעד למשימה" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
          <Button disabled={!taskTitle.trim()} onClick={() => { addTask(taskTitle, taskDue); setTaskTitle(''); setTaskDue(''); }}>הוסף משימה</Button>
        </div>
        {tasks.length ? (
          <div className={styles.list}>
            {tasks.map((t, i) => editingTask === t.id ? (
              <div key={t.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div className={styles.form} style={{ margin: 0, flex: 1 }}>
                  <input className={styles.input} value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditTask(t.id)} />
                  <input className={styles.input} type="date" value={editTaskDue} onChange={e => setEditTaskDue(e.target.value)} />
                  <Button onClick={() => saveEditTask(t.id)}>שמור</Button>
                  <Button variant="ghost" onClick={() => setEditingTask(null)}>ביטול</Button>
                </div>
              </div>
            ) : (() => {
              const overdue = !t.done && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());
              return (
                <div key={t.id} className={styles.row + ' ' + styles.taskRow} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                  <input className={styles.checkbox} type="checkbox" aria-label={`סמן "${t.title}" כהושלמה`} checked={t.done} onChange={e => toggleTask(t.id, e.target.checked)} />
                  <div role="button" tabIndex={0} className={styles.taskBody + (t.done ? ' ' + styles.done : '')} onClick={() => startEditTask(t)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditTask(t))}>
                    <div className={styles.name}>{t.title}{overdue && <span className={styles.pastBadge}>באיחור</span>}</div>
                    {t.due_date && <div className={styles.meta}>יעד: {t.due_date}</div>}
                  </div>
                  <DeleteButton onClick={() => deleteTask(t.id)} />
                </div>
              );
            })())}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.tasks}</span>אין משימות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconNotes}>{ICONS.notes}</span>הערות{notes.length > 0 && <span className={styles.countBadge}>{notes.length}</span>}</div>
        <div className={styles.form}>
          <textarea className={styles.textarea} aria-label="הערה חדשה על הלקוח" placeholder="הערה חדשה על הלקוח" value={noteBody} onChange={e => setNoteBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && noteBody.trim() && (e.preventDefault(), addNote(noteBody), setNoteBody(''))} />
          <Button disabled={!noteBody.trim()} onClick={() => { addNote(noteBody); setNoteBody(''); }}>שמור הערה</Button>
        </div>
        {notes.length ? (
          <div className={styles.list}>
            {notes.map((n, i) => editingNote === n.id ? (
              <div key={n.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div className={styles.form} style={{ margin: 0, flex: 1 }}>
                  <textarea className={styles.textarea} value={editNoteBody} onChange={e => setEditNoteBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), saveEditNote(n.id))} />
                  <Button onClick={() => saveEditNote(n.id)}>שמור</Button>
                  <Button variant="ghost" onClick={() => setEditingNote(null)}>ביטול</Button>
                </div>
              </div>
            ) : (
              <div key={n.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.04, 0.3) + 's' }}>
                <div role="button" tabIndex={0} className={styles.rowBody} onClick={() => startEditNote(n)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditNote(n))}>
                  <div>{n.body}</div>
                  <div className={styles.meta}>{new Date(n.created_at).toLocaleDateString('he-IL')}</div>
                </div>
                <DeleteButton onClick={() => deleteNote(n.id)} />
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.notes}</span>אין הערות</div>}
      </div>
    </div>
  );
}
