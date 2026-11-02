import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { projectProgress, percentLabel } from './bizMath.js';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import { icons } from './BusinessNav.jsx';
import styles from './Business.module.css';
import work from './Worklists.module.css';

const EMPTY_FORM = { name: '', description: '', deadline: '', importance: '', investment: false };

const normalizeSteps = project => (project.steps || []).map(s => ({ id: s.id, title: s.title ?? s.text ?? '', deadline: s.deadline || '', done: !!s.done, tasks: s.tasks || [] }));

const metaOf = project => [project.importance ? 'חשיבות ' + project.importance + '/10' : '', project.deadline ? 'דדליין ' + new Date(project.deadline).toLocaleDateString('he-IL') : 'אין דדליין', project.investment ? 'נדרשת השקעה' : 'לא נדרשת השקעה'].filter(Boolean);

function ProjectForm({ title, initial, submitLabel, onSubmit, onClose }) {
  const [form, setForm] = useState(initial);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) { setNameError(true); e.currentTarget.elements.projectName.focus(); return; }
    const rank = Number(form.importance);
    if (form.importance !== '' && form.importance !== null && !(rank >= 1 && rank <= 10)) { toast('דירוג החשיבות הוא מספר בין 1 ל-10', 'error'); return; }
    setSaving(true);
    setSaveError(false);
    try {
      const saved = await onSubmit({ name: form.name.trim(), description: form.description.trim(), deadline: form.deadline, importance: form.importance === '' || form.importance === null ? null : rank, investment: form.investment });
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
        <label className={styles.fieldLabel}>שם הפרויקט · חובה<input name="projectName" className={styles.input} placeholder="למשל: השקת קורס דיגיטלי" aria-invalid={nameError} aria-describedby={nameError ? "project-name-error" : undefined} value={form.name} onChange={e => { set({ name: e.target.value }); setNameError(false); }} />{nameError && <span id="project-name-error" className={styles.fieldError} role="alert">כתוב שם לפרויקט</span>}</label>
        <label className={styles.fieldLabel}>תיאור<textarea className={styles.input + ' ' + styles.textarea} value={form.description} onChange={e => set({ description: e.target.value })} placeholder="פרטים נוספים (לא חובה)" /></label>
        <div className={styles.formRow}>
          <label className={styles.fieldLabel}>דדליין הפרויקט<input className={styles.input} type="date" value={form.deadline} onChange={e => set({ deadline: e.target.value })} /></label>
          <label className={styles.fieldLabel}>דירוג חשיבות (1 עד 10)<input className={styles.input} type="number" min="1" max="10" value={form.importance ?? ''} onChange={e => set({ importance: e.target.value })} /></label>
        </div>
        <label className={styles.fieldLabel}>נדרשת השקעה כספית?
          <div className={styles.segment} role="group" aria-label="נדרשת השקעה כספית">
            <button type="button" className={!form.investment ? styles.segBtnOn : styles.segBtn} aria-pressed={!form.investment} onClick={() => set({ investment: false })}>לא נדרשת</button>
            <button type="button" className={form.investment ? styles.segBtnOn : styles.segBtn} aria-pressed={form.investment} onClick={() => set({ investment: true })}>נדרשת</button>
          </div>
        </label>
        {saveError && <p className={styles.fieldError} role="alert">השינויים לא נשמרו. הפרטים נשארו כאן — אפשר לנסות שוב.</p>}
        <div className={styles.formActions}>
          <button type="submit" className={styles.btn} disabled={saving}>{saving ? 'שומר…' : submitLabel}</button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>ביטול</button>
        </div>
      </form>
    </Modal>
  );
}

function StepCard({ step, index, onChange, onRemove }) {
  const [task, setTask] = useState('');
  const doneTasks = step.tasks.filter(t => t.done).length;

  function addTask(e) {
    e.preventDefault();
    if (!task.trim()) return;
    onChange({ tasks: [...step.tasks, { id: 't' + Date.now(), text: task.trim(), done: false }] });
    setTask('');
  }

  const patchTask = (id, patch) => onChange({ tasks: step.tasks.map(t => t.id === id ? { ...t, ...patch } : t) });

  return (
    <section className={styles.card + ' ' + work.stepCard} data-complete={step.done}>
      <div className={work.projectStepHead}>
        <span className={work.stepNumber}>{index + 1}</span>
        <button type="button" className={styles.pillBtn + ' ' + (step.done ? styles.pillGood : styles.pillBad)} aria-pressed={step.done} onClick={() => onChange({ done: !step.done })}>{step.done ? 'בוצע' : 'לא בוצע'}</button>
        <input className={styles.input + ' ' + styles.inputGrow} placeholder={'שלב ' + (index + 1)} aria-label={'שם שלב ' + (index + 1)} defaultValue={step.title} onBlur={e => { if (e.target.value.trim() !== step.title) onChange({ title: e.target.value.trim() }); }} />
        <label className={styles.rowMeta}>דדליין <input className={styles.input} type="date" aria-label={'דדליין שלב ' + (index + 1)} value={step.deadline} onChange={e => onChange({ deadline: e.target.value })} /></label>
        {step.tasks.length > 0 && <span className={styles.tag}>{doneTasks}/{step.tasks.length}</span>}
        <DeleteButton title={'מחק שלב ' + (index + 1)} onClick={onRemove} />
      </div>
      <ul className={styles.rowList}>
        {step.tasks.map(t => (
          <li key={t.id} className={styles.rowItem}>
            <input type="checkbox" className={styles.check} aria-label={'משימה בוצעה: ' + t.text} checked={t.done} onChange={() => patchTask(t.id, { done: !t.done })} />
            <div className={styles.rowMain}><div className={styles.rowTitle} style={t.done ? { textDecoration: 'line-through', color: 'var(--text3)' } : undefined}>{t.text}</div></div>
            <DeleteButton title={'מחק משימה: ' + t.text} onClick={() => onChange({ tasks: step.tasks.filter(x => x.id !== t.id) })} />
          </li>
        ))}
      </ul>
      <form className={styles.toolbar + ' ' + work.taskComposer} onSubmit={addTask}>
        <input className={styles.input + ' ' + styles.inputGrow} placeholder="משימה חדשה בשלב הזה..." aria-label={'משימה חדשה בשלב ' + (index + 1)} value={task} onChange={e => setTask(e.target.value)} />
        <button type="submit" className={styles.btnGhost}>הוסף משימה</button>
      </form>
    </section>
  );
}

function ProjectDetail({ project, onBack, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const steps = normalizeSteps(project);
  const progress = projectProgress({ steps });
  const patchStep = (id, patch) => onUpdate({ steps: steps.map(s => s.id === id ? { ...s, ...patch } : s) });

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
        <button type="button" className={styles.btnGhost} onClick={onBack}>חזרה לפרויקטים</button>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnGhost} onClick={() => setEditing(true)}>עריכה</button>
          <DeleteButton title={'מחק פרויקט: ' + project.name} onClick={onRemove} />
        </div>
      </div>
      <section className={styles.bigCard + ' ' + work.detailSummary}>
        <h2 className={styles.viewHeading} style={{ fontSize: 'var(--text-xl)' }}>{project.name}</h2>
        <div className={styles.pills}>
          {metaOf(project).map(m => <span key={m} className={styles.tag}>{m}</span>)}
          <span className={styles.tag}>{progress.done}/{progress.total} שלבים</span>
        </div>
        {project.description ? <p className={styles.cardSub}>{project.description}</p> : null}
        <div className={styles.statLabel} style={{ marginTop: 12 }}>התקדמות</div>
        <div className={styles.toolbar} style={{ flexWrap: 'nowrap' }}>
          <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress.rate || 0) * 100)} aria-label={'התקדמות: ' + project.name} style={{ flex: 1 }}>
            <div className={styles.progressFill} style={{ width: (progress.rate || 0) * 100 + '%' }} />
          </div>
          <span className={styles.num}>{percentLabel(progress.rate ?? 0)}</span>
        </div>
      </section>
      {steps.map((s, i) => <StepCard key={s.id} step={s} index={i} onChange={patch => patchStep(s.id, patch)} onRemove={() => onUpdate({ steps: steps.filter(x => x.id !== s.id) })} />)}
      <button type="button" className={styles.btnGhost} onClick={() => onUpdate({ steps: [...steps, { id: 's' + Date.now(), title: '', deadline: '', done: false, tasks: [] }] })}>+ הוסף שלב {steps.length + 1}</button>
      {editing && (
        <ProjectForm
          title={'עריכת פרויקט: ' + project.name}
          initial={{ name: project.name, description: project.description || '', deadline: project.deadline || '', importance: project.importance ?? '', investment: !!project.investment }}
          submitLabel="שמירה"
          onSubmit={async patch => { const saved = await onUpdate(patch); if (saved) setEditing(false); return saved; }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export default function Projects({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'project');
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="200px" radius="18px" />;

  const open = records.find(r => r.id === openId);
  if (open) {
    return (
      <>
        <ProjectDetail project={{ id: open.id, ...open.data }} onBack={() => setOpenId(null)} onUpdate={patch => update(open.id, patch)} onRemove={async () => { await remove(open.id, 'הפרויקט נמחק'); setOpenId(null); }} />
      </>
    );
  }

  const ordered = records.map((r, i) => ({ r, i })).sort((a, b) => (a.r.data.order ?? a.i) - (b.r.data.order ?? b.i)).map(x => x.r);

  async function dropOn(targetId) {
    const from = ordered.findIndex(r => r.id === dragId);
    const to = ordered.findIndex(r => r.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...ordered];
    next.splice(to, 0, next.splice(from, 1)[0]);
    await Promise.all(next.map((r, i) => (r.data.order === i ? null : update(r.id, { order: i }))));
    toast('הסדר נשמר', 'success');
  }

  async function create(fields) {
    const row = await add({ ...fields, steps: [], order: records.length });
    if (row) setModal(false);
    return !!row;
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead} style={{ marginBottom: 0 }}>
          <div><h3 className={styles.cardTitle}>הפרויקטים שלי <span className={styles.tag}>{records.length}</span></h3><p className={styles.cardSub}>שלבים, משימות והתקדמות במקום אחד</p></div>
          <button type="button" className={styles.btn} onClick={() => setModal(true)}>+ פתח פרויקט</button>
        </div>
      </section>
      {records.length === 0 ? (
        <section className={styles.card}>
          <div className={styles.emptyState}>
            <span className={styles.iconTile} aria-hidden="true">{icons.folder}</span>
            <span>עוד אין פרויקטים</span>
            <span className={styles.cardSub}>פרויקט הוא משהו גדול שמתחלק לשלבים ומשימות</span>
            <button type="button" className={styles.btn} onClick={() => setModal(true)}>+ פתח פרויקט</button>
          </div>
        </section>
      ) : (
        <div className={styles.grid2}>
          {ordered.map((r, i) => {
            const project = { id: r.id, ...r.data };
            const progress = projectProgress({ steps: normalizeSteps(project) });
            return (
              <button key={r.id} type="button" className={styles.card + ' ' + work.projectCard} style={{ cursor: 'grab', textAlign: 'start', opacity: dragId === r.id ? 0.5 : 1 }} draggable onDragStart={() => setDragId(r.id)} onDragEnd={() => setDragId(null)} onDragOver={e => e.preventDefault()} onDrop={() => dropOn(r.id)} onClick={() => setOpenId(r.id)} aria-label={'פתח פרויקט: ' + project.name}>
                <div className={styles.toolbar}>
                  <span className={styles.tag}>{i + 1}</span>
                  <h3 className={styles.cardTitle}>{project.name}</h3>
                </div>
                <p className={styles.cardSub}>{metaOf(project).slice(0, 2).join(' · ')}</p>
                <div className={work.progressCaption}><span>{progress.total ? `${progress.done} מתוך ${progress.total} שלבים הושלמו` : 'עוד לא הוגדרו שלבים'}</span><span className={work.openHint}>פתיחת פרויקט ←</span></div>
                <div className={styles.toolbar} style={{ flexWrap: 'nowrap' }}>
                  <div className={styles.progress} style={{ flex: 1 }}><div className={styles.progressFill} style={{ width: (progress.rate || 0) * 100 + '%' }} /></div>
                  <span className={styles.num}>{percentLabel(progress.rate ?? 0)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {records.length > 1 && <p className={styles.note}>גרור פרויקט כדי לשנות את סדר העדיפות. הסדר נשמר.</p>}
      {modal && <ProjectForm title="פרויקט חדש" initial={EMPTY_FORM} submitLabel="פתח פרויקט" onSubmit={create} onClose={() => setModal(false)} />}
    </div>
  );
}
