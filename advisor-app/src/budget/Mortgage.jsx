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
const EMPTY_SCENARIO = { financier: '', propertyValue: '', purchaseType: 'single', tracks: [] };
const EMPTY_TRACK = { type: 'fixed_unlinked', principal: '', pctOfProperty: '', annualRate: '', years: '', anchor: '', margin: '', rateFrequency: '', rateUpdateDate: '', purpose: 'purchase' };
const PURPOSES = [
  { value: 'purchase', label: 'רכישת דירה' },
  { value: 'any', label: 'לכל מטרה' }
];
// Directive 329, section 2: max LTV by property classification.
const PURCHASE_TYPES = [
  { value: 'single', label: 'דירה יחידה', ltvCap: 75 },
  { value: 'replacement', label: 'דירה חליפית', ltvCap: 70 },
  { value: 'investment', label: 'דירה להשקעה', ltvCap: 50 }
];
// Directive 329, section 10א: a housing loan not for purchase ("לכל מטרה") may
// exceed the section-4 cumulative cap up to 70% LTV, as long as the amount
// above 50% doesn't exceed ₪200,000 — not a flat 50% cap.
const ANY_PURPOSE_LTV_HARD_CAP = 70;
const ANY_PURPOSE_EXCESS_CAP = 200000;
// Directive 329, section 7: the variable-rate share (prime + all "משתנה" tracks
// combined) may not exceed 66.66% of the total loan.
const VARIABLE_SHARE_CAP = 66.66;
// Directive 329, section 8: max final repayment term.
const MAX_TERM_YEARS = 30;
const TRACK_TYPES = [
  { value: 'fixed_unlinked', label: 'קבועה לא צמודה', abbr: 'קל״צ' },
  { value: 'fixed_linked', label: 'קבועה צמודה', abbr: 'ק״צ' },
  { value: 'variable_unlinked', label: 'משתנה לא צמודה', abbr: 'מל״צ' },
  { value: 'variable_linked', label: 'משתנה צמודה', abbr: 'מ״צ' },
  { value: 'prime', label: 'פריים', abbr: 'פריים' }
];
const VARIABLE_TYPES = ['variable_unlinked', 'variable_linked', 'prime'];
const ANCHORS = [
  { value: '', label: 'ללא' },
  { value: 'prime', label: 'פריים' },
  { value: 'avg_rate', label: 'ריבית ממוצעת' },
  { value: 'makam', label: 'מק״מ' },
  { value: 'bonds', label: 'אג״ח' }
];
// From boi-economic-data skill, fetched 2026-09-16 (BR dataflow / CBS CPI).
const BOI_RATE_ASOF = { date: '2026-09-16', rate: 3.25 };
const CPI_YEARLY_ASOF = { date: '2026-08', pct: 1.5 };
const PRIME_MARGIN = 1.5; // standard Israeli prime = BOI rate + 1.5%
const PRIME_RATE = BOI_RATE_ASOF.rate + PRIME_MARGIN;

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
  const purchaseType = scenario.purchaseType || 'single';
  const ltvCap = PURCHASE_TYPES.find(p => p.value === purchaseType)?.ltvCap ?? 75;
  const { totalPrincipal: loanAmount, totalMonthly: monthlyPayment, termMonths } = tracksSummary(scenario.tracks);
  const ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : null;
  const totalMonthlyDebt = monthlyPayment + loanMonthlyTotal;
  const debtToIncome = summary.income > 0 ? (totalMonthlyDebt / summary.income) * 100 : null;
  const gapToCap = propertyValue > 0 ? (ltvCap / 100 - (ltv || 0) / 100) * propertyValue : null;

  const tracks = scenario.tracks || [];
  const variablePrincipal = tracks.filter(t => VARIABLE_TYPES.includes(t.type)).reduce((s, t) => s + (parseFloat(t.principal) || 0), 0);
  const variableShare = loanAmount > 0 ? (variablePrincipal / loanAmount) * 100 : 0;
  const variableShareOverCap = variableShare > VARIABLE_SHARE_CAP;

  const anyPurposePrincipal = tracks.filter(t => t.purpose === 'any').reduce((s, t) => s + (parseFloat(t.principal) || 0), 0);
  const anyPurposeLtv = propertyValue > 0 ? (anyPurposePrincipal / propertyValue) * 100 : 0;
  const anyPurposeExcess = Math.max(0, anyPurposePrincipal - propertyValue * 0.5);
  const anyPurposeOverCap = anyPurposePrincipal > 0 && (anyPurposeLtv > ANY_PURPOSE_LTV_HARD_CAP || anyPurposeExcess > ANY_PURPOSE_EXCESS_CAP);

  const termOverMax = termMonths > MAX_TERM_YEARS * 12;

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
    if (!principal || !years) { toast('נדרשים סכום ותקופה בשנים', 'error'); return; }
    const patch = {
      type: trackForm.type, principal, annualRate: parseFloat(trackForm.annualRate) || 0, years,
      anchor: trackForm.anchor, margin: parseFloat(trackForm.margin) || 0, rateFrequency: trackForm.rateFrequency, rateUpdateDate: trackForm.rateUpdateDate,
      purpose: trackForm.purpose
    };
    const base = ensureFormTracks();
    const tracks = editingTrackId != null
      ? (base.tracks || []).map(t => t.id === editingTrackId ? { ...t, ...patch } : t)
      : [...(base.tracks || []), { id: Date.now() + Math.random(), ...patch }];
    setForm({ ...base, tracks });
    resetTrackForm();
  }
  function startEditTrack(t) {
    setEditingTrackId(t.id);
    setTrackForm({
      type: t.type || 'fixed_unlinked', principal: String(t.principal ?? ''),
      pctOfProperty: propertyValue > 0 && t.principal ? ((t.principal / propertyValue) * 100).toFixed(1) : '',
      annualRate: String(t.annualRate ?? ''), years: String(t.years ?? ''),
      anchor: t.anchor || '', margin: String(t.margin ?? ''), rateFrequency: String(t.rateFrequency ?? ''), rateUpdateDate: t.rateUpdateDate || '',
      purpose: t.purpose || 'purchase'
    });
  }
  function removeTrack(id) {
    const base = ensureFormTracks();
    setForm({ ...base, tracks: (base.tracks || []).filter(t => t.id !== id) });
    if (editingTrackId === id) resetTrackForm();
  }

  async function submitScenario() {
    const tracks = (scenario.tracks || []).map(({ id, type, principal, annualRate, years, anchor, margin, rateFrequency, rateUpdateDate, purpose }) => ({ id, type, principal, annualRate, years, anchor, margin, rateFrequency, rateUpdateDate, purpose }));
    const ok = await save({
      mortgage_scenario: {
        financier: scenario.financier.trim(),
        propertyValue: propertyValue || null,
        purchaseType,
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
          <select className={styles.input} aria-label="סוג רכישה" value={purchaseType} onChange={e => setField('purchaseType', e.target.value)}>
            {PURCHASE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label} (עד {p.ltvCap}% מימון)</option>)}
          </select>
        </div>

        <div className={styles.cardTitle} style={{ fontSize: 'var(--text-md)' }}>מסלולי משכנתא</div>
        {!scenario.tracks?.length && <div className={styles.empty} style={{ padding: 'var(--space-3) 0' }}>אין עדיין מסלולים — הוסף מסלול ראשון</div>}
        {scenario.tracks?.length > 0 && (
          <div className={styles.tableWrap} style={{ marginBottom: 'var(--space-4)' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>אחוז</th><th>מסלול</th><th>מטרה</th><th>סכום</th><th>תקופה</th><th>עוגן</th>
                  <th>תוספת</th><th>ריבית</th><th>תדירות עדכון</th><th>תאריך עדכון</th>
                  <th>החזר חודשי</th><th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {scenario.tracks.map(t => {
                  const abbr = TRACK_TYPES.find(x => x.value === t.type)?.abbr || TRACK_TYPES.find(x => x.value === t.type)?.label || t.type;
                  const anchorLabel = ANCHORS.find(a => a.value === t.anchor)?.label || '—';
                  const pct = loanAmount > 0 ? (t.principal / loanAmount) * 100 : 0;
                  const purposeLabel = PURPOSES.find(p => p.value === t.purpose)?.label || PURPOSES[0].label;
                  return (
                    <tr key={t.id} className={styles.trackRow} onClick={() => startEditTrack(t)}>
                      <td>{pct.toFixed(0)}%</td>
                      <td>{abbr}</td>
                      <td>{purposeLabel}</td>
                      <td>{fmt(t.principal)}</td>
                      <td>{t.years} שנים</td>
                      <td>{anchorLabel}</td>
                      <td>{t.margin ? t.margin + '%' : '—'}</td>
                      <td>{t.annualRate}%</td>
                      <td>{t.rateFrequency ? t.rateFrequency + ' ח׳' : '—'}</td>
                      <td>{t.rateUpdateDate || '—'}</td>
                      <td>{fmt(trackMonthlyPayment(t))}</td>
                      <td>
                        <div className={styles.trackActions}>
                          <button className={styles.editBtn} onClick={e => { e.stopPropagation(); startEditTrack(t); }} aria-label={`ערוך מסלול ${abbr} ${fmt(t.principal)}`} title="ערוך מסלול">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <DeleteButton onClick={e => { e.stopPropagation(); removeTrack(t.id); }} title={`מחק מסלול ${abbr} ${fmt(t.principal)}`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.form + ' ' + styles.trackForm}>
          <select
            className={styles.input}
            aria-label="סוג מסלול"
            value={trackForm.type}
            onChange={e => {
              const type = e.target.value;
              const annualRate = trackForm.anchor === 'prime' ? String(PRIME_RATE + (parseFloat(trackForm.margin) || 0)) : trackForm.annualRate;
              setTrackForm({ ...trackForm, type, annualRate });
            }}
          >
            {TRACK_TYPES.map(x => <option key={x.value} value={x.value}>{x.label} ({x.abbr})</option>)}
          </select>
          <select className={styles.input} aria-label="מטרת המסלול" value={trackForm.purpose} onChange={e => setTrackForm({ ...trackForm, purpose: e.target.value })}>
            {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            placeholder="סכום"
            aria-label="סכום המסלול"
            value={trackForm.principal}
            onChange={e => {
              const principal = e.target.value;
              const pctOfProperty = propertyValue > 0 && principal ? ((parseFloat(principal) / propertyValue) * 100).toFixed(1) : trackForm.pctOfProperty;
              setTrackForm({ ...trackForm, principal, pctOfProperty });
            }}
          />
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            placeholder="% משווי הנכס"
            aria-label="אחוז משווי הנכס"
            title={propertyValue > 0 ? undefined : 'יש להזין שווי נכס כדי לחשב סכום לפי אחוז'}
            value={trackForm.pctOfProperty}
            onChange={e => {
              const pctOfProperty = e.target.value;
              const principal = propertyValue > 0 ? String(Math.round(propertyValue * ((parseFloat(pctOfProperty) || 0) / 100))) : trackForm.principal;
              setTrackForm({ ...trackForm, pctOfProperty, principal });
            }}
          />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="תקופה (שנים)" aria-label="תקופה בשנים" value={trackForm.years} onChange={e => setTrackForm({ ...trackForm, years: e.target.value })} />
          <select
            className={styles.input}
            aria-label="עוגן"
            value={trackForm.anchor}
            onChange={e => {
              const anchor = e.target.value;
              const annualRate = anchor === 'prime' ? String(PRIME_RATE + (parseFloat(trackForm.margin) || 0)) : trackForm.annualRate;
              setTrackForm({ ...trackForm, anchor, annualRate });
            }}
          >
            {ANCHORS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            placeholder="תוספת (מרווח) %"
            aria-label="תוספת מעל העוגן"
            value={trackForm.margin}
            onChange={e => {
              const margin = e.target.value;
              const annualRate = trackForm.anchor === 'prime' ? String(PRIME_RATE + (parseFloat(margin) || 0)) : trackForm.annualRate;
              setTrackForm({ ...trackForm, margin, annualRate });
            }}
          />
          <input
            className={styles.input}
            type="number"
            inputMode="decimal"
            placeholder="ריבית שנתית %"
            aria-label="ריבית שנתית"
            value={trackForm.annualRate}
            readOnly={trackForm.anchor === 'prime'}
            title={trackForm.anchor === 'prime' ? 'נגזר אוטומטית מריבית הפריים + תוספת' : undefined}
            onChange={e => setTrackForm({ ...trackForm, annualRate: e.target.value })}
          />
          {VARIABLE_TYPES.includes(trackForm.type) && (
            <>
              <input className={styles.input} type="number" inputMode="numeric" placeholder="תדירות עדכון (חודשים)" aria-label="תדירות עדכון בחודשים" value={trackForm.rateFrequency} onChange={e => setTrackForm({ ...trackForm, rateFrequency: e.target.value })} />
              <input className={styles.input} type="date" aria-label="תאריך עדכון קרוב" value={trackForm.rateUpdateDate} onChange={e => setTrackForm({ ...trackForm, rateUpdateDate: e.target.value })} />
            </>
          )}
          <Button onClick={submitTrack}>{editingTrackId != null ? 'שמור מסלול' : 'הוסף מסלול'}</Button>
          {editingTrackId != null && <Button variant="ghost" onClick={resetTrackForm}>ביטול</Button>}
        </div>
        <div className={styles.note} style={{ marginTop: 0 }}>
          ריבית בנק ישראל: {BOI_RATE_ASOF.rate}% ({BOI_RATE_ASOF.date}) · מדד עדכני (שנתי): +{CPI_YEARLY_ASOF.pct}% ({CPI_YEARLY_ASOF.date}) — מקור: בנק ישראל / הלמ״ס. ריבית פריים ({PRIME_RATE}%) מתמלאת אוטומטית עבור מסלול/עוגן "פריים". מסלול "לכל מטרה" נושא בדרך כלל ריבית גבוהה יותר ממסלול לרכישת דירה, ומוגבל (בצירוף שאר מסלולי "לכל מטרה") עד {ANY_PURPOSE_LTV_HARD_CAP}% מימון ובלבד שהחריגה מעל 50% לא תעלה על {fmt(ANY_PURPOSE_EXCESS_CAP)} — יש להזין את הריבית בהתאם לתנאי הבנק.
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
              <span className={styles.resultLabel}>אחוז מימון (תקרה: {ltvCap}%, {PURCHASE_TYPES.find(p => p.value === purchaseType)?.label})</span>
              <span className={styles.resultValue + ' ' + (ltv > ltvCap ? styles.resultBad : styles.resultGood)}>{ltv.toFixed(1)}%</span>
            </div>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>כושר החזר (החזר/הכנסה)</span>
              <span className={styles.resultValue + ' ' + (debtToIncome > 40 ? styles.resultBad : styles.resultGood)}>
                {debtToIncome === null ? '—' : debtToIncome.toFixed(1) + '%'}
              </span>
            </div>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>השלמה לתקרת המימון ({ltvCap}%)</span>
              <span className={styles.resultValue}>{gapToCap > 0 ? fmt(gapToCap) : `כבר מעל ${ltvCap}%`}</span>
            </div>
            <div className={styles.resultRow} title="הוראה 329, סעיף 7: החלק בריבית משתנה (פריים + מסלולים משתנים) לא יעלה על 66.66% מסך ההלוואה">
              <span className={styles.resultLabel}>חלק בריבית משתנה (תקרה: {VARIABLE_SHARE_CAP}%)</span>
              <span className={styles.resultValue + ' ' + (variableShareOverCap ? styles.resultBad : styles.resultGood)}>{variableShare.toFixed(1)}%</span>
            </div>
            {anyPurposePrincipal > 0 && (
              <div className={styles.resultRow} title="הוראה 329, סעיף 10א: הלוואה לדיור שלא לצורך רכישה מוגבלת עד 70% מימון, ובלבד שהחריגה מעל 50% לא תעלה על 200,000 ₪">
                <span className={styles.resultLabel}>מסלולי "לכל מטרה" ({anyPurposeLtv.toFixed(0)}% מימון)</span>
                <span className={styles.resultValue + ' ' + (anyPurposeOverCap ? styles.resultBad : styles.resultGood)}>
                  {fmt(anyPurposePrincipal)}{anyPurposeOverCap ? ' — חורג מהתקרה' : ''}
                </span>
              </div>
            )}
            {termOverMax && (
              <div className={styles.resultRow} title="הוראה 329, סעיף 8: תקופת הפירעון הסופית המרבית היא 30 שנה">
                <span className={styles.resultLabel}>תקופת הלוואה</span>
                <span className={styles.resultValue + ' ' + styles.resultBad}>{Math.round(termMonths / 12)} שנים — חורג מ-{MAX_TERM_YEARS} שנה</span>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.empty}>הזן שווי נכס כדי לראות אחוז מימון וכושר החזר</div>
        )}
        <div className={styles.note}>הכנסה, הוצאות והלוואות נשלפות מהתקציב ומטאב «נכסים והתחייבויות» — אין צורך להזין אותן כאן שוב. תקרות המימון והריבית המשתנה מבוססות על הוראת ניהול בנקאי תקין 329 של בנק ישראל — מגבלות על הבנק, לא ערובה לאישור ההלוואה.</div>
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
