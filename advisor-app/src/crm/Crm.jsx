import { useCallback, useEffect, useState } from 'react';
import { useClientCrm } from './useClientCrm.js';
import { useClientProfile } from './useClientProfile.js';
import { formatDate, formatDateTime } from '../budget/monthUtils.js';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import Skeleton from '../components/Skeleton.jsx';
import AddForm from '../components/AddForm.jsx';
import { KeyValue } from '../components/Rows.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { toast } from '../toast.js';
import styles from './Crm.module.css';
import MeetingSummary from './MeetingSummary.jsx';
import MeetingPrep from './MeetingPrep.jsx';

const ICONS = {
  meetings: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  tasks: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  edit: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
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

export default function Crm({ action, advisorId, clientId, email, onChange, onDirtyChange }) {
  const { tasks, meetings, loading, error, reload, addTasks, editTask, toggleTask, deleteTask, addMeeting, editMeeting, deleteMeeting, respondMeeting, setMeetingSummary } = useClientCrm(advisorId, clientId, onChange);
  const { profile, save: saveProfile } = useClientProfile(advisorId, clientId);
  const [nameDraft, setNameDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [backgroundDraft, setBackgroundDraft] = useState('');
  const [profileDirty, setProfileDirty] = useState(false);
  useEffect(() => {
    setProfileDirty(false);
  }, [clientId]);
  useEffect(() => {
    if (!profile || profileDirty) return;
    setNameDraft(profile.name || '');
    setPhoneDraft(profile.phone || '');
    setBackgroundDraft(profile.background || '');
  }, [profile, profileDirty]);
  async function saveProfileFields() {
    const ok = await saveProfile({ name: nameDraft, phone: phoneDraft, background: backgroundDraft });
    if (ok) { setProfileDirty(false); notify(); }
  }
  const [meetingDirty, setMeetingDirty] = useState({});
  const markMeetingDirty = useCallback((id, dirty) => setMeetingDirty(prev => prev[id] === dirty ? prev : { ...prev, [id]: dirty }), []);
  const [taskResponsible, setTaskResponsible] = useState('advisor');
  const [taskKind, setTaskKind] = useState('action');
  const [editResponsible, setEditResponsible] = useState('advisor');
  const [editKind, setEditKind] = useState('action');
  const [savingTask, setSavingTask] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskForClient, setTaskForClient] = useState(false);
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingForClient, setMeetingForClient] = useState(true);
  const notify = () => { if (onChange) onChange(); };

  async function submitMeeting() {
    if (!meetingAt || savingMeeting) return;
    setSavingMeeting(true);
    try {
      const ok = await addMeeting(new Date(meetingAt).toISOString(), meetingNotes, meetingForClient);
      if (ok) { setMeetingAt(''); setMeetingNotes(''); setMeetingForClient(true); notify(); }
    } finally { setSavingMeeting(false); }
  }
  async function submitTask() {
    if (!taskTitle.trim() || savingTask) return;
    setSavingTask(true);
    try {
      const ok = await addTasks(taskTitle, taskDue, taskForClient, { responsible: taskResponsible, task_kind: taskKind });
      if (ok) { setTaskTitle(''); setTaskDue(''); setTaskForClient(false); notify(); }
    } finally { setSavingTask(false); }
  }
  async function removeMeeting(id) { await deleteMeeting(id); notify(); }
  async function removeTask(id) { await deleteTask(id); notify(); }

  const [editingTask, setEditingTask] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDue, setEditTaskDue] = useState('');
  const [editTaskForClient, setEditTaskForClient] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [editMeetingAt, setEditMeetingAt] = useState('');
  const [editMeetingNotes, setEditMeetingNotes] = useState('');
  const [editMeetingForClient, setEditMeetingForClient] = useState(true);
  const currentTask = tasks.find(t => t.id === editingTask);
  const taskChanged = !!currentTask && (editTaskTitle !== currentTask.title || editTaskDue !== (currentTask.due_date || '') || editTaskForClient !== !!currentTask.for_client || editResponsible !== (currentTask.responsible || 'advisor') || editKind !== (currentTask.task_kind || 'action'));
  const currentMeeting = meetings.find(m => m.id === editingMeeting);
  const meetingChanged = !!currentMeeting && (editMeetingAt !== toLocalInput(currentMeeting.scheduled_at) || editMeetingNotes !== (currentMeeting.notes || '') || editMeetingForClient !== !!currentMeeting.for_client);
  const profileChanged = profileDirty && (nameDraft !== (profile?.name || '') || phoneDraft !== (profile?.phone || '') || backgroundDraft !== (profile?.background || ''));
  const signal = type => (action?.type === type ? action.id : 0);

  function startEditTask(t) { if (savingTask || taskChanged) { toast('שמור או בטל את עריכת המשימה הנוכחית לפני מעבר למשימה אחרת', 'info'); return; } setEditingTask(t.id); setEditTaskTitle(t.title); setEditTaskDue(t.due_date || ''); setEditTaskForClient(!!t.for_client); setEditResponsible(t.responsible || 'advisor'); setEditKind(t.task_kind || 'action'); }
  async function saveEditTask(id) {
    if (savingTask) return;
    setSavingTask(true);
    try { if (await editTask(id, editTaskTitle, editTaskDue, editTaskForClient, editResponsible, editKind)) { setEditingTask(null); notify(); } }
    finally { setSavingTask(false); }
  }
  // datetime-local speaks LOCAL time; toISOString() emits UTC. Converting one way without
  // the other shifted every meeting by the UTC offset each time it was opened and saved.
  function toLocalInput(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function startEditMeeting(m) { if (savingMeeting || meetingChanged) { toast('שמור או בטל את עריכת הפגישה הנוכחית לפני מעבר לפגישה אחרת', 'info'); return; } if (meetingDirty[m.id]) { toast('שמור קודם את הסיכום ומשימות ההמשך של הפגישה', 'info'); return; } setEditingMeeting(m.id); setEditMeetingAt(toLocalInput(m.scheduled_at)); setEditMeetingNotes(m.notes || ''); setEditMeetingForClient(!!m.for_client); }
  async function saveEditMeeting(id) {
    const d = new Date(editMeetingAt);
    if (!editMeetingAt || Number.isNaN(d.getTime())) { toast('בחר תאריך ושעה', 'error'); return; }
    if (savingMeeting) return;
    setSavingMeeting(true);
    try { if (await editMeeting(id, d.toISOString(), editMeetingNotes, editMeetingForClient)) { setEditingMeeting(null); notify(); } }
    finally { setSavingMeeting(false); }
  }

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const overdueTasks = tasks.filter(t => !t.done && t.due_date && t.due_date < todayIso).length;
  const soonMeetings = meetings.filter(m => { const d = daysUntil(m.scheduled_at); return d !== null && d >= 0 && d <= 3; }).length;

  const dirty = savingTask || savingMeeting || profileChanged || Object.entries(meetingDirty).some(([id, value]) => value && meetings.some(m => m.id === id)) || !!taskTitle.trim() || !!meetingAt || !!meetingNotes.trim() || taskChanged || meetingChanged;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (loading || action?.type !== 'tasks') return;
    document.getElementById('client-tasks')?.scrollIntoView({ block: 'start' });
  }, [loading, action]);

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
      <MeetingPrep advisorId={advisorId} clientId={clientId} tasks={tasks} meetings={meetings} openSignal={action?.type === 'prep' ? action.id : 0} />
      {(overdueTasks > 0 || soonMeetings > 0) && (
        <div className={styles.reminderBar}>
          {overdueTasks > 0 && (
            <span className={styles.reminderChip + ' ' + styles.reminderChipBad}>
              {overdueTasks === 1 ? 'משימה אחת באיחור' : `${overdueTasks} משימות באיחור`}
            </span>
          )}
          {soonMeetings > 0 && (
            <span className={styles.reminderChip}>
              {soonMeetings === 1 ? 'פגישה אחת בקרוב' : `${soonMeetings} פגישות בקרוב`}
            </span>
          )}
        </div>
      )}
      <div className={styles.sectionsGrid}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          פרטי קשר ורקע
        </h2>
        <div>
          <div className={styles.sectionBodyInner}>
            <KeyValue label="אימייל" value={email} ltr />
            {phoneDraft && <KeyValue label="טלפון" value={phoneDraft} ltr />}
            {backgroundDraft && <KeyValue label="רקע" value={backgroundDraft} />}
            <AddForm label="עריכת פרטים" open={profileDirty} openSignal={signal('profile')} className={styles.profileEdit}>
              <div className={styles.formPlain}>
                <input className={styles.input} aria-label="שם הלקוח" placeholder="שם הלקוח" style={{ flex: '0 0 200px' }} value={nameDraft} onChange={e => { setNameDraft(e.target.value); setProfileDirty(true); }} />
                <input className={styles.input} aria-label="אימייל" value={email || ''} disabled dir="ltr" style={{ flex: '0 0 220px' }} />
                <input className={styles.input} aria-label="טלפון" placeholder="טלפון" dir="ltr" style={{ flex: '0 0 160px' }} value={phoneDraft} onChange={e => { setPhoneDraft(e.target.value); setProfileDirty(true); }} />
              </div>
              <textarea
                className={styles.textarea}
                style={{ width: '100%', marginTop: 'var(--space-3)', minHeight: 72 }}
                aria-label="רקע על הלקוח"
                placeholder="רקע על הלקוח: מצב משפחתי, מטרות, הקשר שכדאי לזכור…"
                value={backgroundDraft}
                onChange={e => { setBackgroundDraft(e.target.value); setProfileDirty(true); }}
              />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Button onClick={saveProfileFields} disabled={!profileChanged}>שמור</Button>
              </div>
            </AddForm>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          פגישות{meetings.length > 0 && <span className={styles.countBadge}>{meetings.length}</span>}
        </h2>
        <div>
        <div className={styles.sectionBodyInner}>
        <AddForm label="קבע פגישה" openSignal={signal('meeting')} className={styles.form}>
          <input className={styles.input} disabled={savingMeeting} aria-label="נושא הפגישה" placeholder="נושא / הערה" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitMeeting()} />
          <input className={styles.input} type="datetime-local" step="1800" disabled={savingMeeting} aria-label="תאריך ושעת הפגישה" value={meetingAt} onChange={e => setMeetingAt(e.target.value)} />
          <label className={styles.forClientLabel}>
            <input type="checkbox" className={styles.checkbox} disabled={savingMeeting} checked={meetingForClient} onChange={e => setMeetingForClient(e.target.checked)} />
            גלוי ללקוח
          </label>
          <Button disabled={!meetingAt || savingMeeting} onClick={submitMeeting}>קבע פגישה</Button>
        </AddForm>
        {meetings.length ? (
          <div className={styles.list}>
            {meetings.map((m, i) => editingMeeting === m.id ? (
              <div key={m.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.form} style={{ margin: 0, flex: 1 }}>
                  <input className={styles.input} disabled={savingMeeting} aria-label="נושא הפגישה" value={editMeetingNotes} onChange={e => setEditMeetingNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditMeeting(m.id)} />
                  <input className={styles.input} type="datetime-local" step="1800" disabled={savingMeeting} aria-label="תאריך ושעת הפגישה" value={editMeetingAt} onChange={e => setEditMeetingAt(e.target.value)} />
                  <label className={styles.forClientLabel}>
                    <input type="checkbox" className={styles.checkbox} disabled={savingMeeting} checked={editMeetingForClient} onChange={e => setEditMeetingForClient(e.target.checked)} />
                    גלוי ללקוח
                  </label>
                  <Button disabled={savingMeeting} onClick={() => saveEditMeeting(m.id)}>שמור</Button>
                  <Button variant="ghost" disabled={savingMeeting} onClick={() => setEditingMeeting(null)}>ביטול</Button>
                </div>
              </div>
            ) : (() => {
              const days = daysUntil(m.scheduled_at);
              const soon = days !== null && days >= 0 && days <= 3;
              const past = days !== null && days < 0;
              return (
                <div key={m.id} className={styles.row + ' ' + styles.meetingRow + (soon ? ' ' + styles.meetingUpcoming : '')} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                  <div className={styles.rowMain}>
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
                          <button type="button" className={styles.icsButton} title="סמן כמאושרת (למשל אם הלקוח אישר בטלפון)" aria-label="סמן פגישה כמאושרת" onClick={async () => { if (await respondMeeting(m.id, 'confirmed')) notify(); }}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                          </button>
                          <button type="button" className={styles.icsButton} title="סמן כנדחתה" aria-label="סמן פגישה כנדחתה" onClick={async () => { if (await respondMeeting(m.id, 'declined')) notify(); }}>
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
                  <MeetingSummary key={m.id} meeting={m} tasks={tasks.filter(t => t.meeting_id === m.id)} onSave={setMeetingSummary} onAddTasks={addTasks} onDirtyChange={markMeetingDirty} onChange={notify} />
                </div>
              );
            })())}
          </div>
        ) : <div className={styles.empty}><span className={styles.emptyMark}>{ICONS.meetings}</span>אין פגישות מתוזמנות</div>}
        </div>
        </div>
      </div>

      <div id="client-tasks" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          משימות{tasks.length > 0 && <span className={styles.countBadge}>{tasks.length}</span>}
        </h2>
        <div>
        <div className={styles.sectionBodyInner}>
        <AddForm label="הוסף משימות" openSignal={signal('task')} className={styles.form}>
          <textarea className={styles.textarea} disabled={savingTask} aria-label="משימות" placeholder="כתוב כאן את המשימות, כל משימה בשורה נפרדת" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.ctrlKey && submitTask()} />
          <input className={styles.input} type="date" disabled={savingTask} aria-label="תאריך יעד למשימות" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
          <label className={styles.forClientLabel}>
            <input type="checkbox" className={styles.checkbox} disabled={savingTask} checked={taskForClient} onChange={e => setTaskForClient(e.target.checked)} />
            גלוי ללקוח
          </label>
          <label className={styles.fieldLabel}>אחראי<select className={styles.input} disabled={savingTask} aria-label="אחראי למשימות" value={taskResponsible} onChange={e => setTaskResponsible(e.target.value)}><option value="advisor">היועץ</option><option value="client">הלקוח</option></select></label>
          <label className={styles.fieldLabel}>סוג<select className={styles.input} disabled={savingTask} aria-label="סוג המשימות" value={taskKind} onChange={e => setTaskKind(e.target.value)}><option value="action">פעולה</option><option value="document">מסמך שממתינים לו</option></select></label>
          <Button disabled={!taskTitle.trim() || savingTask} onClick={submitTask}>הוסף משימה</Button>
        </AddForm>
        {tasks.length ? (
          <div className={styles.list}>
            {tasks.map((t, i) => editingTask === t.id ? (
              <div key={t.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                <div className={styles.form} style={{ margin: 0, flex: 1 }}>
                  <input className={styles.input} disabled={savingTask} aria-label="תיאור המשימה" value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditTask(t.id)} />
                  <input className={styles.input} type="date" disabled={savingTask} aria-label="תאריך יעד למשימה" value={editTaskDue} onChange={e => setEditTaskDue(e.target.value)} />
                  <label className={styles.forClientLabel}>
                    <input type="checkbox" className={styles.checkbox} disabled={savingTask} checked={editTaskForClient} onChange={e => setEditTaskForClient(e.target.checked)} />
                    גלוי ללקוח
                  </label>
                  <select className={styles.input} disabled={savingTask} aria-label="אחראי למשימה" value={editResponsible} onChange={e => setEditResponsible(e.target.value)}><option value="advisor">היועץ</option><option value="client">הלקוח</option></select>
                  <select className={styles.input} disabled={savingTask} aria-label="סוג המשימה" value={editKind} onChange={e => setEditKind(e.target.value)}><option value="action">פעולה</option><option value="document">מסמך שממתינים לו</option></select>
                  <Button disabled={savingTask} onClick={() => saveEditTask(t.id)}>שמור</Button>
                  <Button variant="ghost" disabled={savingTask} onClick={() => setEditingTask(null)}>ביטול</Button>
                </div>
              </div>
            ) : (() => {
              const now = new Date();
              const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const overdue = !t.done && t.due_date && t.due_date < todayIso;
              return (
                <div key={t.id} className={styles.row + ' ' + styles.taskRow + (t.done ? ' ' + styles.taskCompleted : overdue ? ' ' + styles.taskOverdue : '')} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }}>
                  <input className={styles.checkbox} type="checkbox" aria-label={`סמן "${t.title}" כהושלמה`} checked={t.done} onChange={e => { toggleTask(t.id, e.target.checked); notify(); }} />
                  <div role="button" tabIndex={0} className={styles.taskBody + (t.done ? ' ' + styles.done : '')} onClick={() => startEditTask(t)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditTask(t))}>
                    <div className={styles.name}>{tasks.length > 1 && <span className={styles.taskNum}>{i + 1}.</span>}{t.title}{t.done && <span className={styles.completedBadge}>הושלמה</span>}{overdue && <span className={styles.pastBadge}>באיחור</span>}{t.for_client && <span className={styles.clientBadge}>גלוי ללקוח</span>}</div>
                    <div className={styles.meta}>{t.responsible === 'client' ? 'באחריות הלקוח' : 'באחריות היועץ'}{t.task_kind === 'document' ? ' · ממתינים למסמך' : ''}</div>
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
        </div>
      </div>

      </div>
    </div>
  );
}
