import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { DEPARTMENTS, PRIORITIES, DIFFICULTIES, bucketTasks, todayIso } from './bizMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Business.module.css';

const FILTERS = [
  { key: 'all', label: 'הכל' },
  { key: 'today', label: 'היום' },
  { key: 'tomorrow', label: 'מחר' },
  { key: 'dated', label: 'לפי תאריך' },
  { key: 'done', label: 'הושלמו' }
];

const EMPTY = { name: '', dept: 'כללי', priority: 'בינונית', difficulty: 'בינונית', dueDate: '', deadline: '' };

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

function priorityClass(p) {
  if (p === 'גבוהה') return styles.tagHigh;
  if (p === 'בינונית') return styles.tagMid;
  return styles.tagLow;
}

export default function BizTasks({ advisorId }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'task');
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');
  const [dept, setDept] = useState('');
  const [priority, setPriority] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const today = todayIso();
  const tomorrow = addDays(today, 1);
  const tasks = records.map(r => ({ id: r.id, ...r.data }));
  const buckets = bucketTasks(tasks, today);

  const visible = tasks
    .filter(t => !dept || t.dept === dept)
    .filter(t => !priority || t.priority === priority)
    .filter(t => {
      if (filter === 'done') return t.done;
      if (t.done) return false;
      if (filter === 'today') return t.dueDate === today;
      if (filter === 'tomorrow') return t.dueDate === tomorrow;
      if (filter === 'dated') return !!t.dueDate;
      return true;
    })
    .sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1);

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast('כתוב שם למשימה', 'error'); return; }
    const row = await add({ ...form, name: form.name.trim(), done: false });
    if (!row) return;
    setForm(EMPTY);
    setAdding(false);
  }

  return (
    <div className={styles.stack}>
      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>משימות היום</h3>
            <span className={styles.statValue}>{buckets.today.length}</span>
          </div>
          {buckets.today.length === 0 ? <div className={styles.empty}>אין משימות להיום</div> : (
            <ul className={styles.rowList}>
              {buckets.today.map(t => (
                <li key={t.id} className={styles.rowItem}>
                  <input type="checkbox" className={styles.check} aria-label={'סמן כבוצע: ' + t.name} checked={!!t.done} onChange={e => update(t.id, { done: e.target.checked })} />
                  <div className={styles.rowMain}><div className={styles.rowTitle}>{t.name}</div><div className={styles.rowMeta}>{t.dept}</div></div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>משימות באיחור</h3>
            <span className={styles.statValue + (buckets.overdue.length ? ' ' + styles.statNeg : '')}>{buckets.overdue.length}</span>
          </div>
          {buckets.overdue.length === 0 ? <div className={styles.empty}>אין משימות באיחור</div> : (
            <ul className={styles.rowList}>
              {buckets.overdue.map(t => (
                <li key={t.id} className={styles.rowItem}>
                  <input type="checkbox" className={styles.check} aria-label={'סמן כבוצע: ' + t.name} checked={!!t.done} onChange={e => update(t.id, { done: e.target.checked })} />
                  <div className={styles.rowMain}><div className={styles.rowTitle}>{t.name}</div><div className={styles.rowMeta}>{t.dept} · היה אמור להסתיים ב-{t.dueDate}</div></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.pills} role="group" aria-label="סינון משימות">
            {FILTERS.map(f => (
              <button key={f.key} type="button" className={filter === f.key ? styles.pillOn : styles.pill} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
          <div className={styles.toolbar}>
            <select className={styles.select} aria-label="מחלקה" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">כל המחלקות</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={styles.select} aria-label="עדיפות" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="">כל העדיפויות</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="button" className={styles.btn} onClick={() => setAdding(a => !a)}>משימה חדשה</button>
          </div>
        </div>

        {adding && (
          <form className={styles.addForm} onSubmit={submit}>
            <input className={styles.input + ' ' + styles.inputGrow} placeholder="שם המשימה" aria-label="שם המשימה" value={form.name} onChange={set('name')} />
            <select className={styles.select} aria-label="מחלקה" value={form.dept} onChange={set('dept')}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select>
            <select className={styles.select} aria-label="עדיפות" value={form.priority} onChange={set('priority')}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select>
            <select className={styles.select} aria-label="רמת קושי" value={form.difficulty} onChange={set('difficulty')}>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select>
            <label>מועד ביצוע <input className={styles.input} type="date" value={form.dueDate} onChange={set('dueDate')} /></label>
            <label>דדליין <input className={styles.input} type="date" value={form.deadline} onChange={set('deadline')} /></label>
            <button type="submit" className={styles.btn}>הוסף משימה</button>
            <button type="button" className={styles.btnGhost} onClick={() => setAdding(false)}>ביטול</button>
          </form>
        )}

        {visible.length === 0 ? <div className={styles.empty}>אין משימות בתצוגה הזו</div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>בוצע</th><th>שם המשימה</th><th>מחלקה</th><th>עדיפות</th><th>רמת קושי</th><th>מועד ביצוע</th><th>דדליין</th><th /></tr>
              </thead>
              <tbody>
                {visible.map(t => (
                  <tr key={t.id} className={t.done ? styles.rowDone : ''}>
                    <td><input type="checkbox" className={styles.check} aria-label={'סמן כבוצע: ' + t.name} checked={!!t.done} onChange={e => update(t.id, { done: e.target.checked })} /></td>
                    <td className={styles.taskName}>{t.name}</td>
                    <td><span className={styles.tag}>{t.dept}</span></td>
                    <td><span className={styles.tag + ' ' + priorityClass(t.priority)}>{t.priority}</span></td>
                    <td>{t.difficulty}</td>
                    <td className={styles.num}>{t.dueDate || '—'}</td>
                    <td className={styles.num}>{t.deadline || '—'}</td>
                    <td><DeleteButton title={'מחק משימה: ' + t.name} onClick={() => remove(t.id, 'המשימה נמחקה')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
