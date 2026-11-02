import { useEffect, useRef, useState } from 'react';
import { useProspects } from './useProspects.js';
import { funnelStats, percentLabel } from '../business/bizMath.js';
import { formatDate, localISODate } from '../budget/monthUtils.js';
import HeaderAction from '../business/HeaderAction.jsx';
import Modal from '../business/Modal.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useUrlParam } from '../useUrlParam.js';
import styles from './Prospects.module.css';
import biz from '../business/Business.module.css';

const STATUSES = [
  { key: 'new', label: 'חדש', color: 'var(--accent)' },
  { key: 'no_answer', label: 'אין מענה', color: 'var(--yellow)' },
  { key: 'followup', label: 'פולואפ', color: 'var(--purple, #8b5cf6)' },
  { key: 'closed', label: 'נסגר', color: 'var(--green)' },
  { key: 'relevant_not_closed', label: 'רלוונטי ולא נסגר', color: 'var(--orange, #c27c0e)' },
  { key: 'not_relevant', label: 'לא רלוונטי ולא נסגר', color: 'var(--red)' }
];
const SOURCES = ['דף נחיתה', 'הודעות בפרטי', 'פה לאוזן · לקוח ישן', 'המלצה', 'אחר'];
const EMPTY = { status: 'new', name: '', phone: '', email: '', source: '', notes: '', contacted_at: '', meeting_date: '', meeting_time: '', attempts: 0, attendance_confirmed: false, showed: false, relevant: false, closed: false, closed_at: '' };
const AUTOSAVE_MS = 500;

const toRow = (form, today) => ({
  name: form.name.trim(),
  phone: form.phone.trim() || null,
  email: form.email.trim() || null,
  source: form.source.trim() || null,
  notes: form.notes.trim() || null,
  contacted_at: form.contacted_at || today,
  meeting_date: form.meeting_date || null,
  meeting_time: form.meeting_time || null,
  attempts: form.attempts,
  attendance_confirmed: form.attendance_confirmed,
  showed: form.showed,
  relevant: form.relevant,
  closed: form.closed,
  closed_at: form.closed ? (form.closed_at || today) : null,
  status: form.status
});

export default function Prospects({ advisorId, onConvert }) {
  const { prospects, loading, error, reload, addProspect, updateProspect, deleteProspect } = useProspects(advisorId);
  const [sourceFilter, setSourceFilter] = useUrlParam('ps', 'all');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [meetingDetailsOpen, setMeetingDetailsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const nameRef = useRef(null);
  const restoreId = useRef(null);
  const saveTimer = useRef(null);
  const pending = useRef(null);
  const saveVersion = useRef(0);
  const [saveState, setSaveState] = useState('saved');

  useEffect(() => {
    if (editingId != null) {
      nameRef.current?.focus();
    } else if (restoreId.current != null) {
      document.querySelector(`[data-open-prospect="${restoreId.current}"]`)?.focus();
      restoreId.current = null;
    }
  }, [editingId]);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="16px" />;

  const today = localISODate();
  const bySource = sourceFilter === 'all' ? prospects : prospects.filter(p => (p.source || '') === sourceFilter);
  const visible = search.trim() ? bySource.filter(p => [p.name, p.phone, p.email].some(v => (v || '').includes(search.trim()))) : bySource;
  const usedSources = [...new Set(prospects.map(p => p.source).filter(Boolean))];
  const stats = funnelStats(prospects);
  const closeOfAll = stats.showed > 0 ? stats.closed / stats.showed : null;

  function startEdit(p) {
    saveVersion.current += 1;
    setSaveState('saved');
    setEditingId(p.id);
    setMeetingDetailsOpen(true);
    setModalOpen(true);
    setForm({ status: p.status || 'new', name: p.name || '', phone: p.phone || '', email: p.email || '', source: p.source || '', notes: p.notes || '', contacted_at: p.contacted_at || '', meeting_date: p.meeting_date || '', meeting_time: p.meeting_time || '', attempts: p.attempts || 0, attendance_confirmed: !!p.attendance_confirmed, showed: !!p.showed, relevant: !!p.relevant, closed: !!p.closed, closed_at: p.closed_at || '' });
  }

  async function flush() {
    clearTimeout(saveTimer.current);
    if (pending.current) {
      const { id, next } = pending.current;
      pending.current = null;
      const version = saveVersion.current;
      setSaveState('saving');
      const ok = await updateProspect(id, toRow(next, today));
      if (version === saveVersion.current) setSaveState(ok ? 'saved' : 'error');
    }
  }

  function reset() {
    flush();
    saveVersion.current += 1;
    restoreId.current = editingId;
    setEditingId(null);
    setForm(EMPTY);
    setModalOpen(false);
  }

  function patchForm(patch) {
    const next = { ...form, ...patch };
    if ('closed' in patch) next.closed_at = patch.closed ? (form.closed_at || today) : '';
    setForm(next);
    if (editingId != null && !next.name.trim()) {
      clearTimeout(saveTimer.current);
      pending.current = null;
      saveVersion.current += 1;
      setSaveState('invalid');
    }
    if (editingId != null && next.name.trim()) {
      saveVersion.current += 1;
      setSaveState('pending');
      pending.current = { id: editingId, next };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, AUTOSAVE_MS);
    }
  }

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    const ok = await addProspect(toRow(form, today));
    setSaving(false);
    if (ok) reset();
  }

  async function remove() {
    clearTimeout(saveTimer.current);
    pending.current = null;
    const id = editingId;
    reset();
    await deleteProspect(id);
  }

  const editing = editingId != null;
  const editedProspect = editing ? prospects.find(p => p.id === editingId) : null;

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>מתעניינים</h1>
      <HeaderAction><button type="button" className={biz.btn} onClick={() => { setForm(EMPTY); setEditingId(null); setMeetingDetailsOpen(false); setModalOpen(true); }}>+ הוסף ליד</button></HeaderAction>

      <section className={biz.bigCard + ' ' + styles.overview} style={{ marginBottom: 'var(--space-3)' }}>
        <div className={styles.overviewGrid} role="group" aria-label="מדדי מכירות">
        <div className={biz.stat}><div className={biz.statLabel}>פגישות התאמה שנקבעו</div><div className={biz.statValue}>{stats.meetings}</div><div className={biz.statNote}>מתוך {stats.total} לידים</div></div>
        <div className={biz.stat}><div className={biz.statLabel}>אחוז הגעה לשיחות</div><div className={biz.statValue}>{percentLabel(stats.showRate)}</div><div className={biz.statNote}>{stats.showed} הגיעו מתוך {stats.total} לידים</div></div>
        <div className={biz.stat}><div className={biz.statLabel}>אחוז רלוונטיות</div><div className={biz.statValue}>{percentLabel(stats.relevantRate)}</div><div className={biz.statNote}>{stats.relevant} רלוונטיים מתוך {stats.showed}</div></div>
        <div className={biz.stat}><div className={biz.statLabel}>אחוז סגירה</div><div className={biz.statValue}>{percentLabel(stats.closeRate)}</div><div className={biz.statNote}>{stats.closed} נסגרו מתוך {stats.relevant} רלוונטיים</div></div>
        <div className={biz.stat}><div className={biz.statLabel}>אחוז סגירה מכל השיחות</div><div className={biz.statValue}>{percentLabel(closeOfAll)}</div><div className={biz.statNote}>{stats.closed} נסגרו מתוך {stats.showed} שהגיעו</div></div>
      </div>
      </section>

      <div className={biz.toolbar} style={{ marginBottom: 'var(--space-3)' }}>
        <input className={biz.input + ' ' + biz.inputGrow} type="search" placeholder="חיפוש ליד..." aria-label="חיפוש ליד" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.tempSelect} aria-label="סינון לפי מקור" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">כל המקורות</option>
          {usedSources.map(src => <option key={src} value={src}>{src}</option>)}
        </select>
      </div>

      <div className={styles.board}>
        {STATUSES.map(s => {
          const cards = visible.filter(p => (p.status || 'new') === s.key);
          return (
            <section key={s.key} className={styles.column} aria-label={s.label}>
              <div className={styles.columnHead}>
                <span className={styles.columnTitle}><span className={styles.dot} style={{ background: s.color }} aria-hidden="true" />{s.label}</span>
                <span className={styles.columnCount}>{cards.length}</span>
              </div>
              {cards.length === 0 ? <div className={styles.columnEmpty}>אין</div> : cards.map(p => (
                <button key={p.id} type="button" className={styles.leadCard} data-open-prospect={p.id} onClick={() => startEdit(p)} aria-label={'פתח ליד: ' + p.name}>
                  <span className={styles.leadHeading}><span className={styles.leadName}>{p.name}</span><span className={styles.openArrow} aria-hidden="true">←</span></span>
                  {p.phone && <span className={styles.leadPhone} dir="ltr">{p.phone}</span>}
                  {p.meeting_date && <span className={styles.meetingNote}>פגישה {formatDate(p.meeting_date)}{p.meeting_time ? ' · ' + p.meeting_time.slice(0, 5) : ''}</span>}
                  <span className={styles.leadFooter}>{p.source && <span>{p.source}</span>}{p.contacted_at && <span>נכנס {formatDate(p.contacted_at)}</span>}</span>
                </button>
              ))}
            </section>
          );
        })}
      </div>
      <p className={biz.note}>כל המדדים למעלה מתעדכנים אוטומטית מטבלת הלידים.</p>

      {modalOpen && (
        <Modal title={editing ? 'עריכת ליד: ' + form.name : 'ליד חדש'} onClose={reset} wide>
          <form className={biz.formGrid} onSubmit={e => { e.preventDefault(); if (!editing) submit(); }}>
            {editing && <div className={biz.saveStatus + (saveState === 'error' || saveState === 'invalid' ? ' ' + biz.saveFailure : '')} role={saveState === 'error' || saveState === 'invalid' ? 'alert' : 'status'}>
              <span>{saveState === 'saving' ? 'שומר שינויים…' : saveState === 'pending' ? 'יש שינויים לשמירה' : saveState === 'invalid' ? 'יש להזין שם כדי לשמור' : saveState === 'error' ? 'השמירה נכשלה. השינויים שלך עדיין בטופס.' : 'כל השינויים נשמרו'}</span>
              {saveState === 'error' && <button type="button" className={biz.btnGhost} onClick={() => { saveVersion.current += 1; pending.current = { id: editingId, next: form }; flush(); }}>נסה שוב</button>}
            </div>}
            <section className={styles.contactSection} aria-label="פרטי קשר"><h3 className={biz.formSection}>פרטי קשר</h3>
            <label className={biz.fieldLabel}>שם מלא · חובה<input ref={nameRef} className={biz.input} value={form.name} onChange={e => patchForm({ name: e.target.value })} /></label>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>טלפון<input className={biz.input} dir="ltr" inputMode="tel" value={form.phone} onChange={e => patchForm({ phone: e.target.value })} /></label>
              <label className={biz.fieldLabel}>אימייל<input className={biz.input} dir="ltr" type="email" value={form.email} onChange={e => patchForm({ email: e.target.value })} /></label>
            </div>
            </section>
            <details className={biz.formDetails + ' ' + styles.meetingDetails} open={meetingDetailsOpen} onToggle={e => setMeetingDetailsOpen(e.currentTarget.open)}>
              <summary>פגישה, שלב וסיכום שיחה</summary>
              <div className={biz.formGrid}>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>מקור הגעה<select className={biz.select} value={form.source} onChange={e => patchForm({ source: e.target.value })}><option value="">בחר מקור</option>{[...new Set([...SOURCES, form.source].filter(Boolean))].map(src => <option key={src} value={src}>{src}</option>)}</select></label>
              <label className={biz.fieldLabel}>תאריך כניסת ליד<input className={biz.input} type="date" value={form.contacted_at} onChange={e => patchForm({ contacted_at: e.target.value })} /></label>
            </div>
            <h3 className={styles.sectionTitle}>תיאום פגישת התאמה</h3>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>תאריך פגישת התאמה<input className={biz.input} type="date" value={form.meeting_date} onChange={e => patchForm({ meeting_date: e.target.value })} /></label>
              <label className={biz.fieldLabel}>שעת הפגישה<input className={biz.input} type="time" value={form.meeting_time} onChange={e => patchForm({ meeting_time: e.target.value })} /></label>
            </div>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>שלב<select className={biz.select} value={form.status} onChange={e => patchForm({ status: e.target.value })}>{STATUSES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}</select></label>
              <div className={biz.fieldLabel}>ניסיונות מענה
                <div className={biz.toolbar}>
                  <button type="button" className={biz.iconBtn} aria-label="הורדה" onClick={() => patchForm({ attempts: Math.max(0, form.attempts - 1) })}>−</button>
                  <strong className={biz.num} aria-live="polite">{form.attempts}</strong>
                  <button type="button" className={biz.btnGhost} onClick={() => patchForm({ attempts: Math.min(50, form.attempts + 1) })}>עוד ניסיון</button>
                </div>
              </div>
            </div>
            <fieldset className={styles.outcomes}><legend>תוצאות השיחה</legend>
              {[['attendance_confirmed', 'וידא הגעה לפגישת ההתאמה'], ['showed', 'הגיע לשיחה'], ['relevant', 'רלוונטי'], ['closed', 'נסגר']].map(([key, label]) => (
                <label key={key} className={biz.toolbar}><input type="checkbox" className={biz.check} checked={form[key]} onChange={e => patchForm({ [key]: e.target.checked })} />{label}</label>
              ))}
            </fieldset>
            <label className={biz.fieldLabel}>פירוט שיחה<textarea className={biz.input + ' ' + biz.textarea} placeholder="מצב נוכחי, כאב מרכזי, מטרות, התנגדויות, מה סוכם..." value={form.notes} onChange={e => patchForm({ notes: e.target.value })} /></label>
              </div>
            </details>
            {editing && <details className={biz.dangerDetails}><summary>פעולות נוספות</summary><button type="button" className={biz.btnGhost} onClick={remove}>מחיקת הליד</button></details>}
            {editing ? (
              <div className={biz.formActions}>
                <button type="button" className={biz.btn} onClick={reset}>סגירה</button>
                {editedProspect && editedProspect.status !== 'not_relevant' && <button type="button" className={biz.btnGhost} onClick={() => onConvert(editedProspect)}>פתח כלקוח</button>}

              </div>
            ) : (
              <div className={biz.formActions}>
                <button type="submit" className={biz.btn} disabled={saving || !form.name.trim()}>הוספת ליד</button>
                <button type="button" className={biz.btnGhost} onClick={reset}>ביטול</button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
