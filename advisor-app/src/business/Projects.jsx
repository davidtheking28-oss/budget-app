import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { projectProgress, percentLabel } from './bizMath.js';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import HeaderAction from './HeaderAction.jsx';
import { icons } from './BusinessNav.jsx';
import styles from './Business.module.css';

function ProjectCard({ project, onUpdate, onRemove }) {
  const [step, setStep] = useState('');
  const steps = project.steps || [];
  const progress = projectProgress(project);
  const meta = [project.importance ? 'חשיבות ' + project.importance + '/10' : '', project.deadline ? 'דדליין ' + new Date(project.deadline).toLocaleDateString('he-IL') : '', project.investment ? 'נדרשת השקעה' : ''].filter(Boolean);

  function addStep(e) {
    e.preventDefault();
    if (!step.trim()) return;
    onUpdate({ steps: [...steps, { id: 's' + Date.now(), text: step.trim(), done: false }] });
    setStep('');
  }

  const toggle = id => onUpdate({ steps: steps.map(s => s.id === id ? { ...s, done: !s.done } : s) });
  const dropStep = id => onUpdate({ steps: steps.filter(s => s.id !== id) });

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.cardTitle}>{project.name}</h3>
          {meta.length ? <p className={styles.cardSub}>{meta.join(' · ')}</p> : null}
          {project.description ? <p className={styles.cardSub}>{project.description}</p> : null}
          <p className={styles.cardSub}>{progress.total ? `${progress.done} מתוך ${progress.total} שלבים · ${percentLabel(progress.rate)}` : 'עוד אין שלבים'}</p>
        </div>
        <DeleteButton title={'מחק פרויקט: ' + project.name} onClick={onRemove} />
      </div>
      <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress.rate || 0) * 100)} aria-label={'התקדמות: ' + project.name}>
        <div className={styles.progressFill} style={{ width: (progress.rate || 0) * 100 + '%' }} />
      </div>
      <ul className={styles.rowList}>
        {steps.map(s => (
          <li key={s.id} className={styles.rowItem}>
            <input type="checkbox" className={styles.check} aria-label={'שלב בוצע: ' + s.text} checked={s.done} onChange={() => toggle(s.id)} />
            <div className={styles.rowMain}><div className={styles.rowTitle} style={s.done ? { textDecoration: 'line-through', color: 'var(--text3)' } : undefined}>{s.text}</div></div>
            <DeleteButton title={'מחק שלב: ' + s.text} onClick={() => dropStep(s.id)} />
          </li>
        ))}
      </ul>
      <form className={styles.toolbar} onSubmit={addStep}>
        <input className={styles.input + ' ' + styles.inputGrow} placeholder="שלב חדש" aria-label={'שלב חדש: ' + project.name} value={step} onChange={e => setStep(e.target.value)} />
        <button type="submit" className={styles.btnGhost}>הוסף שלב</button>
      </form>
    </section>
  );
}

export default function Projects({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'project');
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [importance, setImportance] = useState('');
  const [investment, setInvestment] = useState(false);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="200px" radius="18px" />;

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { toast('כתוב שם לפרויקט', 'error'); return; }
    const rank = Number(importance);
    if (importance !== '' && !(rank >= 1 && rank <= 10)) { toast('דירוג החשיבות הוא מספר בין 1 ל-10', 'error'); return; }
    const row = await add({ name: name.trim(), steps: [], description: description.trim(), deadline, importance: importance === '' ? null : rank, investment });
    if (!row) return;
    setName('');
    setDescription('');
    setDeadline('');
    setImportance('');
    setInvestment(false);
    setModal(false);
  }

  return (
    <div className={styles.stack}>
      <HeaderAction targetId="biz-header-sub" fallback={false}><p className={styles.headSub}>{records.length} פרויקטים</p></HeaderAction>
      <section className={styles.card}>
        <div className={styles.cardHead} style={{ marginBottom: 0 }}>
          <h3 className={styles.cardTitle}>הפרויקטים שלי</h3>
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
          {records.map(r => (
            <ProjectCard key={r.id} project={{ id: r.id, ...r.data }} onUpdate={patch => update(r.id, patch)} onRemove={() => remove(r.id, 'הפרויקט נמחק')} />
          ))}
        </div>
      )}
      {modal && (
        <Modal title="פרויקט חדש" onClose={() => setModal(false)}>
          <form className={styles.formGrid} onSubmit={submit}>
            <label className={styles.fieldLabel}>שם הפרויקט<input className={styles.input} value={name} onChange={e => setName(e.target.value)} /></label>
            <label className={styles.fieldLabel}>תיאור<textarea className={styles.input + ' ' + styles.textarea} value={description} onChange={e => setDescription(e.target.value)} placeholder="פרטים נוספים (לא חובה)" /></label>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>דדליין הפרויקט<input className={styles.input} type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
              <label className={styles.fieldLabel}>דירוג חשיבות (1 עד 10)<input className={styles.input} type="number" min="1" max="10" value={importance} onChange={e => setImportance(e.target.value)} /></label>
            </div>
            <label className={styles.fieldLabel}>נדרשת השקעה כספית?
              <div className={styles.segment} role="group" aria-label="נדרשת השקעה כספית">
                <button type="button" className={!investment ? styles.segBtnOn : styles.segBtn} aria-pressed={!investment} onClick={() => setInvestment(false)}>לא נדרשת</button>
                <button type="button" className={investment ? styles.segBtnOn : styles.segBtn} aria-pressed={investment} onClick={() => setInvestment(true)}>נדרשת</button>
              </div>
            </label>
            <div className={styles.toolbar}>
              <button type="submit" className={styles.btn}>פתח פרויקט</button>
              <button type="button" className={styles.btnGhost} onClick={() => setModal(false)}>ביטול</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
