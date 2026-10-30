import { useEffect, useRef, useState } from 'react';
import { useProspects } from './useProspects.js';
import { formatDate, localISODate } from '../budget/monthUtils.js';
import { CardGrid, Card } from '../components/Rows.jsx';
import HeaderAction from '../business/HeaderAction.jsx';
import Modal from '../business/Modal.jsx';
import Button from '../components/Button.jsx';
import EditButton from '../components/EditButton.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useUrlParam } from '../useUrlParam.js';
import styles from './Prospects.module.css';
import biz from '../business/Business.module.css';
import { funnelStats, percentLabel } from '../business/bizMath.js';

const STATUSES = [
  { key: 'new', label: 'חדש', tone: 'info' },
  { key: 'contacted', label: 'נוצר קשר', tone: 'warn' },
  { key: 'followup', label: 'פולואפ', tone: 'warn' },
  { key: 'meeting', label: 'נקבע', tone: 'good' },
  { key: 'closed', label: 'נסגר', tone: 'done' },
  { key: 'converted', label: 'הפך ללקוח', tone: 'done' },
  { key: 'not_relevant', label: 'לא רלוונטי', tone: 'muted' }
];
const TEMPS = [
  { key: 'hot', label: 'חם', tone: 'hot' },
  { key: 'warm', label: 'פושר', tone: 'warmTemp' },
  { key: 'cold', label: 'קר', tone: 'cold' }
];
const OPEN_STATUSES = ['new', 'contacted', 'followup', 'meeting'];
const CONVERT_STATUSES = ['closed', 'converted'];
const DATED_STATUSES = { followup: 'פולואפ', meeting: 'נקבע ל' };
const SOURCES = ['דף נחיתה', 'הודעות בפרטי', 'פה לאוזן · לקוח ישן', 'המלצה', 'רשתות חברתיות', 'אתר', 'וואטסאפ', 'אחר'];
const EMPTY = { temperature: 'warm', status: 'new', name: '', phone: '', email: '', source: '', notes: '', contacted_at: '', follow_up_at: '', meeting_date: '', meeting_time: '', attempts: 0, attendance_confirmed: false, showed: false, relevant: false, closed: false };

const tempInfo = key => TEMPS.find(t => t.key === key) || TEMPS[1];
const statusInfo = key => STATUSES.find(s => s.key === key) || STATUSES[0];

export default function Prospects({ advisorId, onConvert }) {
  const { prospects, loading, error, reload, addProspect, updateProspect, deleteProspect } = useProspects(advisorId);
  const [filter, setFilter] = useUrlParam('pf', 'open');
  const [tempFilter, setTempFilter] = useUrlParam('pt', 'all');
  const [sourceFilter, setSourceFilter] = useUrlParam('ps', 'all');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const nameRef = useRef(null);
  const statusFiltersRef = useRef(null);
  const restoreId = useRef(null);

  useEffect(() => {
    if (editingId != null) {
      nameRef.current?.focus();
    } else if (restoreId.current != null) {
      document.querySelector(`[data-edit-prospect="${restoreId.current}"]`)?.focus();
      restoreId.current = null;
    }
  }, [editingId]);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="16px" />;

  const today = localISODate();
  const open = prospects.filter(p => OPEN_STATUSES.includes(p.status));
  const dueNow = open.filter(p => p.follow_up_at && p.follow_up_at <= today).length;
  const thisMonth = prospects.filter(p => (p.contacted_at || '').startsWith(today.slice(0, 7))).length;

  const hot = open.filter(p => p.temperature === 'hot').length;
  const byStatus = filter === 'all' ? prospects : filter === 'open' ? open : prospects.filter(p => p.status === filter);
  const byTemp = tempFilter === 'all' ? byStatus : byStatus.filter(p => (p.temperature || 'warm') === tempFilter);
  const bySource = sourceFilter === 'all' ? byTemp : byTemp.filter(p => (p.source || '') === sourceFilter);
  const visible = search.trim() ? bySource.filter(p => [p.name, p.phone, p.email].some(v => (v || '').includes(search.trim()))) : bySource;
  const meetingsSet = prospects.filter(p => p.meeting_date).length;
  const funnel = funnelStats(prospects);
  const usedSources = [...new Set(prospects.map(p => p.source).filter(Boolean))];

  function startEdit(p) {
    setEditingId(p.id);
    setModalOpen(true);
    setForm({ temperature: p.temperature || 'warm', status: p.status || 'new', name: p.name || '', phone: p.phone || '', email: p.email || '', source: p.source || '', notes: p.notes || '', contacted_at: p.contacted_at || '', follow_up_at: p.follow_up_at || '', meeting_date: p.meeting_date || '', meeting_time: p.meeting_time || '', attempts: p.attempts || 0, attendance_confirmed: !!p.attendance_confirmed, showed: !!p.showed, relevant: !!p.relevant, closed: !!p.closed });
  }

  function reset() {
    restoreId.current = editingId;
    setEditingId(null);
    setForm(EMPTY);
    setModalOpen(false);
  }

  async function changeStatus(id, status) {
    const stillShown = filter === 'all' || (filter === 'open' ? OPEN_STATUSES.includes(status) : status === filter);
    await updateProspect(id, { status });
    if (!stillShown) statusFiltersRef.current?.querySelector('[aria-pressed="true"]')?.focus();
  }

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    const row = {
      temperature: form.temperature,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      contacted_at: form.contacted_at || today,
      follow_up_at: form.follow_up_at || null,
      meeting_date: form.meeting_date || null,
      meeting_time: form.meeting_time || null,
      attempts: form.attempts,
      attendance_confirmed: form.attendance_confirmed,
      showed: form.showed,
      relevant: form.relevant,
      closed: form.closed,
      status: form.status
    };
    const ok = editingId != null ? await updateProspect(editingId, row) : await addProspect(row);
    setSaving(false);
    if (ok) reset();
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>מתעניינים</h1>
      <HeaderAction targetId="biz-header-sub" fallback={false}><p className={biz.headSub}>{prospects.length} לידים במערכת</p></HeaderAction>
      <HeaderAction><button type="button" className={biz.btn} onClick={() => { setForm(EMPTY); setEditingId(null); setModalOpen(true); }}>+ הוסף ליד</button></HeaderAction>
      <section className={biz.bigCard} style={{ marginBottom: 'var(--space-4)' }}><div className={biz.grid3 + ' ' + biz.cellGrid} role="group" aria-label="אחוזי המרה">
        <div className={biz.cell}><div className={biz.toolbar}><span className={biz.iconTile} aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></span><span className={biz.statLabel}>פגישות התאמה שנקבעו</span></div><div className={biz.statValue}>{meetingsSet}</div><div className={biz.statNote}>מתוך {funnel.total} לידים</div></div>
        <div className={biz.cell}><div className={biz.toolbar}><span className={biz.iconTile} aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><span className={biz.statLabel}>אחוז הגעה לשיחות</span></div><div className={biz.statValue}>{percentLabel(funnel.showRate)}</div><div className={biz.statNote}>{funnel.showed} הגיעו מתוך {funnel.total} לידים</div></div>
        <div className={biz.cell}><div className={biz.toolbar}><span className={biz.iconTile} aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/></svg></span><span className={biz.statLabel}>אחוז רלוונטיות</span></div><div className={biz.statValue}>{percentLabel(funnel.relevantRate)}</div><div className={biz.statNote}>{funnel.relevant} רלוונטיים מתוך {funnel.showed} שהגיעו</div></div>
        <div className={biz.cell}><div className={biz.toolbar}><span className={biz.iconTile} aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l5-5 4 4 7-8"/></svg></span><span className={biz.statLabel}>אחוז סגירה</span></div><div className={biz.statValue}>{percentLabel(funnel.closeRate)}</div><div className={biz.statNote}>{funnel.closed} נסגרו מתוך {funnel.relevant} רלוונטיים</div></div>
        <div className={biz.cell}><div className={biz.toolbar}><span className={biz.iconTile} aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg></span><span className={biz.statLabel}>אחוז סגירה מכל השיחות</span></div><div className={biz.statValue}>{percentLabel(funnel.closeOfShowedRate)}</div><div className={biz.statNote}>{funnel.closed} נסגרו מתוך {funnel.showed} שהגיעו</div></div>
        <div className={biz.cell}><div className={biz.toolbar}><span className={biz.iconTile} aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><span className={biz.statLabel}>לחזור אליהם</span></div><div className={biz.statValue}>{dueNow}</div><div className={biz.statNote}>תאריך חזרה הגיע · {hot} לידים חמים · {thisMonth} פניות החודש</div></div>
      </div></section>

      <div className={biz.toolbar} style={{ marginBottom: 'var(--space-3)' }}>
        <input className={biz.input + ' ' + biz.inputGrow} type="search" placeholder="חיפוש ליד..." aria-label="חיפוש ליד" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.tempSelect} aria-label="סינון לפי מקור" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="all">כל המקורות</option>
          {usedSources.map(src => <option key={src} value={src}>{src}</option>)}
        </select>
      </div>

      <CardGrid single>
        <Card title="מתעניינים">
          <div className={styles.filterBar}>
            <div ref={statusFiltersRef} className={styles.filters} role="group" aria-label="סינון לפי סטטוס">
              {[{ key: 'open', label: 'פתוחים' }, ...STATUSES, { key: 'all', label: 'הכול' }].map(f => (
                <button key={f.key} type="button" className={styles.filter + (filter === f.key ? ' ' + styles.filterOn : '')} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>
              ))}
            </div>
            <select className={styles.tempSelect} aria-label="סינון לפי חום" value={tempFilter} onChange={e => setTempFilter(e.target.value)}>
              <option value="all">כל הלידים</option>
              {TEMPS.map(t => <option key={t.key} value={t.key}>ליד {t.label}</option>)}
            </select>
          </div>

          {visible.length === 0 ? (
            <div className={styles.empty}>{prospects.length === 0 ? 'עוד לא נרשמו מתעניינים' : 'אין מתעניינים בסינון הזה'}</div>
          ) : visible.map(p => {
            const overdue = OPEN_STATUSES.includes(p.status) && p.follow_up_at && p.follow_up_at <= today;
            return (
              <div key={p.id} className={styles.row}>
                <div className={styles.main}>
                  <div className={styles.name}>{p.name}<span className={styles.temp + ' ' + styles[tempInfo(p.temperature).tone]}>{tempInfo(p.temperature).label}</span></div>
                  <div className={styles.sub}>
                    {[p.source, p.contacted_at && `פנה ב-${formatDate(p.contacted_at)}`].filter(Boolean).join(' · ')}
                  </div>
                  {(p.phone || p.email) && (
                    <div className={styles.contact}>
                      {p.phone && <a href={`tel:${p.phone}`} dir="ltr">{p.phone}</a>}
                      {p.email && <a href={`mailto:${p.email}`} dir="ltr">{p.email}</a>}
                    </div>
                  )}
                  {p.notes && <div className={styles.notes}>{p.notes}</div>}
                </div>
                <div className={styles.side}>
                  {DATED_STATUSES[p.status] ? (
                    <label className={styles.dated + (overdue ? ' ' + styles.followDue : '')}>
                      <span>{DATED_STATUSES[p.status]}</span>
                      <input className={styles.dateInput} type="date" aria-label={`תאריך ${DATED_STATUSES[p.status]} · ${p.name}`} value={p.follow_up_at || ''} onChange={e => updateProspect(p.id, { follow_up_at: e.target.value || null })} />
                    </label>
                  ) : p.follow_up_at && <span className={styles.follow + (overdue ? ' ' + styles.followDue : '')}>לחזור: {formatDate(p.follow_up_at)}</span>}
                  {overdue && <span className={styles.followDue}>{p.follow_up_at === today ? 'להיום' : 'באיחור'}</span>}
                  <select className={styles.status + ' ' + styles[statusInfo(p.status).tone]} aria-label={`סטטוס · ${p.name}`} value={p.status} onChange={e => changeStatus(p.id, e.target.value)}>
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  {p.status !== 'not_relevant' && (
                    <Button variant="ghost" className={styles.convertBtn + (CONVERT_STATUSES.includes(p.status) ? ' ' + styles.convertBtnOn : '')} onClick={() => onConvert(p)} aria-label={`פתח כלקוח · ${p.name}`}>פתח כלקוח</Button>
                  )}
                  <span className={styles.icons}>
                    {[['showed', 'הגיע'], ['relevant', 'רלוונטי'], ['closed', 'נסגר']].map(([key, label]) => (
                      <label key={key} className={biz.toolbar} style={{ gap: 4, fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                        <input type="checkbox" className={biz.check} checked={!!p[key]} aria-label={label + ' · ' + p.name} onChange={e => updateProspect(p.id, { [key]: e.target.checked })} />{label}
                      </label>
                    ))}
                    <EditButton title={`ערוך · ${p.name}`} data-edit-prospect={p.id} onClick={() => startEdit(p)} />
                    <DeleteButton title={`מחק · ${p.name}`} onClick={() => deleteProspect(p.id)} />
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      </CardGrid>
      {modalOpen && (
        <Modal title={editingId != null ? 'עריכת ליד' : 'ליד חדש'} onClose={reset} wide>
          <form className={biz.formGrid} onSubmit={e => { e.preventDefault(); submit(); }}>
            <label className={biz.fieldLabel}>שם מלא<input ref={nameRef} className={biz.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>טלפון<input className={biz.input} dir="ltr" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
              <label className={biz.fieldLabel}>אימייל<input className={biz.input} dir="ltr" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            </div>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>מקור הגעה<input className={biz.input} list="prospect-sources" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} /></label>
              <label className={biz.fieldLabel}>חום הליד<select className={biz.select} value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })}>{TEMPS.map(t => <option key={t.key} value={t.key}>ליד {t.label}</option>)}</select></label>
            </div>
            <datalist id="prospect-sources">{SOURCES.map(src => <option key={src} value={src} />)}</datalist>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>תאריך כניסת ליד<input className={biz.input} type="date" value={form.contacted_at} onChange={e => setForm({ ...form, contacted_at: e.target.value })} /></label>
              <label className={biz.fieldLabel}>תאריך חזרה<input className={biz.input} type="date" value={form.follow_up_at} onChange={e => setForm({ ...form, follow_up_at: e.target.value })} /></label>
            </div>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>תאריך פגישת התאמה<input className={biz.input} type="date" value={form.meeting_date} onChange={e => setForm({ ...form, meeting_date: e.target.value })} /></label>
              <label className={biz.fieldLabel}>שעת הפגישה<input className={biz.input} type="time" value={form.meeting_time} onChange={e => setForm({ ...form, meeting_time: e.target.value })} /></label>
            </div>
            <div className={biz.formRow}>
              <label className={biz.fieldLabel}>שלב<select className={biz.select} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}</select></label>
              <div className={biz.fieldLabel}>ניסיונות מענה
                <div className={biz.toolbar}>
                  <button type="button" className={biz.iconBtn} aria-label="הורדה" onClick={() => setForm({ ...form, attempts: Math.max(0, form.attempts - 1) })}>−</button>
                  <strong className={biz.num} aria-live="polite">{form.attempts}</strong>
                  <button type="button" className={biz.btnGhost} onClick={() => setForm({ ...form, attempts: Math.min(50, form.attempts + 1) })}>עוד ניסיון</button>
                </div>
              </div>
            </div>
            <div className={biz.formRow}>
              {[['attendance_confirmed', 'וידא הגעה לפגישת ההתאמה'], ['showed', 'הגיע לשיחה'], ['relevant', 'רלוונטי'], ['closed', 'נסגר']].map(([key, label]) => (
                <label key={key} className={biz.toolbar}><input type="checkbox" className={biz.check} checked={form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} />{label}</label>
              ))}
            </div>
            <label className={biz.fieldLabel}>פירוט שיחה<textarea className={biz.input + ' ' + biz.textarea} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <div className={biz.toolbar}>
              <button type="submit" className={biz.btn} disabled={saving || !form.name.trim()}>{editingId != null ? 'שמור' : 'הוספת ליד'}</button>
              <button type="button" className={biz.btnGhost} onClick={reset}>ביטול</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
