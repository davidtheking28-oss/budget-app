import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { icons } from './BusinessNav.jsx';
import HeaderAction from './HeaderAction.jsx';
import styles from './Business.module.css';
import work from './Worklists.module.css';

const SYSTEM_DEPARTMENTS = [
  { key: 'שירות', icon: icons.headset },
  { key: 'שיווק', icon: icons.megaphone },
  { key: 'מכירות', icon: icons.chart },
  { key: 'פיננסים', icon: icons.coins },
  { key: 'ניהול', icon: icons.briefcase }
];

function SystemForm({ initial, title, submitLabel, onSubmit, onClose }) {
  const [form, setForm] = useState(initial);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) { setNameError(true); e.currentTarget.elements.systemName.focus(); return; }
    setSaving(true);
    setSaveError(false);
    try {
      const saved = await onSubmit({ name: form.name.trim(), dept: form.dept, summary: form.summary.trim(), notes: form.notes.trim() });
      if (!saved) setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className={styles.formGrid} onSubmit={submit} aria-busy={saving}>
        <label className={styles.fieldLabel}>שם הסיסטם · חובה<input name="systemName" className={styles.input} aria-invalid={nameError} aria-describedby={nameError ? "system-name-error" : undefined} value={form.name} onChange={e => { set({ name: e.target.value }); setNameError(false); }} />{nameError && <span id="system-name-error" className={styles.fieldError} role="alert">כתוב שם לסיסטם</span>}</label>
        <label className={styles.fieldLabel}>קטגוריה<select className={styles.select} value={form.dept} onChange={e => set({ dept: e.target.value })}>{SYSTEM_DEPARTMENTS.map(d => <option key={d.key} value={d.key}>{d.key}</option>)}</select></label>
        <label className={styles.fieldLabel}>תיאור קצר<input className={styles.input} placeholder="במשפט אחד: על מה הסיסטם הזה" value={form.summary} onChange={e => set({ summary: e.target.value })} /><span className={styles.cardSub}>את התוכן כותבים בשלבים, אחרי יצירת הסיסטם.</span></label>
        <label className={styles.fieldLabel}>הערות<textarea className={styles.input + ' ' + styles.textarea} value={form.notes} onChange={e => set({ notes: e.target.value })} /></label>
        {saveError && <p className={styles.fieldError} role="alert">השינויים לא נשמרו. הפרטים נשארו כאן — אפשר לנסות שוב.</p>}
        <div className={styles.formActions}>
          <button type="submit" className={styles.btn} disabled={saving}>{saving ? 'שומר…' : submitLabel}</button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  );
}

function SystemStep({ step, index, onChange, onRemove }) {
  const [closed, setClosed] = useState(false);
  return (
    <section className={styles.card + ' ' + work.stepCard} data-complete={step.done}>
      <div className={work.systemStepHead}>
        <span className={work.stepNumber}>{index + 1}</span>
        <button type="button" className={styles.pillBtn + ' ' + (step.done ? styles.pillGood : styles.pillBad)} aria-pressed={step.done} onClick={() => onChange({ done: !step.done })}>{step.done ? 'בוצע' : 'לא בוצע'}</button>
        <input className={styles.input + ' ' + styles.inputGrow} placeholder={'שלב ' + (index + 1)} aria-label={'שם שלב ' + (index + 1)} defaultValue={step.title} onBlur={e => { if (e.target.value.trim() !== step.title) onChange({ title: e.target.value.trim() }); }} />
        <button type="button" className={styles.btnGhost} aria-expanded={!closed} onClick={() => setClosed(!closed)}>{closed ? 'פתח' : 'סגור'}</button>
        <DeleteButton title={'מחק שלב ' + (index + 1)} onClick={onRemove} />
      </div>
      {!closed && <textarea className={styles.input + ' ' + styles.textarea} style={{ width: '100%', marginTop: 8 }} placeholder="מה עושים בשלב הזה..." aria-label={'תוכן שלב ' + (index + 1)} defaultValue={step.text} onBlur={e => { if (e.target.value !== step.text) onChange({ text: e.target.value }); }} />}
    </section>
  );
}

function SystemDetail({ system, onBack, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const steps = (system.steps || []).map(s => ({ id: s.id, title: s.title || '', text: s.text || '', done: !!s.done }));
  const doneCount = steps.filter(s => s.done).length;
  const patchStep = (id, patch) => onUpdate({ steps: steps.map(s => s.id === id ? { ...s, ...patch } : s) });

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
        <button type="button" className={styles.btnGhost} onClick={onBack}>חזרה לסיסטמים</button>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnGhost} onClick={() => setEditing(true)}>עריכה</button>
          <DeleteButton title={'מחק סיסטם: ' + system.name} onClick={onRemove} />
        </div>
      </div>
      <section className={styles.bigCard + ' ' + work.detailSummary}>
        <h2 className={styles.viewHeading} style={{ fontSize: 'var(--text-xl)' }}>{system.name}</h2>
        <div className={styles.pills}><span className={styles.tag}>{system.dept}</span><span className={styles.tag}>{doneCount} מתוך {steps.length} שלבים הושלמו</span></div>
        {system.summary ? <p className={styles.cardSub}>{system.summary}</p> : null}
      </section>
      <div className={styles.cardHead} style={{ marginBottom: 0 }}>
        <h3 className={styles.cardTitle}>שלבי התהליך</h3>
        {steps.length > 0 && <span className={styles.tag}>{doneCount}/{steps.length}</span>}
      </div>
      {steps.length === 0 && <p className={styles.cardSub}>עוד לא הוגדרו שלבים. התהליך מתחיל בשלב 1.</p>}
      {steps.map((s, i) => <SystemStep key={s.id} step={s} index={i} onChange={patch => patchStep(s.id, patch)} onRemove={() => onUpdate({ steps: steps.filter(x => x.id !== s.id) })} />)}
      <button type="button" className={styles.btnGhost} onClick={() => onUpdate({ steps: [...steps, { id: 's' + Date.now(), title: '', text: '', done: false }] })}>+ הוסף שלב {steps.length + 1}</button>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>הערות</h3>
        <textarea className={styles.input + ' ' + styles.textarea} style={{ width: '100%' }} placeholder="הערות לעצמי..." aria-label={'הערות: ' + system.name} defaultValue={system.notes} onBlur={e => { if (e.target.value !== (system.notes || '')) onUpdate({ notes: e.target.value }); }} />
      </section>
      {editing && (
        <SystemForm
          title={'עריכת סיסטם: ' + system.name}
          initial={{ name: system.name, dept: system.dept, summary: system.summary || '', notes: system.notes || '' }}
          submitLabel="שמירה"
          onSubmit={async patch => { const saved = await onUpdate(patch); if (saved) setEditing(false); return saved; }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export default function Systems({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'system');
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState(null);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="200px" radius="18px" />;

  const systems = records.map(r => ({ id: r.id, ...r.data }));
  const countOf = d => systems.filter(s => s.dept === d).length;
  const visible = systems.filter(s => !dept || s.dept === dept).filter(s => !search.trim() || s.name.includes(search.trim()));

  async function create(fields) {
    const row = await add({ ...fields, steps: [] });
    if (row) setModal(false);
    return !!row;
  }

  const open = records.find(r => r.id === openId);
  if (open) {
    return (
      <>
        <SystemDetail system={{ id: open.id, ...open.data }} onBack={() => setOpenId(null)} onUpdate={patch => update(open.id, patch)} onRemove={async () => { await remove(open.id, 'הסיסטם נמחק'); setOpenId(null); }} />
      </>
    );
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.departmentTabs} role="group" aria-label="סינון סיסטמים לפי מחלקה">
          {SYSTEM_DEPARTMENTS.map(d => (
            <button key={d.key} type="button" className={styles.stat} style={{ cursor: 'pointer', textAlign: 'start', borderColor: dept === d.key ? 'var(--accent)' : undefined }} aria-pressed={dept === d.key} onClick={() => setDept(dept === d.key ? '' : d.key)}>
              <div className={styles.toolbar}>
                <span className={styles.iconTile} aria-hidden="true">{d.icon}</span>
                <div><div className={styles.rowTitle}>{d.key}</div><div className={styles.statNote}>{countOf(d.key)} סיסטמים</div></div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <HeaderAction><button type="button" className={styles.btn} onClick={() => setModal(true)}>+ הוסף סיסטם</button></HeaderAction>

      <div className={styles.cardHead} style={{ marginBottom: 0 }}>
        <h3 className={styles.cardTitle}>{dept ? `סיסטמים: ${dept}` : 'כל הסיסטמים'}</h3>
        <input className={styles.input} type="search" placeholder="חיפוש בסיסטמים..." aria-label="חיפוש בסיסטמים" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <section className={styles.card}>
        {visible.length === 0 && (search.trim() || dept) ? <div className={styles.emptyState}><span>לא נמצאו סיסטמים בסינון הזה</span><button type="button" className={styles.btnGhost} onClick={() => { setSearch(''); setDept(''); }}>נקה סינון</button></div> : visible.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.iconTile} aria-hidden="true">{icons.nodes}</span>
            <span>אין סיסטמים כאן עדיין</span>
            <span className={styles.cardSub}>כל תהליך שחוזר על עצמו בעסק שווה סיסטם</span>
            <button type="button" className={styles.btn} onClick={() => setModal(true)}>+ הוסף סיסטם</button>
          </div>
        ) : (
          <ul className={styles.rowList}>
            {visible.map(s => (
              <li key={s.id} className={work.systemListItem}>
                <button type="button" className={work.systemLink} aria-label={'פתח סיסטם: ' + s.name} onClick={() => setOpenId(s.id)}>
                  <div className={work.systemContent}><div className={work.listTitle}><span className={styles.rowTitle}>{s.name}</span><span className={styles.tag}>{s.dept}</span></div>
                  {s.summary ? <div className={styles.cardSub}>{s.summary}</div> : null}
                  </div><span className={work.systemProgress}><span className={styles.cardSub}>{(s.steps || []).length ? (s.steps || []).filter(x => x.done).length + '/' + (s.steps || []).length + ' שלבים' : 'אין שלבים'}</span><span className={work.openHint} aria-hidden="true">←</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal && <SystemForm title="סיסטם חדש" initial={{ name: '', dept: SYSTEM_DEPARTMENTS[0].key, summary: '', notes: '' }} submitLabel="הוספה" onSubmit={create} onClose={() => setModal(false)} />}
    </div>
  );
}
