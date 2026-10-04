import { useEffect, useRef, useState } from 'react';
import { useProspects } from './useProspects.js';
import { formatDate, localISODate } from '../budget/monthUtils.js';
import Hero from '../components/Hero.jsx';
import { CardGrid, Card } from '../components/Rows.jsx';
import AddForm from '../components/AddForm.jsx';
import Button from '../components/Button.jsx';
import EditButton from '../components/EditButton.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useUrlParam } from '../useUrlParam.js';
import styles from './Prospects.module.css';

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
const SOURCES = ['המלצה', 'רשתות חברתיות', 'אתר', 'וואטסאפ', 'אחר'];
const EMPTY = { temperature: 'warm', name: '', phone: '', email: '', source: '', notes: '', contacted_at: '', follow_up_at: '' };

const tempInfo = key => TEMPS.find(t => t.key === key) || TEMPS[1];
const statusInfo = key => STATUSES.find(s => s.key === key) || STATUSES[0];

export default function Prospects({ advisorId, onConvert }) {
  const { prospects, loading, error, reload, addProspect, updateProspect, deleteProspect } = useProspects(advisorId);
  const [filter, setFilter] = useUrlParam('pf', 'open');
  const [tempFilter, setTempFilter] = useUrlParam('pt', 'all');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (editingId != null) nameRef.current?.focus();
  }, [editingId]);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="16px" />;

  const today = localISODate();
  const open = prospects.filter(p => OPEN_STATUSES.includes(p.status));
  const dueNow = open.filter(p => p.follow_up_at && p.follow_up_at <= today).length;
  const thisMonth = prospects.filter(p => (p.contacted_at || '').startsWith(today.slice(0, 7))).length;
  const converted = prospects.filter(p => p.status === 'converted' || p.status === 'closed').length;

  const hot = open.filter(p => p.temperature === 'hot').length;
  const byStatus = filter === 'all' ? prospects : filter === 'open' ? open : prospects.filter(p => p.status === filter);
  const visible = tempFilter === 'all' ? byStatus : byStatus.filter(p => (p.temperature || 'warm') === tempFilter);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({ temperature: p.temperature || 'warm', name: p.name || '', phone: p.phone || '', email: p.email || '', source: p.source || '', notes: p.notes || '', contacted_at: p.contacted_at || '', follow_up_at: p.follow_up_at || '' });
  }

  function reset() { setEditingId(null); setForm(EMPTY); }

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
      follow_up_at: form.follow_up_at || null
    };
    const ok = editingId != null ? await updateProspect(editingId, row) : await addProspect({ ...row, status: 'new' });
    setSaving(false);
    if (ok) reset();
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>מתעניינים</h1>
      <Hero
        label="מתעניינים פתוחים"
        value={String(open.length)}
        note={`${prospects.length} פניות בסך הכול · ${converted} הפכו ללקוחות`}
        side={[
          { label: 'לחזור אליהם', value: String(dueNow), meta: 'תאריך חזרה הגיע' },
          { label: 'לידים חמים', value: String(hot) },
          { label: 'פניות החודש', value: String(thisMonth) }
        ]}
      />

      <CardGrid single>
        <Card title="מתעניינים">
          <AddForm label="הוסף מתעניין" open={editingId != null} className={styles.form}>
            <input ref={nameRef} className={styles.input} placeholder="שם" aria-label="שם המתעניין" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className={styles.input} placeholder="טלפון" aria-label="טלפון" dir="ltr" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <input className={styles.input} placeholder="אימייל" aria-label="אימייל" dir="ltr" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input className={styles.input} placeholder="מקור ההגעה" aria-label="מקור ההגעה" list="prospect-sources" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
            <select className={styles.input} aria-label="חום הליד" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })}>
              {TEMPS.map(t => <option key={t.key} value={t.key}>ליד {t.label}</option>)}
            </select>
            <datalist id="prospect-sources">{SOURCES.map(s => <option key={s} value={s} />)}</datalist>
            <label className={styles.field}>
              <span>תאריך פנייה</span>
              <input className={styles.input} type="date" value={form.contacted_at} onChange={e => setForm({ ...form, contacted_at: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span>תאריך חזרה</span>
              <input className={styles.input} type="date" value={form.follow_up_at} onChange={e => setForm({ ...form, follow_up_at: e.target.value })} />
            </label>
            <textarea className={styles.textarea} placeholder="הערות ומה ביקש" aria-label="הערות ומה ביקש" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div className={styles.actions}>
              <Button onClick={submit} disabled={saving || !form.name.trim()}>{editingId != null ? 'שמור' : 'הוסף מתעניין'}</Button>
              {editingId != null && <Button variant="ghost" onClick={reset}>ביטול</Button>}
            </div>
          </AddForm>

          <div className={styles.filters} role="group" aria-label="סינון לפי סטטוס">
            {[{ key: 'open', label: 'פתוחים' }, ...STATUSES, { key: 'all', label: 'הכול' }].map(f => (
              <button key={f.key} type="button" className={styles.filter + (filter === f.key ? ' ' + styles.filterOn : '')} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>

          <div className={styles.filters} role="group" aria-label="סינון לפי חום">
            {[{ key: 'all', label: 'כל הלידים' }, ...TEMPS].map(f => (
              <button key={f.key} type="button" className={styles.filter + (tempFilter === f.key ? ' ' + styles.filterOn : '')} aria-pressed={tempFilter === f.key} onClick={() => setTempFilter(f.key)}>{f.key === 'all' ? f.label : 'ליד ' + f.label}</button>
            ))}
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
                  <select className={styles.status + ' ' + styles[statusInfo(p.status).tone]} aria-label={`סטטוס · ${p.name}`} value={p.status} onChange={e => updateProspect(p.id, { status: e.target.value })}>
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  {p.status !== 'not_relevant' && (
                    <Button variant="ghost" className={styles.convertBtn + (CONVERT_STATUSES.includes(p.status) ? ' ' + styles.convertBtnOn : '')} onClick={() => onConvert(p)} aria-label={`פתח כלקוח · ${p.name}`}>פתח כלקוח</Button>
                  )}
                  <EditButton title={`ערוך · ${p.name}`} onClick={() => startEdit(p)} />
                  <DeleteButton title={`מחק · ${p.name}`} onClick={() => deleteProspect(p.id)} />
                </div>
              </div>
            );
          })}
        </Card>
      </CardGrid>
    </div>
  );
}
