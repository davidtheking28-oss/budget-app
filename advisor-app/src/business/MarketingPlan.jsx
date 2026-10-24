import { useState } from 'react';
import { useBizRecords } from './useBizRecords.js';
import { marketingMetrics, planProgress, ymKey, periodsFor, shortLabel } from './bizMath.js';
import TrendChart from './TrendChart.jsx';
import MonthPicker, { monthName } from './MonthPicker.jsx';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { fmt } from '../format.js';
import styles from './Business.module.css';

const cost = value => (value === null ? 'אין' : fmt(value));

function NumberFields({ fields, data, onSave, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, data[f.key] ?? ''])));
  function submit(e) { e.preventDefault(); onSave(values); onClose(); }
  return (
    <form className={styles.formGrid} onSubmit={submit}>
      {fields.map(f => (
        <label key={f.key} className={styles.fieldLabel}>{f.label}
          <input className={styles.input} inputMode="decimal" placeholder="0" value={values[f.key]} onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))} />
        </label>
      ))}
      <div className={styles.toolbar}>
        <button type="submit" className={styles.btn}>שמירה</button>
        <button type="button" className={styles.btnGhost} onClick={onClose}>ביטול</button>
      </div>
    </form>
  );
}

function TasksModal({ tasks, onChange, onClose }) {
  const [text, setText] = useState('');
  const progress = planProgress(tasks);
  function addTask(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onChange([...tasks, { id: 't' + Date.now(), text: text.trim(), done: false }]);
    setText('');
  }
  return (
    <Modal title="משימות החודש" onClose={onClose}>
      <p className={styles.cardSub}>{progress.done} מתוך {progress.total} משימות בוצעו. לחיצה על תיבה מסמנת שבוצע.</p>
      <ul className={styles.rowList}>
        {tasks.map(t => (
          <li key={t.id} className={styles.rowItem}>
            <input type="checkbox" className={styles.check} aria-label={'בוצע: ' + t.text} checked={t.done} onChange={() => onChange(tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} />
            <div className={styles.rowMain}><div className={styles.rowTitle} style={t.done ? { textDecoration: 'line-through', color: 'var(--text3)' } : undefined}>{t.text}</div></div>
            <DeleteButton title={'מחק משימה: ' + t.text} onClick={() => onChange(tasks.filter(x => x.id !== t.id))} />
          </li>
        ))}
      </ul>
      <form className={styles.toolbar} onSubmit={addTask}>
        <input className={styles.input + ' ' + styles.inputGrow} placeholder="משימת שיווק חדשה" aria-label="משימת שיווק חדשה" value={text} onChange={e => setText(e.target.value)} />
        <button type="submit" className={styles.btn}>הוסף</button>
      </form>
    </Modal>
  );
}

const FOLLOWER_FIELDS = [{ key: 'followers', label: 'עוקבים חדשים בחודש' }, { key: 'followersBudget', label: 'תקציב לעוקבים' }];
const LEAD_FIELDS = [{ key: 'boosts', label: 'תקציב Boosts' }, { key: 'meetings', label: 'פגישות התאמה' }, { key: 'closings', label: 'סגירות' }];

function MonthBody({ advisorId, period, onNavigate, header }) {
  const { records, loading, error, reload, add, update } = useBizRecords(advisorId, 'marketing_month', period);
  const ideas = useBizRecords(advisorId, 'video_idea');
  const allMonths = useBizRecords(advisorId, 'marketing_month');
  const [modal, setModal] = useState(null);
  const [growthRange, setGrowthRange] = useState('month');

  if (error) return <section className={styles.bigCard}>{header}<ErrorState onRetry={reload} /></section>;
  if (loading || ideas.loading || allMonths.loading) return <section className={styles.bigCard}>{header}<Skeleton height="200px" radius="18px" /></section>;

  const record = records[0];
  const data = record?.data || {};
  const tasks = data.tasks || [];
  const metrics = marketingMetrics(data);
  const progress = planProgress(tasks);
  const waiting = ideas.records.filter(r => r.data.status !== 'published').length;
  const published = ideas.records.length - waiting;
  const [periodYear, periodMonth] = period.split('-').map(Number);
  const growthPeriods = periodsFor(growthRange === 'month' ? 'month' : growthRange === 'year' ? 'year' : 'full', { year: periodYear, month: periodMonth - 1 }, allMonths.records);
  const growthMonths = growthPeriods.map(p => marketingMetrics(p === period ? data : (allMonths.records.find(r => r.period === p)?.data || {})));
  let runningTotal = 0;
  const growthMetrics = [
    { key: 'total', label: 'כל העוקבים', values: growthMonths.map(m => { runningTotal += m.followers; return runningTotal; }), format: String },
    { key: 'costPerFollower', label: 'עלות לעוקב', values: growthMonths.map(m => Math.round(m.costPerFollower || 0)), format: fmt },
    { key: 'costPerMeeting', label: 'עלות לפגישה', values: growthMonths.map(m => Math.round(m.costPerMeeting || 0)), format: fmt },
    { key: 'costPerClient', label: 'עלות ללקוח', values: growthMonths.map(m => Math.round(m.costPerClient || 0)), format: fmt }
  ];

  async function patch(change) {
    if (record) await update(record.id, change);
    else await add({ tasks: [], ...change });
  }

  const tiles = [
    { key: 'followers', label: 'עוקבים חדשים', value: String(metrics.followers), note: `סה״כ ${metrics.followers}`, formula: 'מספר העוקבים החדשים שנוספו בחודש' },
    { key: 'meeting', label: 'עלות לפגישה', value: cost(metrics.costPerMeeting), note: `${metrics.meetings} פגישות התאמה`, formula: 'Boosts / פגישות התאמה' },
    { key: 'client', label: 'עלות ללקוח', value: cost(metrics.costPerClient), note: `${metrics.closings} סגירות`, formula: 'Boosts / סגירות' },
    { key: 'budget', label: 'תקציב החודש', value: fmt(metrics.budget), note: metrics.budget ? 'עוקבים ו-Boosts' : 'עוד לא הוזן', formula: 'תקציב לעוקבים + תקציב Boosts' }
  ];

  return (
    <div className={styles.stack}>
      <section className={styles.bigCard}>
        {header}
        <div className={styles.sectionLabel}>התקדמות תוכנית השיווק</div>
        <div className={styles.bigNumber}>{Math.round((progress.rate || 0) * 100)}%</div>
        <p className={styles.cardSub}>{progress.done} מתוך {progress.total} משימות בוצעו</p>
        <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress.rate || 0) * 100)} aria-label="התקדמות תוכנית השיווק">
          <div className={styles.progressFill} style={{ width: (progress.rate || 0) * 100 + '%' }} />
        </div>
        <div className={styles.tileGrid4} style={{ marginTop: 18 }}>
          {tiles.map(t => (
            <div key={t.key} className={styles.stat} title={t.formula}>
              <div className={styles.statLabel}>{t.label}</div>
              <div className={styles.statValue}>{t.value}</div>
              <div className={styles.statNote}>{t.note}</div>
            </div>
          ))}
        </div>
      </section>

      <TrendChart title="איך גדלתי" labels={growthPeriods.map(shortLabel)} metrics={growthMetrics} footnote={growthRange === 'month' ? '12 החודשים האחרונים' : growthRange === 'year' ? 'חודשי השנה' : 'כל התקופה'} controls={
        <div className={styles.segment} role="group" aria-label="טווח הגרף">
          {[['month', 'חודשי'], ['year', 'שנתי'], ['range', 'טווח']].map(([key, label]) => <button key={key} type="button" className={growthRange === key ? styles.segBtnOn : styles.segBtn} aria-pressed={growthRange === key} onClick={() => setGrowthRange(key)}>{label}</button>)}
        </div>
      } />

      <div className={styles.sectionLabel}>פרטי החודש</div>
      <div className={styles.tileGrid4}>
        <button type="button" className={styles.linkTile} onClick={() => setModal('tasks')}>
          <span className={styles.iconTile} aria-hidden="true">✓</span>
          <span className={styles.linkTileTitle}>משימות החודש</span>
          <span className={styles.linkTileValue}>{progress.done}/{progress.total}</span>
          <span className={styles.rowMeta}>לחיצה לסימון ועריכה</span>
        </button>
        <button type="button" className={styles.linkTile} onClick={() => setModal('followers')}>
          <span className={styles.iconTile} aria-hidden="true">◎</span>
          <span className={styles.linkTileTitle}>נתוני עוקבים</span>
          <span className={styles.linkTileValue}>{metrics.followers}</span>
          <span className={styles.rowMeta}>{metrics.followers} החודש</span>
        </button>
        <button type="button" className={styles.linkTile} onClick={() => setModal('leads')}>
          <span className={styles.iconTile} aria-hidden="true">↗</span>
          <span className={styles.linkTileTitle}>לידים משיווק</span>
          <span className={styles.linkTileValue}>{metrics.meetings} פגישות</span>
          <span className={styles.rowMeta}>{metrics.closings} סגירות</span>
        </button>
        <button type="button" className={styles.linkTile} onClick={() => onNavigate?.('ideas')}>
          <span className={styles.iconTile} aria-hidden="true">▣</span>
          <span className={styles.linkTileTitle}>רעיונות לסרטונים</span>
          <span className={styles.linkTileValue}>{waiting} מחכים</span>
          <span className={styles.rowMeta}>{published} פורסמו</span>
        </button>
      </div>
      <p className={styles.note}>אלה משימות תוכנית השיווק של החודש. הכמויות ניתנות לעריכה ונשמרות לכל חודש בנפרד, וכל סימון מופיע גם במסך "מדדים חודשי".</p>

      {modal === 'tasks' && <TasksModal tasks={tasks} onChange={next => patch({ tasks: next })} onClose={() => setModal(null)} />}
      {modal === 'followers' && <Modal title="נתוני עוקבים" onClose={() => setModal(null)}><NumberFields fields={FOLLOWER_FIELDS} data={data} onSave={patch} onClose={() => setModal(null)} /></Modal>}
      {modal === 'leads' && <Modal title="לידים משיווק" onClose={() => setModal(null)}><NumberFields fields={LEAD_FIELDS} data={data} onSave={patch} onClose={() => setModal(null)} /></Modal>}
    </div>
  );
}

export default function MarketingPlan({ advisorId, onNavigate }) {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  return (
    <MonthBody
      advisorId={advisorId}
      period={ymKey(ym.year, ym.month)}
      onNavigate={onNavigate}
      header={(
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>משימות שיווק: {monthName(ym.month)} {ym.year}</h3>
          <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
        </div>
      )}
    />
  );
}
