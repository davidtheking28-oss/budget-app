import { useState } from 'react';
import { fmt } from '../format.js';
import { COMPOUND_DEFAULTS, simulate, requiredMonthly } from './compoundMath.js';
import TrendChart from './TrendChart.jsx';
import styles from './Business.module.css';

const num = v => (v === '' || v == null ? 0 : Number(v) || 0);

function Field({ label, note, value, onChange, unit, step = 'any' }) {
  return (
    <label className={styles.fieldLabel}>
      {label}
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input className={styles.input} type="number" inputMode="decimal" min="0" step={step} value={value} onChange={e => onChange(e.target.value)} />
        <span className={styles.cardSub}>{unit}</span>
      </span>
      {note && <span className={styles.note} style={{ margin: 0 }}>{note}</span>}
    </label>
  );
}

export default function CompoundCalculator() {
  const [mode, setMode] = useState('forward');
  const [initial, setInitial] = useState(String(COMPOUND_DEFAULTS.initial));
  const [monthly, setMonthly] = useState(String(COMPOUND_DEFAULTS.monthly));
  const [target, setTarget] = useState('1000000');
  const [years, setYears] = useState(String(COMPOUND_DEFAULTS.years));
  const [returnPct, setReturnPct] = useState(String(COMPOUND_DEFAULTS.returnPct));
  const [feeDepositPct, setFeeDepositPct] = useState(String(COMPOUND_DEFAULTS.feeDepositPct));
  const [feeAccumPct, setFeeAccumPct] = useState(String(COMPOUND_DEFAULTS.feeAccumPct));
  const [withTax, setWithTax] = useState(true);

  const base = { initial: num(initial), years: Math.max(1, num(years)), returnPct: num(returnPct), feeDepositPct: num(feeDepositPct), feeAccumPct: num(feeAccumPct), withTax };
  const needed = mode === 'goal' ? requiredMonthly(num(target), base) : null;
  const monthlyUsed = mode === 'goal' ? needed ?? 0 : num(monthly);
  const r = simulate({ ...base, monthly: monthlyUsed });

  const headline = mode === 'goal'
    ? (needed == null ? 'לא ניתן להגיע ליעד עם הנתונים האלה' : `הפקדה חודשית נדרשת ${fmt(needed)} כדי להגיע ל-${fmt(num(target))} נטו בעוד ${base.years} שנים.`)
    : `בסוף התקופה נשאר לך ביד ${fmt(r.net)}${withTax ? ' אחרי מס' : ''}.`;

  return (
    <div className={styles.stack}>
      <div className={styles.segment} role="group" aria-label="מצב חישוב" style={{ alignSelf: 'flex-start' }}>
        <button type="button" className={mode === 'forward' ? styles.segBtnOn : styles.segBtn} aria-pressed={mode === 'forward'} onClick={() => setMode('forward')}>כמה יהיה לי</button>
        <button type="button" className={mode === 'goal' ? styles.segBtnOn : styles.segBtn} aria-pressed={mode === 'goal'} onClick={() => setMode('goal')}>מצב מטרה</button>
      </div>

      <section className={styles.card} aria-live="polite">
        <div className={styles.rowTitle} style={{ fontSize: 'var(--text-lg)' }}>{headline}</div>
        {mode === 'forward' && withTax && <div className={styles.note}>לפני מס {fmt(r.gross)} · אחרי מס {fmt(r.net)}</div>}
      </section>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2 className={styles.cardTitle}>הנתונים שלך</h2></div>
          <div className={styles.stack}>
            {mode === 'goal'
              ? <Field label="כמה כסף אני רוצה שיהיה לי" value={target} onChange={setTarget} unit="₪" />
              : <Field label="הפקדה חודשית" value={monthly} onChange={setMonthly} unit="₪" />}
            <Field label="סכום התחלתי" value={initial} onChange={setInitial} unit="₪" />
            <Field label={mode === 'goal' ? 'בעוד כמה שנים' : 'מספר שנים'} value={years} onChange={setYears} unit="שנים" />
            <Field label="תשואה שנתית ממוצעת" note="ממוצע רב־שנתי. להמחשה, לא הבטחה." value={returnPct} onChange={setReturnPct} unit="%" />
          </div>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2 className={styles.cardTitle}>עלויות ומס</h2></div>
          <div className={styles.stack}>
            <Field label="דמי ניהול מהפקדה" note="נגבים מכל הפקדה לפני שהיא מושקעת." value={feeDepositPct} onChange={setFeeDepositPct} unit="%" />
            <Field label="דמי ניהול מצבירה" note="מקטינים את התשואה השנתית בפועל." value={feeAccumPct} onChange={setFeeAccumPct} unit="%" />
            <div className={styles.fieldLabel}>
              מס רווח הון 25%
              <div className={styles.segment} role="group" aria-label="מס רווח הון" style={{ alignSelf: 'flex-start' }}>
                <button type="button" className={withTax ? styles.segBtnOn : styles.segBtn} aria-pressed={withTax} onClick={() => setWithTax(true)}>עם מס</button>
                <button type="button" className={!withTax ? styles.segBtnOn : styles.segBtn} aria-pressed={!withTax} onClick={() => setWithTax(false)}>בלי מס</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2 className={styles.cardTitle}>איך הכסף צמח</h2></div>
          <div className={styles.grid3}>
            <div className={styles.stat}><div className={styles.statLabel}>סך הופקד</div><div className={styles.statValue}>{fmt(r.deposited)}</div></div>
            <div className={styles.stat}><div className={styles.statLabel}>רווח</div><div className={styles.statValue}>{fmt(r.profit)}</div></div>
            <div className={styles.stat}><div className={styles.statLabel}>שווי ברוטו</div><div className={styles.statValue}>{fmt(r.gross)}</div></div>
          </div>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2 className={styles.cardTitle}>מה יורד ומה נשאר</h2></div>
          <div className={styles.grid3}>
            <div className={styles.stat}><div className={styles.statLabel}>עלות דמי הניהול</div><div className={styles.statValue}>{fmt(r.feeCost)}</div></div>
            <div className={styles.stat}><div className={styles.statLabel}>מס רווח הון</div><div className={styles.statValue}>{fmt(r.tax)}</div></div>
            <div className={styles.stat}><div className={styles.statLabel}>נטו בסוף התקופה</div><div className={styles.statValue}>{fmt(r.net)}</div></div>
          </div>
        </section>
      </div>

      <TrendChart
        title="צמיחה לאורך השנים"
        labels={r.rows.map(x => 'שנה ' + x.year)}
        metrics={[
          { key: 'gross', label: 'שווי התיק', values: r.rows.map(x => Math.round(x.gross)), format: fmt },
          { key: 'deposited', label: 'כסף שהופקד', values: r.rows.map(x => Math.round(x.deposited)), format: fmt }
        ]}
      />

      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>לפי שנים</h2></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>שנה</th><th>שווי התיק</th><th>הופקד</th></tr></thead>
            <tbody>{r.rows.map(x => <tr key={x.year}><td>{x.year}</td><td>{fmt(x.gross)}</td><td>{fmt(x.deposited)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className={styles.note}>המידע לצורך למידה ואינו ייעוץ השקעות. התוצאות מבוססות על תשואה שנתית קבועה להמחשה ואינן מנבאות את העתיד.</p>
      </section>
    </div>
  );
}
