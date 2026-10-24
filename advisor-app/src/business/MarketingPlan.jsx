import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { marketingMetrics, planProgress, percentLabel, ymKey } from './bizMath.js';
import MonthPicker, { monthName } from './MonthPicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { fmt } from '../format.js';
import styles from './Business.module.css';

const FIELDS = [
  { key: 'followers', label: 'עוקבים חדשים' },
  { key: 'followersBudget', label: 'תקציב לעוקבים' },
  { key: 'boosts', label: 'תקציב Boosts' },
  { key: 'meetings', label: 'פגישות התאמה' },
  { key: 'closings', label: 'סגירות' }
];

function costLabel(value) {
  return value === null ? 'אין' : fmt(value);
}

function MonthBody({ advisorId, period }) {
  const { records, loading, error, reload, add, update } = useBizRecords(advisorId, 'marketing_month', period);
  const [task, setTask] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const record = records[0];
  const data = record?.data || {};
  const tasks = data.tasks || [];
  const metrics = marketingMetrics(data);
  const progress = planProgress(tasks);

  async function patch(change) {
    if (record) await update(record.id, change);
    else await add({ tasks: [], ...change });
  }

  function addTask(e) {
    e.preventDefault();
    if (!task.trim()) return;
    patch({ tasks: [...tasks, { id: 't' + Date.now(), text: task.trim(), done: false }] });
    setTask('');
  }

  const toggle = id => patch({ tasks: tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) });
  const dropTask = id => patch({ tasks: tasks.filter(t => t.id !== id) });

  return (
    <div className={styles.stack}>
      <div className={styles.grid4}>
        <div className={styles.stat}><div className={styles.statLabel}>התקדמות תוכנית השיווק</div><div className={styles.statValue}>{percentLabel(progress.rate)}</div><div className={styles.statNote}>{progress.done} מתוך {progress.total} משימות בוצעו</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>עלות לפגישה</div><div className={styles.statValue}>{costLabel(metrics.costPerMeeting)}</div><div className={styles.statNote}>{metrics.meetings} פגישות התאמה</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>עלות ללקוח</div><div className={styles.statValue}>{costLabel(metrics.costPerClient)}</div><div className={styles.statNote}>{metrics.closings} סגירות</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>תקציב החודש</div><div className={styles.statValue}>{fmt(metrics.budget)}</div><div className={styles.statNote}>עוקבים ו-Boosts</div></div>
      </div>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h3 className={styles.cardTitle}>משימות החודש</h3><span className={styles.num}>{progress.done}/{progress.total}</span></div>
          <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress.rate || 0) * 100)} aria-label="התקדמות משימות השיווק">
            <div className={styles.progressFill} style={{ width: (progress.rate || 0) * 100 + '%' }} />
          </div>
          {tasks.length === 0 ? <div className={styles.empty}>עוד אין משימות לחודש הזה</div> : (
            <ul className={styles.rowList}>
              {tasks.map(t => (
                <li key={t.id} className={styles.rowItem}>
                  <input type="checkbox" className={styles.check} aria-label={'בוצע: ' + t.text} checked={t.done} onChange={() => toggle(t.id)} />
                  <div className={styles.rowMain}><div className={styles.rowTitle} style={t.done ? { textDecoration: 'line-through', color: 'var(--text3)' } : undefined}>{t.text}</div></div>
                  <DeleteButton title={'מחק משימה: ' + t.text} onClick={() => dropTask(t.id)} />
                </li>
              ))}
            </ul>
          )}
          <form className={styles.toolbar} onSubmit={addTask}>
            <input className={styles.input + ' ' + styles.inputGrow} placeholder="משימת שיווק חדשה" aria-label="משימת שיווק חדשה" value={task} onChange={e => setTask(e.target.value)} />
            <button type="submit" className={styles.btnGhost}>הוסף</button>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}><h3 className={styles.cardTitle}>נתוני החודש</h3></div>
          <p className={styles.cardSub}>הכמויות נשמרות לכל חודש בנפרד, והמדדים מתעדכנים מיד.</p>
          <ul className={styles.rowList}>
            {FIELDS.map(f => (
              <li key={f.key} className={styles.rowItem}>
                <label className={styles.rowMain} htmlFor={'mk-' + f.key}><span className={styles.rowTitle}>{f.label}</span></label>
                <input id={'mk-' + f.key} className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="0" defaultValue={data[f.key] ?? ''} key={period + f.key + (record?.id || '')} onBlur={e => { if (e.target.value !== String(data[f.key] ?? '')) patch({ [f.key]: e.target.value }); }} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function MarketingPlan({ advisorId }) {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div><h3 className={styles.cardTitle}>משימות שיווק: {monthName(ym.month)} {ym.year}</h3></div>
        </div>
        <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
      </section>
      <MonthBody key={ymKey(ym.year, ym.month)} advisorId={advisorId} period={ymKey(ym.year, ym.month)} />
    </div>
  );
}
