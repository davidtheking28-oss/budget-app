import { useState } from 'react';
import { monthsToTarget, baselineMonthlySaving, savingsSeries } from './goalsMath.js';
import styles from './GoalSimulator.module.css';
import { fmt } from '../format.js';

const W = 560;
const H = 180;
const PAD = { l: 8, r: 8, t: 16, b: 24 };

function monthsLabel(m) {
  return Number.isFinite(m) ? `${m} חודשים` : 'ללא קצב חיסכון';
}

export default function GoalSimulator({ goals, transactions }) {
  const saved = goals.reduce((s, g) => s + (g.saved || 0), 0);
  const target = goals.reduce((s, g) => s + (g.target || 0), 0);
  const remaining = Math.max(0, target - saved);
  const [base, setBase] = useState(() => String(baselineMonthlySaving(transactions)));
  const [extra, setExtra] = useState('500');

  if (remaining <= 0) return null;

  const rate = Math.max(0, parseFloat(base) || 0);
  const extraAmt = Math.max(0, parseFloat(extra) || 0);
  const boosted = rate + extraAmt;
  const mNow = monthsToTarget(remaining, rate);
  const mNew = monthsToTarget(remaining, boosted);
  const horizon = Math.min(120, Math.max(6, Number.isFinite(mNow) ? mNow : (Number.isFinite(mNew) ? Math.ceil(mNew * 1.5) : 12)));
  const now = savingsSeries(saved, rate, target, horizon);
  const next = savingsSeries(saved, boosted, target, horizon);
  const x = i => W - PAD.r - (i / horizon) * (W - PAD.l - PAD.r);
  const y = v => PAD.t + (1 - v / target) * (H - PAD.t - PAD.b);
  const path = s => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const faster = Number.isFinite(mNow) && Number.isFinite(mNew) ? mNow - mNew : null;
  const ticks = [0, Math.round(horizon / 2), horizon];

  return (
    <section className={styles.sim} aria-label="סימולציית חיסכון">
      <h3 className={styles.title}>סימולציית חיסכון</h3>
      <div className={styles.inputs}>
        <label className={styles.field} htmlFor="sim-base">
          <span>חיסכון חודשי נוכחי</span>
          <input id="sim-base" type="number" inputMode="decimal" min="0" value={base} onChange={e => setBase(e.target.value)} />
        </label>
        <label className={styles.field} htmlFor="sim-extra">
          <span>תוספת חודשית</span>
          <input id="sim-extra" type="number" inputMode="decimal" min="0" value={extra} onChange={e => setExtra(e.target.value)} />
        </label>
      </div>

      <div className={styles.verdict}>
        <div><span className={styles.k}>בקצב הנוכחי</span><b>{monthsLabel(mNow)}</b></div>
        <div><span className={styles.k}>עם התוספת</span><b className={styles.good}>{monthsLabel(mNew)}</b></div>
      </div>
      {faster > 0 && <p className={styles.gain}>היעדים יושגו {faster} חודשים מוקדם יותר, תמורת {fmt(extraAmt)} נוספים בחודש.</p>}

      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`גרף חיסכון מצטבר: בקצב הנוכחי ${monthsLabel(mNow)}, עם התוספת ${monthsLabel(mNew)}`}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} className={styles.targetLine} />
        <text x={W - PAD.r} y={y(target) - 4} textAnchor="end" className={styles.axis}>יעד {fmt(target)}</text>
        <path d={path(now)} className={styles.lineNow} fill="none" />
        <path d={path(next)} className={styles.lineNext} fill="none" />
        {ticks.map(t => (
          <text key={t} x={x(t)} y={H - 6} textAnchor={t === 0 ? 'end' : t === horizon ? 'start' : 'middle'} className={styles.axis}>{t === 0 ? 'היום' : `${t} ח׳`}</text>
        ))}
      </svg>
      <div className={styles.legend}>
        <span><i className={styles.swNow} />קצב נוכחי</span>
        <span><i className={styles.swNext} />עם תוספת</span>
      </div>
    </section>
  );
}
