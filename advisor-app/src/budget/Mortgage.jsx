import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import { toast } from '../toast.js';
import styles from './Mortgage.module.css';
import { fmt } from '../format.js';
import { useCountUp } from '../useCountUp.js';

// Assets in these categories count as usable equity for a down payment; the
// rest (pension, hishtalmut, gemel, real estate) is treated as illiquid —
// same split the source spreadsheet ("ליווי נדל״ני") drew by hand.
const LIQUID_ASSET_CATS = ['עו״ש', 'חיסכון', 'תיק השקעות'];
const EMPTY_SCENARIO = { financier: '', propertyValue: '', loanAmount: '', monthlyPayment: '' };

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

  const monthlyOutflow = summary.expense + loanMonthlyTotal;
  const emergencyFundTarget = monthlyOutflow * 3;
  const maxMonthlyPayment = Math.max(0, (summary.income - loanMonthlyTotal) * 0.4);
  const maxMortgage = (maxMonthlyPayment / 500) * 100000;
  const availableEquity = Math.max(0, liquidAssets - emergencyFundTarget);
  const maxPropertyValue = Math.max(0, availableEquity + maxMortgage);
  const minPropertyValue = Math.max(0, maxPropertyValue - 300000);

  const propertyValue = parseFloat(scenario.propertyValue) || 0;
  const loanAmount = parseFloat(scenario.loanAmount) || 0;
  const monthlyPayment = parseFloat(scenario.monthlyPayment) || 0;
  const ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : null;
  const totalMonthlyDebt = monthlyPayment + loanMonthlyTotal;
  const debtToIncome = summary.income > 0 ? (totalMonthlyDebt / summary.income) * 100 : null;
  const gapTo50 = propertyValue > 0 ? (0.5 - (ltv || 0) / 100) * propertyValue : null;
  const gapTo70 = propertyValue > 0 ? (0.7 - (ltv || 0) / 100) * propertyValue : null;

  function setField(field, value) {
    setForm({ ...scenario, [field]: value });
  }

  async function submitScenario() {
    const ok = await save({
      mortgage_scenario: {
        financier: scenario.financier.trim(),
        propertyValue: propertyValue || null,
        loanAmount: loanAmount || null,
        monthlyPayment: monthlyPayment || null
      }
    });
    if (ok === false) return;
    toast('התרחיש נשמר', 'success');
    setForm(null);
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
          <div className={styles.kpiLabel}>טווח שווי נכס לאיתור</div>
          {maxPropertyValue > 0 ? (
            <div className={styles.kpiValue} dir="ltr"><KpiValue value={minPropertyValue} />–<KpiValue value={maxPropertyValue} /></div>
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
          <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="גובה משכנתא" aria-label="גובה משכנתא" value={scenario.loanAmount} onChange={e => setField('loanAmount', e.target.value)} />
          <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="החזר חודשי משוער" aria-label="החזר חודשי משוער" value={scenario.monthlyPayment} onChange={e => setField('monthlyPayment', e.target.value)} onKeyDown={e => e.key === 'Enter' && submitScenario()} />
          <Button onClick={submitScenario}>שמור תרחיש</Button>
        </div>

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
    </div>
  );
}
