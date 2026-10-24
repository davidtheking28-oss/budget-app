import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { projectProgress, percentLabel } from './bizMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Business.module.css';

function ProjectCard({ project, onUpdate, onRemove }) {
  const [step, setStep] = useState('');
  const steps = project.steps || [];
  const progress = projectProgress(project);

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
  const [name, setName] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="200px" radius="18px" />;

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { toast('כתוב שם לפרויקט', 'error'); return; }
    const row = await add({ name: name.trim(), steps: [] });
    if (row) setName('');
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h3 className={styles.cardTitle}>הפרויקטים שלי</h3>
            <p className={styles.cardSub}>{records.length ? `${records.length} פרויקטים` : 'עוד אין פרויקטים'}</p>
          </div>
        </div>
        <form className={styles.toolbar} onSubmit={submit}>
          <input className={styles.input + ' ' + styles.inputGrow} placeholder="שם הפרויקט" aria-label="שם הפרויקט" value={name} onChange={e => setName(e.target.value)} />
          <button type="submit" className={styles.btn}>פתח פרויקט</button>
        </form>
        {records.length === 0 && <div className={styles.empty}>פרויקט הוא משהו גדול שמתחלק לשלבים ומשימות</div>}
      </section>
      <div className={styles.grid2}>
        {records.map(r => (
          <ProjectCard key={r.id} project={{ id: r.id, ...r.data }} onUpdate={patch => update(r.id, patch)} onRemove={() => remove(r.id, 'הפרויקט נמחק')} />
        ))}
      </div>
    </div>
  );
}
