import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { DEPARTMENTS } from './bizMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Business.module.css';

const SYSTEM_DEPARTMENTS = DEPARTMENTS.filter(d => ['שירות', 'שיווק', 'מכירות', 'פיננסים', 'ניהול'].includes(d));

export default function Systems({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'system');
  const [dept, setDept] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', dept: SYSTEM_DEPARTMENTS[0], notes: '' });

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="200px" radius="18px" />;

  const systems = records.map(r => ({ id: r.id, ...r.data }));
  const countOf = d => systems.filter(s => s.dept === d).length;
  const visible = systems.filter(s => !dept || s.dept === dept);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast('כתוב שם לסיסטם', 'error'); return; }
    const row = await add({ name: form.name.trim(), dept: form.dept, notes: form.notes.trim() });
    if (!row) return;
    setForm({ name: '', dept: form.dept, notes: '' });
    setAdding(false);
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.pills} role="group" aria-label="סינון לפי מחלקה">
            <button type="button" className={!dept ? styles.pillOn : styles.pill} aria-pressed={!dept} onClick={() => setDept('')}>כל הסיסטמים <span className={styles.pillCount}>{systems.length}</span></button>
            {SYSTEM_DEPARTMENTS.map(d => (
              <button key={d} type="button" className={dept === d ? styles.pillOn : styles.pill} aria-pressed={dept === d} onClick={() => setDept(d)}>{d} <span className={styles.pillCount}>{countOf(d)}</span></button>
            ))}
          </div>
          <button type="button" className={styles.btn} onClick={() => setAdding(a => !a)}>הוסף סיסטם</button>
        </div>
        {adding && (
          <form className={styles.addForm} onSubmit={submit}>
            <input className={styles.input + ' ' + styles.inputGrow} placeholder="שם הסיסטם" aria-label="שם הסיסטם" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
            <select className={styles.select} aria-label="מחלקה" value={form.dept} onChange={e => setForm(prev => ({ ...prev, dept: e.target.value }))}>{SYSTEM_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select>
            <input className={styles.input + ' ' + styles.inputGrow} placeholder="איך זה עובד, צעד אחר צעד" aria-label="תיאור הסיסטם" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
            <button type="submit" className={styles.btn}>שמור</button>
            <button type="button" className={styles.btnGhost} onClick={() => setAdding(false)}>ביטול</button>
          </form>
        )}
        {visible.length === 0 ? <div className={styles.empty}>אין סיסטמים כאן עדיין. כל תהליך שחוזר על עצמו בעסק שווה סיסטם.</div> : (
          <ul className={styles.rowList}>
            {visible.map(s => (
              <li key={s.id} className={styles.rowItem}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{s.name} <span className={styles.tag}>{s.dept}</span></div>
                  <textarea className={styles.input} style={{ width: '100%', marginTop: 8, minHeight: 56, padding: 10 }} aria-label={'תיאור: ' + s.name} defaultValue={s.notes} onBlur={e => { if (e.target.value !== (s.notes || '')) update(s.id, { notes: e.target.value }); }} />
                </div>
                <DeleteButton title={'מחק סיסטם: ' + s.name} onClick={() => remove(s.id, 'הסיסטם נמחק')} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
