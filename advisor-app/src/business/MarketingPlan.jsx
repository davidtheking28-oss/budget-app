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
import { icons } from './BusinessNav.jsx';
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

const LEAD_FIELDS = [{ key: 'meetings', label: 'פגישות התאמה' }, { key: 'closings', label: 'סגירות' }];
const NETWORKS = ['אינסטגרם', 'טיקטוק', 'יוטיוב', 'פייסבוק', 'טוויטר (X)', 'לינקדאין'];

function NetworksModal({ networks, boosts, monthLabel, onSave, onClose }) {
  const [counts, setCounts] = useState(() => Object.fromEntries([...new Set([...NETWORKS, ...Object.keys(networks)])].map(n => [n, networks[n] ?? ''])));
  const [extra, setExtra] = useState('');
  const [boostValue, setBoostValue] = useState(boosts ?? '');
  function addNetwork() {
    const name = extra.trim();
    if (!name || name in counts) return;
    setCounts(prev => ({ ...prev, [name]: '' }));
    setExtra('');
  }
  function submit(e) {
    e.preventDefault();
    const filled = Object.fromEntries(Object.entries(counts).filter(([, v]) => String(v).trim() !== ''));
    onSave(filled, boostValue);
    onClose();
  }
  return (
    <Modal title="בואו נתחיל" onClose={onClose}>
      <form className={styles.formGrid} onSubmit={submit}>
        <p className={styles.cardSub}>כמה עוקבים יש לך היום? רשת שאין לך משאירים ריקה. מכאן נחשב לבד כמה גדלת כל חודש.</p>
        {Object.keys(counts).map(n => (
          <label key={n} className={styles.fieldLabel}>{n}
            <input className={styles.input} inputMode="numeric" placeholder="0" value={counts[n]} onChange={e => setCounts(prev => ({ ...prev, [n]: e.target.value }))} />
          </label>
        ))}
        <div className={styles.toolbar}>
          <input className={styles.input + ' ' + styles.inputGrow} placeholder="שם הרשת" aria-label="שם רשת אחרת" value={extra} onChange={e => setExtra(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNetwork(); } }} />
          <button type="button" className={styles.btnGhost} onClick={addNetwork}>+ רשת אחרת</button>
        </div>
        <label className={styles.fieldLabel}>בוסטים
          <input className={styles.input} inputMode="decimal" placeholder="₪" value={boostValue} onChange={e => setBoostValue(e.target.value)} />
          <span className={styles.note}>תקציב הבוסטים באינסטגרם ל{monthLabel}</span>
        </label>
        <div className={styles.toolbar}>
          <button type="submit" className={styles.btn}>שמירה</button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>אחר כך</button>
        </div>
      </form>
    </Modal>
  );
}

function MonthBody({ advisorId, period, monthLabel, onNavigate, header }) {
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
  const hasBase = v => v != null && String(v).trim() !== '' && Number.isFinite(Number(v));
  const otherBase = allMonths.records.find(r => hasBase(r.data?.baseFollowers))?.data.baseFollowers;
  const baseline = hasBase(data.baseFollowers) ? Number(data.baseFollowers) : hasBase(otherBase) ? Number(otherBase) : null;
  let runningTotal = baseline || 0;
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

  const totalFollowers = growthMetrics[0].values[growthPeriods.indexOf(period)] ?? (baseline || 0) + metrics.followers;
  const priorFollowers = (baseline || 0) + allMonths.records.filter(r => r.period < period).reduce((sum, r) => sum + marketingMetrics(r.data || {}).followers, 0);
  const lastNetworks = data.networks || [...allMonths.records].filter(r => r.period <= period && r.data?.networks).sort((a, b) => b.period.localeCompare(a.period))[0]?.data.networks || {};

  function saveNetworks(networks, boosts) {
    const total = Object.values(networks).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const change = { networks, boosts };
    if (baseline == null) change.baseFollowers = total;
    else change.followers = Math.max(0, total - priorFollowers);
    patch(change);
  }

  const tiles = [
    { key: 'followers', label: 'עוקבים חדשים', value: String(metrics.followers), note: `סה״כ ${totalFollowers}` },
    { key: 'follower', label: 'עלות לעוקב', value: cost(metrics.followers > 0 && metrics.boosts > 0 ? metrics.boosts / metrics.followers : null), note: 'בוסטים חלקי עוקבים חדשים' },
    { key: 'meeting', label: 'עלות לפגישת התאמה', value: cost(metrics.costPerMeeting), note: `${metrics.meetings} פגישות התאמה` },
    { key: 'client', label: 'עלות ללקוח', value: cost(metrics.costPerClient), note: `${metrics.closings} לקוחות נסגרו` }
  ];

  return (
    <div className={styles.stack}>
      <section className={styles.bigCard}>
        {header}
        <div className={styles.cardHead}>
          <div className={styles.sectionLabel}>החודש במספרים</div>
          <span className={styles.toolbar}><span className={styles.rowMeta}>בוסטים: {fmt(metrics.boosts)}</span>{baseline != null && <button type="button" className={styles.btnGhost} onClick={() => setModal('networks')}>עדכון עוקבים</button>}</span>
        </div>
        <div className={styles.tileGrid4}>
          {tiles.map(t => (
            <div key={t.key} className={styles.stat}>
              <div className={styles.statLabel}>{t.label}</div>
              <div className={styles.statValue}>{t.value}</div>
              <div className={styles.statNote}>{t.note}</div>
            </div>
          ))}
        </div>
        {baseline == null && (
          <div className={styles.toolbar} style={{ background: 'var(--surface2,rgba(255,255,255,0.04))', borderRadius: 10, padding: '12px 14px', marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <div className={styles.rowTitle}>בואו נתחיל</div>
              <div className={styles.cardSub}>כמה עוקבים יש לך היום בכל רשת? מכאן נחשב לבד כמה גדלת כל חודש, ואת העלות לעוקב, לפגישה וללקוח.</div>
            </div>
            <button type="button" className={styles.btn} onClick={() => setModal('networks')}>להתחיל</button>
          </div>
        )}
      </section>

      <TrendChart title="איך גדלתי" labels={growthPeriods.map(shortLabel)} metrics={growthMetrics} footnote={growthRange === 'month' ? '12 החודשים האחרונים' : growthRange === 'year' ? 'חודשי השנה' : 'כל התקופה'} controls={
        <div className={styles.segment} role="group" aria-label="טווח הגרף">
          {[['month', 'חודשי'], ['year', 'שנתי'], ['range', 'טווח']].map(([key, label]) => <button key={key} type="button" className={growthRange === key ? styles.segBtnOn : styles.segBtn} aria-pressed={growthRange === key} onClick={() => setGrowthRange(key)}>{label}</button>)}
        </div>
      } />

      <div className={styles.grid3}>
        <button type="button" className={styles.linkTile} onClick={() => setModal('tasks')}>
          <span className={styles.iconTile} aria-hidden="true">{icons.tasks}</span>
          <span className={styles.linkTileTitle}>משימות שיווק</span>
          <span className={styles.linkTileValue}>{progress.done}/{progress.total}</span>
          <span className={styles.rowMeta}>למי שרוצה: סימון ועריכה</span>
        </button>
        <button type="button" className={styles.linkTile} onClick={() => setModal('leads')}>
          <span className={styles.iconTile} aria-hidden="true">{icons.trend}</span>
          <span className={styles.linkTileTitle}>לידים משיווק</span>
          <span className={styles.linkTileValue}>{metrics.meetings} פגישות</span>
          <span className={styles.rowMeta}>{metrics.closings} סגירות</span>
        </button>
        <button type="button" className={styles.linkTile} onClick={() => onNavigate?.('ideas')}>
          <span className={styles.iconTile} aria-hidden="true">{icons.bulb}</span>
          <span className={styles.linkTileTitle}>רעיונות לסרטונים</span>
          <span className={styles.linkTileValue}>{waiting} מחכים</span>
          <span className={styles.rowMeta}>{published} בוצעו</span>
        </button>
      </div>

      {modal === 'tasks' && <TasksModal tasks={tasks} onChange={next => patch({ tasks: next })} onClose={() => setModal(null)} />}
      {modal === 'networks' && <NetworksModal networks={lastNetworks} boosts={data.boosts} monthLabel={monthLabel} onSave={saveNetworks} onClose={() => setModal(null)} />}
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
      monthLabel={`${monthName(ym.month)} ${ym.year}`}
      onNavigate={onNavigate}
      header={(
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>שיווק: {monthName(ym.month)} {ym.year}</h3>
          <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
        </div>
      )}
    />
  );
}
