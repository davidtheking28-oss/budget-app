import { useState } from 'react';
import { useClientCrm } from './useClientCrm.js';
import { formatDate, formatDateTime } from '../budget/monthUtils.js';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { toast } from '../toast.js';
import styles from './Crm.module.css';

const ICONS = {
  meetings: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  tasks: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  notes: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4V4z" /></svg>,
  edit: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
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
  const target = new Date(dateStr);
  const now = new Date();
  if (target < now) return -1;
  return Math.ceil((target - now) / 86400000);
}

export default function Crm({ advisorId, clientId, onChange }) {
  const { notes, tasks, meetings, loading, error, reload, addNote, editNote, deleteNote, addTasks, editTask, toggleTask, deleteTask, addMeeting, editMeeting, deleteMeeting, respondMeeting } = useClientCrm(advisorId, clientId);
  const [noteBody, setNoteBody] = useState('');
  const [noteForClient, setNoteForClient] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskForClient, setTaskForClient] = useState(false);
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingForClient, setMeetingForClient] = useState(true);
  const notify = () => { if (onChange) onChange(); };

  async function submitMeeting() {
    if (!meetingAt) return;
    const ok = await addMeeting(new Date(meetingAt).toISOString(), meetingNotes, meetingForClient);
    if (ok) { setMeetingAt(''); setMeetingNotes(''); setMeetingForClient(true); notify(); }
  }
  async function submitTask() {
    if (!taskTitle.trim()) return;
    const ok = await addTasks(taskTitle, taskDue, taskForClient);
    if (ok) { setTaskTitle(''); setTaskDue(''); setTaskForClient(false); notify(); }
  }
  async function submitNote() {
    if (!noteBody.trim()) return;
    const ok = await addNote(noteBody, noteForClient);
    if (ok) { setNoteBody(''); setNoteForClient(false); notify(); }
  }
  async function removeMeeting(id) { await deleteMeeting(id); notify(); }
  async function removeTask(id) { await deleteTask(id); notify(); }

  const [editingNote, setEditingNote] = useState(null);
  const [editNoteBody, setEditNoteBody] = useState('');
  const [editNoteForClient, setEditNoteForClient] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDue, setEditTaskDue] = useState('');
  const [editTaskForClient, setEditTaskForClient] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [editMeetingAt, setEditMeetingAt] = useState('');
  const [editMeetingNotes, setEditMeetingNotes] = useState('');
  const [editMeetingForClient, setEditMeetingForClient] = useState(true);

  function startEditNote(n) { setEditingNote(n.id); setEditNoteBody(n.body); setEditNoteForClient(!!n.for_client); }
  function saveEditNote(id) { editNote(id, editNoteBody, editNoteForClient); setEditingNote(null); }
  function startEditTask(t) { setEditingTask(t.id); setEditTaskTitle(t.title); setEditTaskDue(t.due_date || ''); setEditTaskForClient(!!t.for_client); }
  function saveEditTask(id) { editTask(id, editTaskTitle, editTaskDue, editTaskForClient); setEditingTask(null); }
  // datetime-local speaks LOCAL time; toISOString() emits UTC. Converting one way without
  // the other shifted every meeting by the UTC offset each time it was opened and saved.
  function toLocalInput(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function startEditMeeting(m) { setEditingMeeting(m.id); setEditMeetingAt(toLocalInput(m.scheduled_at)); setEditMeetingNotes(m.notes || ''); setEditMeetingForClient(!!m.for_client); }
  function saveEditMeeting(id) {
    const d = new Date(editMeetingAt);
    if (!editMeetingAt || Number.isNaN(d.getTime())) { toast('בחר תאריך ושעה', 'error'); return; }
    editMeeting(id, d.toISOString(), editMeetingNotes, editMeetingForClient);
    setEditingMeeting(null);
  }

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
      <div className={styles.sectionsGrid}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconMeetings}>{ICONS.meetings}</span>פגישות{meetings.length > 0 && <span className={styles.countBadge}>{meetings.length}</span>}</div>
        <div className={styles.form}>
          <input className={styles.input} aria-label="נושא הפגישה" placeholder="נושא / הערה" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitMeeting()} />
          <input className={styles.input} type="datetime-local" step="1800" aria-label="תאריך ושעת הפגישה" value={meetingAt} onChange={e => setMeetingAt(e.target.value)} />
          <label className={styles.forClientLabel}>
            <input type="checkbox" className={styles.checkbox} checked={meetingForClient} onChange={e => setMeetingForClient(e.target.checked)} />
            גלוי ללקוח
          </label>
          <Button disabled={!meetingAt} onClick={submitMeeting}>קבע פגישה</Button>
        </div>
        {meetings.length ? (
          <div className={styles.list}>
            {meetings.map((m, i) => editingMeeting === m.id ? (
              <div key={m.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.form} style={{ margin: 0, flex: 1 }}>
                  <input className={styles.input} aria-label="נושא הפגישה" value={editMeetingNotes} onChange={e => setEditMeetingNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditMeeting(m.id)} />
                  <input className={styles.input} type="datetime-local" step="1800" aria-label="תאריך ושעת הפגישה" value={editMeetingAt} onChange={e => setEditMeetingAt(e.target.value)} />
                  <label className={styles.forClientLabel}>
                    <input type="checkbox" className={styles.checkbox} checked={editMeetingForClient} onChange={e => setEditMeetingForClient(e.target.checked)} />
                    גלוי ללקוח
                  </label>
                  <Button onClick={() => saveEditMeeting(m.id)}>שמור</Button>
                  <Button variant="ghost" onClick={() => setEditingMeeting(null)}>ביטול</Button>
                </div>
              </div>
            ) : (() => {
              const days = daysUntil(m.scheduled_at);
              const soon = days !== null && days >= 0 && days <= 3;
              const past = days !== null && days < 0;
              return (
                <div key={m.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                  <div role="button" tabIndex={0} className={styles.rowBody} onClick={() => startEditMeeting(m)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditMeeting(m))}>
                    <div className={styles.name}>
                      {formatDateTime(m.scheduled_at)}
                      {soon && <span className={styles.soonBadge}>בעוד {days === 0 ? 'היום' : days + ' ימים'}</span>}
                      {past && <span className={styles.pastBadge}>עברה</span>}
                      {!m.for_client && <span className={styles.clientBadge}>פרטי</span>}
                      {m.for_client && m.status === 'confirmed' && <span className={styles.statusConfirmed}>אושרה ע"י הלקוח</span>}
                      {m.for_client && m.status === 'declined' && <span className={styles.statusDeclined}>נדחתה ע"י הלקוח</span>}
                      {m.for_client && m.status === 'pending' && !past && <span className={styles.statusPending}>ממתינה לאישור</span>}
                    </div>
                    {m.notes && <div className={styles.meta}>{m.notes}</div>}
                    {m.status === 'declined' && m.decline_note && <div className={styles.meta}>הערת הלקוח: {m.decline_note}</div>}
                  </div>
                  <div className={styles.rowActions}>
                    {m.for_client && m.status === 'pending' && !past && (
                      <>
                        <button type="button" className={styles.icsButton} title="סמן כמאושרת (למשל אם הלקוח אישר בטלפון)" aria-label="סמן פגישה כמאושרת" onClick={() => respondMeeting(m.id, 'confirmed')}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                        </button>
                        <button type="button" className={styles.icsButton} title="סמן כנדחתה" aria-label="סמן פגישה כנדחתה" onClick={() => respondMeeting(m.id, 'declined')}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </>
                    )}
                    <span className={styles.editHint} aria-hidden="true">{ICONS.edit}</span>
                    <button type="button" className={styles.icsButton} title="הורד ליומן" aria-label="הורד ליומן" onClick={() => downloadIcs(m)}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M12 14v4M10 16h4" />
                      </svg>
                    </button>
                    <DeleteButton onClick={() => removeMeeting(m.id)} />
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
          <textarea className={styles.textarea} aria-label="משימות" placeholder="כתוב כאן את המשימות — כל משימה בשורה נפרדת" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.ctrlKey && submitTask()} />
          <input className={styles.input} type="date" aria-label="תאריך יעד למשימות" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
          <label className={styles.forClientLabel}>
            <input type="checkbox" className={styles.checkbox} checked={taskForClient} onChange={e => setTaskForClient(e.target.checked)} />
            גלוי ללקוח
          </label>
          <Button disabled={!taskTitle.trim()} onClick={submitTask}>הוסף משימה</Button>
        </div>
        {tasks.length ? (
          <div className={styles.list}>
            {tasks.map((t, i) => editingTask === t.id ? (
              <div key={t.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.form} style={{ margin: 0, flex: 1 }}>
                  <input className={styles.input} value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditTask(t.id)} />
                  <input className={styles.input} type="date" value={editTaskDue} onChange={e => setEditTaskDue(e.target.value)} />
                  <label className={styles.forClientLabel}>
                    <input type="checkbox" className={styles.checkbox} checked={editTaskForClient} onChange={e => setEditTaskForClient(e.target.checked)} />
                    גלוי ללקוח
                  </label>
                  <Button onClick={() => saveEditTask(t.id)}>שמור</Button>
                  <Button variant="ghost" onClick={() => setEditingTask(null)}>ביטול</Button>
                </div>
              </div>
            ) : (() => {
              const now = new Date();
              const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const overdue = !t.done && t.due_date && t.due_date < todayIso;
              return (
                <div key={t.id} className={styles.row + ' ' + styles.taskRow} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                  <input className={styles.checkbox} type="checkbox" aria-label={`סמן "${t.title}" כהושלמה`} checked={t.done} onChange={e => { toggleTask(t.id, e.target.checked); notify(); }} />
                  <div role="button" tabIndex={0} className={styles.taskBody + (t.done ? ' ' + styles.done : '')} onClick={() => startEditTask(t)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditTask(t))}>
                    <div className={styles.name}>{tasks.length > 1 && <span className={styles.taskNum}>{i + 1}.</span>}{t.title}{overdue && <span className={styles.pastBadge}>באיחור</span>}{t.for_client && <span className={styles.clientBadge}>גלוי ללקוח</span>}</div>
                    {t.due_date && <div className={styles.meta}>יעד: {formatDate(t.due_date)}</div>}
                  </div>
                  <span className={styles.editHint} aria-hidden="true">{ICONS.edit}</span>
                  <DeleteButton onClick={() => removeTask(t.id)} />
                </div>
              );
            })())}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.tasks}</span>אין משימות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconNotes}>{ICONS.notes}</span>הערות{notes.length > 0 && <span className={styles.countBadge}>{notes.length}</span>}</div>
        <div className={styles.form}>
          <textarea className={styles.textarea} aria-label="הערה חדשה על הלקוח" placeholder="הערה חדשה על הלקוח" value={noteBody} onChange={e => setNoteBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submitNote())} />
          <label className={styles.forClientLabel}>
            <input type="checkbox" className={styles.checkbox} checked={noteForClient} onChange={e => setNoteForClient(e.target.checked)} />
            גלוי ללקוח
          </label>
          <Button disabled={!noteBody.trim()} onClick={submitNote}>שמור הערה</Button>
        </div>
        {notes.length ? (
          <div className={styles.list}>
            {notes.map((n, i) => editingNote === n.id ? (
              <div key={n.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.form} style={{ margin: 0, flex: 1 }}>
                  <textarea className={styles.textarea} value={editNoteBody} onChange={e => setEditNoteBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), saveEditNote(n.id))} />
                  <label className={styles.forClientLabel}>
                    <input type="checkbox" className={styles.checkbox} checked={editNoteForClient} onChange={e => setEditNoteForClient(e.target.checked)} />
                    גלוי ללקוח
                  </label>
                  <Button onClick={() => saveEditNote(n.id)}>שמור</Button>
                  <Button variant="ghost" onClick={() => setEditingNote(null)}>ביטול</Button>
                </div>
              </div>
            ) : (
              <div key={n.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div role="button" tabIndex={0} className={styles.rowBody} onClick={() => startEditNote(n)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditNote(n))}>
                  <div>{n.body}{n.for_client && <span className={styles.clientBadge}>גלוי ללקוח</span>}</div>
                  <div className={styles.meta}>{formatDate(n.created_at)}</div>
                </div>
                <span className={styles.editHint} aria-hidden="true">{ICONS.edit}</span>
                <DeleteButton onClick={() => deleteNote(n.id)} />
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.notes}</span>אין הערות</div>}
      </div>
      </div>
    </div>
  );
}
