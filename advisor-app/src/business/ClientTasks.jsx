import { useState } from 'react';
import { useClientList } from '../clients/useClientList.js';
import { monthName } from './MonthPicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { formatDate } from '../budget/monthUtils.js';
import styles from './Business.module.css';

const svgProps = { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const monthLabel = key => key === 'none' ? 'ללא תאריך' : `${monthName(Number(key.slice(5)) - 1)} ${key.slice(0, 4)}`;

function TaskList({ title, hint, empty, tasks, pending, onToggle, onOpen }) {
  return (
    <section className={styles.stack}>
      <div>
        <h2 className={styles.sectionHeading}>{title}</h2>
        <p className={styles.note} style={{ marginTop: 4 }}>{hint}</p>
      </div>
      <div className={styles.card}>
        {tasks.length === 0 ? <div className={styles.emptyState}><span>{empty}</span></div> : (
          <ul className={styles.rowList}>
            {tasks.map(t => (
              <li key={t.id} className={styles.rowItem}>
                <input type="checkbox" className={styles.check} checked={false} disabled={pending.includes(t.id)} aria-label={'השלם: ' + t.title} onChange={() => onToggle(t)} />
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{t.title}</div>
                  <div className={styles.rowMeta}>{t.due_date ? formatDate(t.due_date) : 'ללא תאריך יעד'}{t.task_kind === 'document' ? ' · מסמך' : ''}</div>
                </div>
                <button type="button" className={styles.btnGhost} onClick={() => onOpen(t)}>פתח לקוח</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function ClientTasks({ advisorId, onSelect }) {
  const { clients, tasks, completeTask, loading, error, reload } = useClientList(advisorId);
  const [index, setIndex] = useState(0);
  const [month, setMonth] = useState('all');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState([]);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const pool = clients.filter(c => !search.trim() || [c.name, c.client_email].some(v => (v || '').includes(search.trim())));
  const current = pool[Math.min(index, Math.max(pool.length - 1, 0))];
  const mine = current ? tasks.filter(t => t.client_id === current.client_id && !t.done) : [];
  const monthKey = t => t.due_date ? t.due_date.slice(0, 7) : 'none';
  const months = [...new Set(mine.map(monthKey))].sort();
  const shown = mine.filter(t => month === 'all' || monthKey(t) === month).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const advisorTasks = shown.filter(t => t.responsible !== 'client');
  const clientTasks = shown.filter(t => t.responsible === 'client');
  const totalForClient = current ? tasks.filter(t => t.client_id === current.client_id).length : 0;
  const openEverywhere = tasks.filter(t => !t.done).length;

  const step = delta => { setIndex(i => Math.min(Math.max(i + delta, 0), Math.max(pool.length - 1, 0))); setMonth('all'); };
  async function toggle(task) {
    setPending(prev => [...prev, task.id]);
    try { await completeTask(task); } finally { setPending(prev => prev.filter(id => id !== task.id)); }
  }
  const open = t => onSelect(t.client_id, current?.client_email, { nav: 'crm', action: 'tasks' });

  return (
    <div className={styles.stack}>
      <section className={styles.bigCard}>
        <div className={styles.stack}>
          <div className={styles.segment} role="group" aria-label="סינון לפי חודש" style={{ flexWrap: 'wrap', alignSelf: 'flex-start' }}>
            <button type="button" className={month === 'all' ? styles.segBtnOn : styles.segBtn} aria-pressed={month === 'all'} onClick={() => setMonth('all')}>הכל {mine.length}</button>
            {months.map(m => <button key={m} type="button" className={month === m ? styles.segBtnOn : styles.segBtn} aria-pressed={month === m} onClick={() => setMonth(m)}>{monthLabel(m)} {mine.filter(t => monthKey(t) === m).length}</button>)}
          </div>
          <div className={styles.toolbar} style={{ flexWrap: 'nowrap' }}>
            <button type="button" className={styles.iconBtn} aria-label="הלקוח הבא" disabled={!pool.length || index >= pool.length - 1} onClick={() => step(1)}><svg {...svgProps}><path d="m9 6 6 6-6 6" /></svg></button>
            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <div className={styles.rowTitle}>{current ? (current.name || current.client_email) : 'אין לקוחות'}</div>
              {current && <div className={styles.rowMeta}>{Math.min(index, pool.length - 1) + 1} מתוך {pool.length}</div>}
            </div>
            <button type="button" className={styles.iconBtn} aria-label="הלקוח הקודם" disabled={index <= 0} onClick={() => step(-1)}><svg {...svgProps}><path d="m15 6-6 6 6 6" /></svg></button>
            <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש לקוח..." aria-label="חיפוש לקוח" value={search} onChange={e => { setSearch(e.target.value); setIndex(0); }} />
          </div>
        </div>
      </section>

      <div className={styles.grid3}>
        <div className={styles.stat}><div className={styles.statLabel}>משימות פתוחות במנה</div><div className={styles.statValue}>{mine.length}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>סך המשימות במנה</div><div className={styles.statValue}>{totalForClient}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>פתוחות אצל הלקוחות</div><div className={styles.statValue}>{openEverywhere}</div></div>
      </div>

      <TaskList title="המשימות שלך" hint="כל מה שהוגדר לו במסע השירות ובמשימות שלך. סימון כאן מתעדכן גם בשירות." empty="עוד לא הוגדרו לו משימות במנה." tasks={advisorTasks} pending={pending} onToggle={toggle} onOpen={open} />
      <TaskList title="משימות שהלקוח הוסיף לעצמו" hint="מה שהוא כתב לעצמו באזור האישי, כדי שתדע מה עוד על הראש שלו." empty="הלקוח עוד לא הוסיף לעצמו משימות באזור האישי." tasks={clientTasks} pending={pending} onToggle={toggle} onOpen={open} />
    </div>
  );
}
