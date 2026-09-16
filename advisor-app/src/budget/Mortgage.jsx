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
const EMPTY_TRACK = {
  type: 'fixed_unlinked', principal: '', annualRate: '', years: '', anchor: '', margin: '', rateFrequency: '', rateUpdateDate: '', purpose: 'purchase', amortMethod: 'spitzer'
};
const AMORT_METHODS = [
  { value: 'spitzer', label: 'שפיצר' },
  { value: 'equal_principal', label: 'קרן שווה' },
  { value: 'bullet', label: 'בולט' }
];
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

  // A loan with a monthly payment pays itself off in remaining/monthly months —
  // once it's gone, that cash frees up for the mortgage ratio. A bullet/interest-
  // only loan (no monthly figure) has no payoff horizon, so it stays active the
  // whole projection.
  const loansWithPayoff = loans.map(l => ({
    monthly: parseFloat(l.monthly) || 0,
    monthsLeft: (parseFloat(l.monthly) || 0) > 0 ? Math.ceil((parseFloat(l.remaining) || 0) / parseFloat(l.monthly)) : Infinity
  }));
  // Directive 329, Appendix A: a "fixed expense" for the payment-to-income ratio
  // is a commitment with more than 18 months remaining — short-tail loans don't count.
  const longTermLoanMonthly = loansWithPayoff.filter(l => l.monthsLeft > 18).reduce((s, l) => s + l.monthly, 0);

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

  // Payment-to-income capacity: average the last 3 months of actual income
  // (falling back to however many months have data) rather than a single
  // month, subtract only long-term (18+ month) loan commitments, then check
  // the 40% Directive 329 §6 capital-weight threshold as the last step.
  const recentIncomes = [0, 1, 2]
    .map(i => { let m = month - i, y = year; while (m < 0) { m += 12; y -= 1; } return monthSummary(data, y, m).income; })
    .filter(inc => inc > 0);
  const avgIncome3mo = recentIncomes.length ? recentIncomes.reduce((s, v) => s + v, 0) / recentIncomes.length : summary.income;
  const totalMonthlyDebt = monthlyPayment + longTermLoanMonthly;
  const debtToIncome = avgIncome3mo > 0 ? (totalMonthlyDebt / avgIncome3mo) * 100 : null;
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
  function updateTrack(id, patch) {
    const base = ensureFormTracks();
    setForm({ ...base, tracks: base.tracks.map(t => t.id === id ? { ...t, ...patch } : t) });
  }
  function addTrack() {
    const base = ensureFormTracks();
    setForm({ ...base, tracks: [...base.tracks, { id: Date.now() + Math.random(), ...EMPTY_TRACK }] });
  }
  function removeTrack(id) {
    const base = ensureFormTracks();
    setForm({ ...base, tracks: (base.tracks || []).filter(t => t.id !== id) });
  }

  async function submitScenario() {
    const tracks = (scenario.tracks || [])
      .filter(t => (parseFloat(t.principal) || 0) > 0 && (parseInt(t.years, 10) || 0) > 0)
      .map(({ id, type, principal, annualRate, years, anchor, margin, rateFrequency, rateUpdateDate, purpose, amortMethod }) =>
        ({ id, type, principal: parseFloat(principal) || 0, annualRate: parseFloat(annualRate) || 0, years: parseInt(years, 10) || 0, anchor, margin: parseFloat(margin) || 0, rateFrequency, rateUpdateDate, purpose, amortMethod }));
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
  }

  return (
    <div>
      <div className={styles.cardTitle}>כשירות רכישה כללית</div>
      <div className={styles.note} style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>
        הערכה כללית לפי הכנסה, הוצאות ונכסים נזילים בתקציב — ללא תלות בתרחיש משכנתא ספציפי. לבניית משכנתא בפועל עם מסלולים וריביות, המשיכו לסימולטור למטה.
      </div>
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

      <div className={styles.cardTitle} style={{ marginTop: 'var(--space-6)' }}>סימולטור משכנתא — מסלולים וריביות</div>
      <div className={styles.note} style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>
        חישוב מדויק לפי המסלולים שתזינו כאן (סכום, ריבית, עוגן) — עצמאי מהכרטיסים הכלליים למעלה, כולל בדיקות מול הוראה 329 של בנק ישראל.
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
          <div className={styles.tableWrap + ' ' + styles.trackTableWrap} style={{ marginBottom: 'var(--space-3)' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>אחוז</th><th>לוח סילוקין</th><th>מסלול</th><th>מטרה</th><th>תדירות עדכון</th><th>תאריך עדכון</th>
                  <th>סכום</th><th>תקופה</th><th>עוגן</th><th>תוספת</th><th>ריבית</th>
                  <th>החזר חודשי</th><th>קיצור / פרעון</th><th>החזר ל-100,000 ₪</th><th></th>
                </tr>
              </thead>
              <tbody>
                {scenario.tracks.map(t => {
                  const pct = loanAmount > 0 ? ((parseFloat(t.principal) || 0) / loanAmount) * 100 : 0;
                  const monthly = trackMonthlyPayment(t);
                  const perHundredK = (parseFloat(t.principal) || 0) > 0 ? (monthly / parseFloat(t.principal)) * 100000 : 0;
                  const onType = type => {
                    const annualRate = t.anchor === 'prime' ? String(PRIME_RATE + (parseFloat(t.margin) || 0)) : t.annualRate;
                    updateTrack(t.id, { type, annualRate });
                  };
                  const onAnchor = anchor => {
                    const annualRate = anchor === 'prime' ? String(PRIME_RATE + (parseFloat(t.margin) || 0)) : t.annualRate;
                    updateTrack(t.id, { anchor, annualRate });
                  };
                  const onMargin = margin => {
                    const annualRate = t.anchor === 'prime' ? String(PRIME_RATE + (parseFloat(margin) || 0)) : t.annualRate;
                    updateTrack(t.id, { margin, annualRate });
                  };
                  return (
                    <tr key={t.id}>
                      <td>{pct.toFixed(0)}%</td>
                      <td>
                        <select className={styles.cellInput} aria-label="לוח סילוקין" value={t.amortMethod} onChange={e => updateTrack(t.id, { amortMethod: e.target.value })}>
                          {AMORT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className={styles.cellInput} aria-label="סוג מסלול" value={t.type} onChange={e => onType(e.target.value)}>
                          {TRACK_TYPES.map(x => <option key={x.value} value={x.value}>{x.abbr}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className={styles.cellInput} aria-label="מטרת המסלול" value={t.purpose} onChange={e => updateTrack(t.id, { purpose: e.target.value })}>
                          {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </td>
                      <td><input className={styles.cellInput} type="number" inputMode="numeric" placeholder="חודשים" aria-label="תדירות עדכון בחודשים" value={t.rateFrequency} onChange={e => updateTrack(t.id, { rateFrequency: e.target.value })} /></td>
                      <td><input className={styles.cellInput} type="date" aria-label="תאריך עדכון קרוב" value={t.rateUpdateDate} onChange={e => updateTrack(t.id, { rateUpdateDate: e.target.value })} /></td>
                      <td><input className={styles.cellInput} type="number" inputMode="decimal" placeholder="סכום" aria-label="סכום המסלול" value={t.principal} onChange={e => updateTrack(t.id, { principal: e.target.value })} /></td>
                      <td><input className={styles.cellInput} type="number" inputMode="numeric" placeholder="שנים" aria-label="תקופה בשנים" value={t.years} onChange={e => updateTrack(t.id, { years: e.target.value })} /></td>
                      <td>
                        <select className={styles.cellInput} aria-label="עוגן" value={t.anchor} onChange={e => onAnchor(e.target.value)}>
                          {ANCHORS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </td>
                      <td><input className={styles.cellInput} type="number" inputMode="decimal" placeholder="%" aria-label="תוספת מעל העוגן" value={t.margin} onChange={e => onMargin(e.target.value)} /></td>
                      <td>
                        <input
                          className={styles.cellInput}
                          type="number"
                          inputMode="decimal"
                          placeholder="%"
                          aria-label="ריבית שנתית"
                          value={t.annualRate}
                          readOnly={t.anchor === 'prime'}
                          title={t.anchor === 'prime' ? 'נגזר אוטומטית מריבית הפריים + תוספת' : undefined}
                          onChange={e => updateTrack(t.id, { annualRate: e.target.value })}
                        />
                      </td>
                      <td>{fmt(monthly)}</td>
                      <td>
                        <div className={styles.trackActions}>
                          <button className={styles.editBtn + ' ' + styles.placeholderBtn} onClick={() => toast('פיצ׳ר קיצור תקופה יתווסף בהמשך', 'info')} aria-disabled="true" title="קיצור (בקרוב)">קיצור</button>
                          <button className={styles.editBtn + ' ' + styles.placeholderBtn} onClick={() => toast('פיצ׳ר פירעון מוקדם יתווסף בהמשך', 'info')} aria-disabled="true" title="פרעון (בקרוב)">פרעון</button>
                        </div>
                      </td>
                      <td>{fmt(perHundredK)}</td>
                      <td><DeleteButton onClick={() => removeTrack(t.id)} title="מחק מסלול" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Button variant="ghost" onClick={addTrack}>+ הוסף מסלול</Button>
        <div className={styles.note}>
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
            <div className={styles.resultRow} title="הכנסה: ממוצע 3 חודשים אחרונים (או פחות אם אין נתונים). החזר: משכנתא + הלוואות עם יתרת תקופה מעל 18 חודשים בלבד — הוראה 329, נספח א'">
              <span className={styles.resultLabel}>כושר החזר (החזר/הכנסה ממוצעת, תקרה: 40%)</span>
              <span className={styles.resultValue + ' ' + (debtToIncome > 40 ? styles.resultBad : styles.resultGood)}>
                {debtToIncome === null ? '—' : debtToIncome.toFixed(1) + '%'}
              </span>
            </div>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>השלמה לתקרת המימון ({ltvCap}%)</span>
              <span className={styles.resultValue + ' ' + (gapToCap > 0 ? styles.resultGood : styles.resultBad)}>{gapToCap > 0 ? fmt(gapToCap) : `כבר מעל ${ltvCap}%`}</span>
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
