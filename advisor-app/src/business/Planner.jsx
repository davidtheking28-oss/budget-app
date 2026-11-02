import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import business from './Business.module.css';
import styles from './Planner.module.css';

const TABLE = 'advisor_biz_records';
const KIND = 'planner';
const HH = 48;
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const CATS = [
  { key: 'biz', label: 'בניית העסק' },
  { key: 'client', label: 'לקוחות' },
  { key: 'mkt', label: 'שיווק' },
  { key: 'cap', label: 'שוק ההון' },
  { key: 'ev', label: 'אירוע / אישי' },
  { key: 'rest', label: 'מנוחה' }
];
const EMPTY = { events: {}, notes: {} };

const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const weekStartOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const shortDate = d => `${d.getDate()}.${d.getMonth() + 1}`;
const longDate = d => d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const timeOptions = () => Array.from({ length: 49 }, (_, i) => hhmm(i * 30));

function layoutDay(items) {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const groups = [];
  let current = null;
  let end = -1;
  for (const it of sorted) {
    if (!current || it.s >= end) { current = []; groups.push(current); end = -1; }
    current.push(it);
    end = Math.max(end, it.e);
  }
  for (const group of groups) {
    const cols = [];
    for (const it of group) {
      let c = 0;
      while (cols[c] !== undefined && cols[c] > it.s) c++;
      cols[c] = it.e;
      it.col = c;
    }
    for (const it of group) it.cols = cols.length;
  }
  return sorted;
}

function EventModal({ draft, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(draft);
  const [error, setError] = useState('');
  const times = useMemo(timeOptions, []);
  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (!form.date) { setError('בחר תאריך.'); return; }
    if (mins(form.e) <= mins(form.s)) { setError('שעת הסיום צריכה להיות אחרי שעת ההתחלה.'); return; }
    onSave({ ...form, n: form.n.trim() || CATS.find(c => c.key === form.t).label });
  }

  return (
    <Modal title={draft.id ? 'עריכת אירוע' : 'אירוע חדש'} onClose={onClose}>
      <form className={business.formGrid} onSubmit={submit}>
        <label className={business.fieldLabel}>כותרת<input className={business.input} value={form.n} maxLength={60} onChange={set('n')} /></label>
        <div className={business.fieldLabel} role="group" aria-label="קטגוריה">קטגוריה
          <div className={business.pills}>
            {CATS.map(c => <button key={c.key} type="button" className={form.t === c.key ? business.pillOn : business.pill} aria-pressed={form.t === c.key} onClick={() => setForm(prev => ({ ...prev, t: c.key }))}>{c.label}</button>)}
          </div>
        </div>
        <label className={business.fieldLabel}>תאריך<input className={business.input} type="date" value={form.date} onChange={set('date')} /></label>
        <div className={business.formRow}>
          <label className={business.fieldLabel}>התחלה
            <select className={business.select} value={form.s} onChange={e => { const s = e.target.value; setForm(prev => { const dur = mins(prev.e) - mins(prev.s); return { ...prev, s, e: hhmm(Math.min(1440, mins(s) + (dur > 0 ? dur : 60))) }; }); }}>{times.slice(0, 48).map(t => <option key={t} value={t}>{t}</option>)}</select>
          </label>
          <label className={business.fieldLabel}>סיום
            <select className={business.select} value={form.e} onChange={set('e')}>{times.slice(1).map(t => <option key={t} value={t}>{t}</option>)}</select>
          </label>
        </div>
        <label className={business.fieldLabel}>הערה<input className={business.input} value={form.o} maxLength={120} onChange={set('o')} /></label>
        {error && <p className={business.fieldError} role="alert">{error}</p>}
        <div className={business.formActions}>
          <button type="submit" className={business.btn}>שמירה</button>
          <button type="button" className={business.btnGhost} onClick={onClose}>ביטול</button>
          {draft.id && <button type="button" className={business.btnGhost} onClick={() => onDelete(draft)}>מחיקה</button>}
        </div>
      </form>
    </Modal>
  );
}

export default function Planner({ advisorId }) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(false);
  const [view, setView] = useState(() => (window.innerWidth < 700 ? 'day' : 'week'));
  const [cursor, setCursor] = useState(() => new Date());
  const [draft, setDraft] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const recordId = useRef(null);
  const latest = useRef(EMPTY);
  const saveTimer = useRef(null);
  const saveChain = useRef(Promise.resolve());

  const load = useCallback(async () => {
    if (!advisorId) return;
    setError(false);
    const { data: rows, error: err } = await supabase.from(TABLE).select('id,data').eq('advisor_id', advisorId).eq('kind', KIND).order('created_at', { ascending: true }).limit(1);
    if (err) { setError(true); return; }
    recordId.current = rows?.[0]?.id || null;
    const stored = rows?.[0]?.data;
    const next = { events: stored?.events || {}, notes: stored?.notes || {} };
    latest.current = next;
    setData(next);
  }, [advisorId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const persist = useCallback(async () => {
    const payload = latest.current;
    if (recordId.current) {
      const { error: err } = await supabase.from(TABLE).update({ data: payload, updated_at: new Date().toISOString() }).eq('id', recordId.current).eq('advisor_id', advisorId);
      return !err;
    }
    const { data: row, error: err } = await supabase.from(TABLE).insert({ advisor_id: advisorId, kind: KIND, period: null, data: payload }).select().single();
    if (err) return false;
    recordId.current = row.id;
    return true;
  }, [advisorId]);

  const commit = useCallback((next, delay = 0) => {
    latest.current = next;
    setData(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveChain.current = saveChain.current.then(async () => { if (!(await persist())) toast('שגיאה בשמירה', 'error'); });
    }, delay);
  }, [persist]);

  useEffect(() => () => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveChain.current = saveChain.current.then(persist);
  }, [persist]);

  const weekStart = weekStartOf(cursor);
  const columns = useMemo(() => (view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(cursor), i))), [view, cursor]);
  const todayIso = isoOf(now);
  const selectedIso = isoOf(cursor);

  const layout = useMemo(() => {
    if (!data) return null;
    let minS = 420;
    let maxE = 1320;
    const perDay = columns.map(d => {
      const items = (data.events[isoOf(d)] || []).map(ev => ({ ev, s: mins(ev.s), e: mins(ev.e) }));
      for (const it of items) { minS = Math.min(minS, it.s); maxE = Math.max(maxE, it.e); }
      return { d, items };
    });
    const sH = Math.max(0, Math.floor(minS / 60));
    const eH = Math.min(24, Math.ceil(maxE / 60));
    return { sH, eH, perDay: perDay.map(p => ({ d: p.d, items: layoutDay(p.items) })) };
  }, [data, columns]);

  function openNew(date, start) {
    const s = Math.max(0, Math.min(1380, start));
    setDraft({ id: null, date: isoOf(date), s: hhmm(s), e: hhmm(Math.min(1440, s + 60)), t: 'biz', n: '', o: '' });
  }

  function openAdd() {
    const list = data.events[selectedIso] || [];
    let start = 540;
    for (const ev of list) { const e = mins(ev.e); if (e > start && e <= 1320) start = e; }
    openNew(cursor, start);
  }

  function slotClick(e, date) {
    const r = e.currentTarget.getBoundingClientRect();
    openNew(date, Math.floor((layout.sH * 60 + ((e.clientY - r.top) / HH) * 60) / 30) * 30);
  }

  function saveEvent(form) {
    const events = { ...data.events };
    const { date, ...rest } = form;
    if (form.id) {
      for (const k of Object.keys(events)) if (events[k].some(x => x.id === form.id)) events[k] = events[k].filter(x => x.id !== form.id);
    }
    const ev = { ...rest, id: form.id || newId() };
    events[date] = [...(events[date] || []), ev].sort((a, b) => mins(a.s) - mins(b.s));
    for (const k of Object.keys(events)) if (!events[k].length) delete events[k];
    commit({ ...data, events });
    setDraft(null);
    setCursor(fromIso(date));
  }

  function deleteEvent(form) {
    const events = { ...data.events };
    for (const k of Object.keys(events)) events[k] = events[k].filter(x => x.id !== form.id);
    for (const k of Object.keys(events)) if (!events[k].length) delete events[k];
    commit({ ...data, events });
    setDraft(null);
    toast('האירוע נמחק', 'success');
  }

  function copyWeek() {
    const events = { ...data.events };
    for (let i = 0; i < 7; i++) {
      const list = data.events[isoOf(addDays(weekStart, i))] || [];
      if (!list.length) continue;
      events[isoOf(addDays(weekStart, i + 7))] = list.map(x => ({ ...x, id: newId() }));
    }
    commit({ ...data, events });
    setCursor(addDays(weekStart, 7));
    toast('השבוע הועתק לשבוע הבא', 'success');
  }

  function setNote(value) {
    const notes = { ...data.notes };
    if (value.trim()) notes[selectedIso] = value; else delete notes[selectedIso];
    commit({ ...data, notes }, 700);
  }

  if (error) return <ErrorState onRetry={load} />;
  if (!data) return <Skeleton height="420px" radius="18px" />;

  const step = view === 'day' ? 1 : 7;
  const monthOf = d => d.toLocaleDateString('he-IL', { month: 'long' });
  const first = columns[0];
  const last = columns[columns.length - 1];
  const title = view === 'day' ? longDate(cursor) : first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} ב${monthOf(last)} ${last.getFullYear()}`
    : `${first.getDate()} ב${monthOf(first)} – ${last.getDate()} ב${monthOf(last)} ${last.getFullYear()}`;
  const bodyH = (layout.eH - layout.sH) * HH;
  const nowM = now.getHours() * 60 + now.getMinutes();
  const history = Object.keys(data.notes).filter(k => k !== selectedIso && data.notes[k].trim()).sort().reverse();
  const totals = CATS.map(c => {
    const total = columns.reduce((sum, d) => sum + (data.events[isoOf(d)] || []).filter(x => x.t === c.key).reduce((s, x) => s + mins(x.e) - mins(x.s), 0), 0);
    return { ...c, hours: Math.round(total / 6) / 10 };
  }).filter(c => c.hours > 0);

  return (
    <div className={business.stack}>
      <section className={business.card}>
        <div className={styles.bar}>
          <div className={styles.barGroup}>
            <button type="button" className={business.btnGhost} onClick={() => setCursor(new Date())}>היום</button>
            <button type="button" className={business.iconBtn} aria-label={view === 'day' ? 'היום הקודם' : 'השבוע הקודם'} onClick={() => setCursor(addDays(cursor, -step))}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9,6 15,12 9,18" /></svg></button>
            <button type="button" className={business.iconBtn} aria-label={view === 'day' ? 'היום הבא' : 'השבוע הבא'} onClick={() => setCursor(addDays(cursor, step))}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15,6 9,12 15,18" /></svg></button>
          </div>
          <h2 className={business.cardTitle + ' ' + styles.title}>{title}</h2>
          <div className={styles.barGroup}>
            <div className={business.segment} role="group" aria-label="תצוגה">
              <button type="button" className={view === 'day' ? business.segBtnOn : business.segBtn} aria-pressed={view === 'day'} onClick={() => setView('day')}>יום</button>
              <button type="button" className={view === 'week' ? business.segBtnOn : business.segBtn} aria-pressed={view === 'week'} onClick={() => setView('week')}>שבוע</button>
            </div>
            {view === 'week' && <button type="button" className={business.btnGhost} onClick={copyWeek}>העתק לשבוע הבא</button>}
            <button type="button" className={business.btn} onClick={openAdd}>אירוע חדש</button>
          </div>
        </div>

        <div className={styles.scroll}>
          <div className={view === 'week' ? styles.wide : undefined}>
            <div className={styles.head} style={{ '--n': columns.length }}>
              <div />
              {columns.map(d => (
                <button key={isoOf(d)} type="button" className={styles.dayHead + (isoOf(d) === todayIso ? ' ' + styles.today : '') + (view === 'week' && isoOf(d) === selectedIso ? ' ' + styles.sel : '')} onClick={() => { setCursor(d); setView('day'); }} aria-label={`יום ${DAY_NAMES[d.getDay()]} ${shortDate(d)}`}>
                  <small>{view === 'day' ? `יום ${DAY_NAMES[d.getDay()]}` : DAY_SHORT[d.getDay()]}</small>
                  <b>{d.getDate()}</b>
                </button>
              ))}
            </div>
            <div className={styles.body} style={{ '--n': columns.length }}>
              <div className={styles.gutter} style={{ height: bodyH }}>
                {Array.from({ length: layout.eH - layout.sH - 1 }, (_, i) => <span key={i} style={{ top: (i + 1) * HH }}>{pad(layout.sH + i + 1)}:00</span>)}
              </div>
              {layout.perDay.map(({ d, items }) => (
                <div key={isoOf(d)} className={styles.col} style={{ height: bodyH, backgroundSize: `100% ${HH}px` }} onClick={e => { if (e.target === e.currentTarget || e.target.dataset.now) slotClick(e, d); }}>
                  {items.map(it => (
                    <button key={it.ev.id} type="button" className={styles.event + ' ' + styles['cat_' + it.ev.t]} style={{ top: ((it.s - layout.sH * 60) / 60) * HH, height: Math.max(22, ((it.e - it.s) / 60) * HH - 2), insetInlineStart: `calc(${it.col} * 100% / ${it.cols} + 2px)`, width: `calc(100% / ${it.cols} - 4px)` }} onClick={() => setDraft({ ...it.ev, date: isoOf(d) })}>
                      <span className={styles.evTitle}>{it.ev.n}</span>
                      {it.e - it.s >= 45 && <span className={styles.evTime}>{it.ev.s}–{it.ev.e}</span>}
                    </button>
                  ))}
                  {isoOf(d) === todayIso && nowM >= layout.sH * 60 && nowM <= layout.eH * 60 && <div className={styles.now} data-now="1" style={{ top: ((nowM - layout.sH * 60) / 60) * HH }} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {totals.length > 0 && (
          <div className={styles.totals}>
            {totals.map(c => <span key={c.key} className={business.tag + ' ' + styles['cat_' + c.key]}>{c.label} {c.hours} שעות</span>)}
          </div>
        )}
        <p className={business.note}>לחיצה על משבצת ריקה מוסיפה אירוע, ולחיצה על אירוע פותחת אותו לעריכה.</p>
      </section>

      <section className={business.card}>
        <div className={styles.sumHead}>
          <h3 className={business.cardTitle}>מה עשיתי ביום {DAY_NAMES[cursor.getDay()]} {shortDate(cursor)}</h3>
          {selectedIso === todayIso && <span className={business.pill}>היום</span>}
        </div>
        <textarea key={selectedIso} className={business.input + ' ' + business.textarea} rows={5} aria-label="סיכום יום" placeholder="לכתוב כאן מה עשיתי היום" defaultValue={data.notes[selectedIso] || ''} onChange={e => setNote(e.target.value)} onBlur={e => setNote(e.target.value)} />
        <h4 className={business.sectionLabel}>סיכומים קודמים{history.length ? ` (${history.length})` : ''}</h4>
        {history.length ? (
          <div className={styles.hist}>
            {history.map(k => {
              const d = fromIso(k);
              return (
                <button key={k} type="button" className={styles.histRow} onClick={() => { setCursor(d); setView('day'); }}>
                  <span className={styles.histDate}>יום {DAY_NAMES[d.getDay()]} {shortDate(d)}, {d.getFullYear()}</span>
                  <span className={styles.histText}>{data.notes[k]}</span>
                </button>
              );
            })}
          </div>
        ) : <p className={business.note}>עוד אין סיכומים. אחרי שתכתוב בימים נוספים הם יופיעו כאן, מהחדש לישן.</p>}
      </section>

      {draft && <EventModal draft={draft} onClose={() => setDraft(null)} onSave={saveEvent} onDelete={deleteEvent} />}
    </div>
  );
}
