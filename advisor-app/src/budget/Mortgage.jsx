import { useState } from 'react';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { chartTheme } from '../categories.js';
import { tracksSummary, amortizationSchedule, yearlyRollup, trackMonthlyPayment } from './mortgageMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Mortgage.module.css';
import { fmt } from '../format.js';
import { useCountUp } from '../useCountUp.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

// Assets in these categories count as usable equity for a down payment; the
// rest (pension, hishtalmut, gemel, real estate) is treated as illiquid —
// same split the source spreadsheet ("ליווי נדל״ני") drew by hand.
const LIQUID_ASSET_CATS = ['עו״ש', 'חיסכון', 'תיק השקעות'];
const EMPTY_SCENARIO = { financier: '', propertyValue: '', tracks: [] };
const EMPTY_TRACK = { label: '', type: 'fixed', principal: '', annualRate: '', years: '' };
const TRACK_TYPES = [
  { value: 'fixed', label: 'קבועה לא צמודה' },
  { value: 'prime', label: 'פריים' },
  { value: 'cpi', label: 'צמודת מדד' },
  { value: 'other', label: 'אחר' }
];

function KpiValue({ value }) {
  return <>{fmt(useCountUp(value))}</>;
}

export default function Mortgage({ clientUserId, advisorId, year, month }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [form, setForm] = useState(null);
  const [trackForm, setTrackForm] = useState(EMPTY_TRACK);
  const [editingTrackId, setEditingTrackId] = useState(null);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="120px" radius="18px" style={{ marginBottom: 20 }} />
        <Skeleton height="220px" radius="18px" />
      </div>
    );
  }

  const scenario = form || data.mortgage_scenario || EMPTY_SCENARIO;
  const summary = monthSummary(data, year, month);
  const assets = data.assets || [];
  const loans = data.loans || [];
  const loanMonthlyTotal = loans.reduce((s, l) => s + (parseFloat(l.monthly) || 0), 0);
  const liquidAssets = assets.filter(a => LIQUID_ASSET_CATS.includes(a.category)).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  const monthlyOutflow = summary.expense + loanMonthlyTotal;
  const emergencyFundTarget = monthlyOutflow * 3;
  const maxMonthlyPayment = Math.max(0, (summary.income - loanMonthlyTotal) * 0.4);
  const maxMortgage = (maxMonthlyPayment / 500) * 100000;
  const availableEquity = Math.max(0, liquidAssets - emergencyFundTarget);
  const maxPropertyValue = Math.max(0, availableEquity + maxMortgage);

  const propertyValue = parseFloat(scenario.propertyValue) || 0;
  const { totalPrincipal: loanAmount, totalMonthly: monthlyPayment, termMonths } = tracksSummary(scenario.tracks);
  const ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : null;
  const totalMonthlyDebt = monthlyPayment + loanMonthlyTotal;
  const debtToIncome = summary.income > 0 ? (totalMonthlyDebt / summary.income) * 100 : null;
  const gapTo50 = propertyValue > 0 ? (0.5 - (ltv || 0) / 100) * propertyValue : null;
  const gapTo70 = propertyValue > 0 ? (0.7 - (ltv || 0) / 100) * propertyValue : null;

  // A loan with a monthly payment pays itself off in remaining/monthly months —
  // once it's gone, that cash frees up for the mortgage ratio. A bullet/interest-
  // only loan (no monthly figure) has no payoff horizon, so it stays active the
  // whole projection.
  const loansWithPayoff = loans.map(l => ({
    monthly: parseFloat(l.monthly) || 0,
    monthsLeft: (parseFloat(l.monthly) || 0) > 0 ? Math.ceil((parseFloat(l.remaining) || 0) / parseFloat(l.monthly)) : Infinity
  }));
  let runningBalance = availableEquity;
  const projection = propertyValue > 0 ? Array.from({ length: 18 }, (_, i) => {
    const monthNum = i + 1;
    const activeLoanPayments = loansWithPayoff.reduce((s, l) => s + (l.monthsLeft >= monthNum ? l.monthly : 0), 0);
    const monthDebt = monthlyPayment + activeLoanPayments;
    const ratio = summary.income > 0 ? (monthDebt / summary.income) * 100 : null;
    const surplus = summary.income - summary.expense - monthDebt;
    runningBalance += surplus;
    return { monthNum, activeLoanPayments, monthDebt, ratio, surplus, balance: runningBalance };
  }) : [];

  function setField(field, value) {
    setForm({ ...scenario, [field]: value });
  }

  function ensureFormTracks() {
    return form ? form : { ...scenario, tracks: [...(scenario.tracks || [])] };
  }
  function resetTrackForm() { setTrackForm(EMPTY_TRACK); setEditingTrackId(null); }
  function submitTrack() {
    const principal = parseFloat(trackForm.principal) || 0;
    const years = parseInt(trackForm.years, 10) || 0;
    if (!trackForm.label.trim() || !principal || !years) { toast('נדרשים תיאור, סכום ותקופה בשנים', 'error'); return; }
    const patch = { label: trackForm.label.trim(), type: trackForm.type, principal, annualRate: parseFloat(trackForm.annualRate) || 0, years };
    const base = ensureFormTracks();
    const tracks = editingTrackId != null
      ? (base.tracks || []).map(t => t.id === editingTrackId ? { ...t, ...patch } : t)
      : [...(base.tracks || []), { id: Date.now() + Math.random(), ...patch }];
    setForm({ ...base, tracks });
    resetTrackForm();
  }
  function startEditTrack(t) {
    setEditingTrackId(t.id);
    setTrackForm({ label: t.label || '', type: t.type || 'fixed', principal: String(t.principal ?? ''), annualRate: String(t.annualRate ?? ''), years: String(t.years ?? '') });
  }
  function removeTrack(id) {
    const base = ensureFormTracks();
    setForm({ ...base, tracks: (base.tracks || []).filter(t => t.id !== id) });
    if (editingTrackId === id) resetTrackForm();
  }

  async function submitScenario() {
    const tracks = (scenario.tracks || []).map(({ id, label, type, principal, annualRate, years }) => ({ id, label, type, principal, annualRate, years }));
    const ok = await save({
      mortgage_scenario: {
        financier: scenario.financier.trim(),
        propertyValue: propertyValue || null,
        tracks
      }
    });
    if (ok === false) return;
    toast('התרחיש נשמר', 'success');
    setForm(null);
    resetTrackForm();
  }

  return (
    <div>
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>קרן חירום נדרשת</div>
          <div className={styles.kpiValue}><KpiValue value={emergencyFundTarget} /></div>
          <div className={styles.kpiMeta}>3× הוצאות חודשיות כולל הלוואות</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>הון עצמי זמין לרכישה</div>
          <div className={styles.kpiValue}><KpiValue value={availableEquity} /></div>
          <div className={styles.kpiMeta}>נכסים נזילים בניכוי קרן חירום</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>משכנתא מקסימלית</div>
          <div className={styles.kpiValue}><KpiValue value={maxMortgage} /></div>
          <div className={styles.kpiMeta}>לפי החזר חודשי של {fmt(maxMonthlyPayment)}</div>
        </div>
        <div className={styles.kpi + ' ' + styles.kpiMain}>
          <div className={styles.kpiLabel}>שווי נכס מקסימלי לאיתור</div>
          {maxPropertyValue > 0 ? (
            <div className={styles.kpiValue}><KpiValue value={maxPropertyValue} /></div>
          ) : (
            <div className={styles.kpiValue + ' ' + styles.kpiEmpty}>אין עדיין כשירות מספקת</div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>תרחיש נכס</div>
        <div className={styles.form}>
          <input className={styles.input} placeholder="גוף מממן" aria-label="גוף מממן" value={scenario.financier} onChange={e => setField('financier', e.target.value)} />
          <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="שווי נכס" aria-label="שווי נכס" value={scenario.propertyValue} onChange={e => setField('propertyValue', e.target.value)} />
        </div>

        <div className={styles.cardTitle} style={{ fontSize: 'var(--text-md)' }}>מסלולי משכנתא</div>
        {!scenario.tracks?.length && <div className={styles.empty} style={{ padding: 'var(--space-3) 0' }}>אין עדיין מסלולים — הוסף מסלול ראשון</div>}
        {scenario.tracks?.length > 0 && (
          <div className={styles.trackList}>
            {scenario.tracks.map(t => (
              <div key={t.id} className={styles.trackRow} role="button" tabIndex={0} onClick={() => startEditTrack(t)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditTrack(t))}>
                <div className={styles.trackMain}>
                  <div className={styles.trackLabel}>{t.label}<span className={styles.trackType}>{TRACK_TYPES.find(x => x.value === t.type)?.label || t.type}</span></div>
                  <div className={styles.trackMeta}>{fmt(t.principal)} · {t.annualRate}% · {t.years} שנים</div>
                </div>
                <div className={styles.trackActions}>
                  <div className={styles.trackAmount}>{fmt(trackMonthlyPayment(t))}</div>
                  <DeleteButton onClick={e => { e.stopPropagation(); removeTrack(t.id); }} title="מחק מסלול" />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={styles.form}>
          <input className={styles.input} placeholder="תיאור המסלול" aria-label="תיאור המסלול" value={trackForm.label} onChange={e => setTrackForm({ ...trackForm, label: e.target.value })} />
          <select className={styles.input} aria-label="סוג מסלול" value={trackForm.type} onChange={e => setTrackForm({ ...trackForm, type: e.target.value })}>
            {TRACK_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום" aria-label="סכום המסלול" value={trackForm.principal} onChange={e => setTrackForm({ ...trackForm, principal: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="ריבית שנתית %" aria-label="ריבית שנתית" value={trackForm.annualRate} onChange={e => setTrackForm({ ...trackForm, annualRate: e.target.value })} />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="תקופה (שנים)" aria-label="תקופה בשנים" value={trackForm.years} onChange={e => setTrackForm({ ...trackForm, years: e.target.value })} />
          <Button onClick={submitTrack}>{editingTrackId != null ? 'שמור מסלול' : 'הוסף מסלול'}</Button>
          {editingTrackId != null && <Button variant="ghost" onClick={resetTrackForm}>ביטול</Button>}
        </div>

        {loanAmount > 0 && (
          <div className={styles.totalsBar}>
            <span>סה״כ קרן: <b>{fmt(loanAmount)}</b></span>
            <span>סה״כ החזר חודשי: <b>{fmt(monthlyPayment)}</b></span>
            <span>תקופה מקסימלית: <b>{Math.round(termMonths / 12)} שנים</b></span>
          </div>
        )}
        <Button onClick={submitScenario}>שמור תרחיש</Button>

        {propertyValue > 0 ? (
          <div className={styles.resultGrid}>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>אחוז מימון</span>
              <span className={styles.resultValue}>{ltv.toFixed(1)}%</span>
            </div>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>כושר החזר (החזר/הכנסה)</span>
              <span className={styles.resultValue + ' ' + (debtToIncome > 40 ? styles.resultBad : styles.resultGood)}>
                {debtToIncome === null ? '—' : debtToIncome.toFixed(1) + '%'}
              </span>
            </div>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>השלמה ל-50% מימון</span>
              <span className={styles.resultValue}>{gapTo50 > 0 ? fmt(gapTo50) : 'כבר מעל 50%'}</span>
            </div>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>השלמה ל-70% מימון</span>
              <span className={styles.resultValue}>{gapTo70 > 0 ? fmt(gapTo70) : 'כבר מעל 70%'}</span>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>הזן שווי נכס כדי לראות אחוז מימון וכושר החזר</div>
        )}
        <div className={styles.note}>הכנסה, הוצאות והלוואות נשלפות מהתקציב ומטאב «נכסים והתחייבויות» — אין צורך להזין אותן כאן שוב.</div>
      </div>

      {termMonths > 0 && (() => {
        const schedule = amortizationSchedule(scenario.tracks);
        const rollup = yearlyRollup(schedule);
        const CT = chartTheme();
        const chartData = {
          labels: ['0', ...rollup.map(r => String(r.year))],
          datasets: [{
            label: 'יתרת קרן',
            data: [loanAmount, ...rollup.map(r => r.remaining)],
            borderColor: CT.green,
            backgroundColor: CT.green + '22',
            fill: true,
            tension: 0.25,
            pointRadius: 0
          }]
        };
        return (
          <div className={styles.card + ' ' + styles.cardStandalone}>
            <div className={styles.cardTitle}>לוח סילוקין משולב — כלל המסלולים</div>
            <div className={styles.note} style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>לוח זה הוא סילוקין נקי של המשכנתא לפי המסלולים שהוזנו — בשונה מטבלת תזרים 18 החודשים למטה, שמשלבת גם הכנסה, הוצאות והלוואות אחרות.</div>
            <div className={styles.amortChart}>
              <Line data={chartData} options={{
                maintainAspectRatio: false,
                scales: {
                  x: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { display: false } },
                  y: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { color: CT.border } }
                },
                plugins: {
                  legend: { display: false },
                  tooltip: { backgroundColor: CT.surface, borderColor: CT.border, borderWidth: 1, padding: 10, titleFont: { family: CT.font }, bodyFont: { family: CT.font } }
                }
              }} />
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>שנה</th><th>סה״כ שולם</th><th>מתוכו ריבית</th><th>מתוכו קרן</th><th>יתרה בסוף שנה</th></tr>
                </thead>
                <tbody>
                  {rollup.map(r => (
                    <tr key={r.year}>
                      <td>{r.year}</td><td>{fmt(r.totalPaid)}</td><td>{fmt(r.totalInterest)}</td><td>{fmt(r.totalPrincipal)}</td><td>{fmt(r.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {propertyValue > 0 && (
        <div className={styles.card + ' ' + styles.cardStandalone}>
          <div className={styles.cardTitle}>תזרים חיסכון ל-18 חודש</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>חודש</th>
                  <th>הכנסה</th>
                  <th>הוצאות</th>
                  <th>החזרים (הלוואות + משכנתא)</th>
                  <th>יחס החזר</th>
                  <th>עודף חודשי</th>
                  <th>יתרה מצטברת</th>
                </tr>
              </thead>
              <tbody>
                {projection.map(row => (
                  <tr key={row.monthNum} className={row.ratio > 40 ? styles.rowBad : styles.rowGood}>
                    <td>{row.monthNum}</td>
                    <td>{fmt(summary.income)}</td>
                    <td>{fmt(summary.expense)}</td>
                    <td>{fmt(row.monthDebt)}</td>
                    <td>{row.ratio === null ? '—' : row.ratio.toFixed(0) + '%'}</td>
                    <td>{fmt(row.surplus)}</td>
                    <td>{fmt(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.note}>שורה מסומנת באדום כאשר יחס ההחזר עולה מעל 40% מההכנסה החודשית. ירידת הלוואות קיימות בדרך משפיעה על היחס לאורך הטבלה.</div>
        </div>
      )}
    </div>
  );
}
