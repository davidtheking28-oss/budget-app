import { useEffect, useId, useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Mortgage.module.css';
import { fmt } from '../format.js';

const num = v => parseFloat(v) || 0;

function monthsBetween(asOf, year, month) {
  if (!asOf) return 0;
  const [y, m] = asOf.split('-').map(Number);
  return Math.max(0, (year - y) * 12 + (month - (m - 1)));
}

function ltvTone(ltv) {
  if (ltv <= 50) return 'good';
  if (ltv <= 70) return 'warn';
  return 'bad';
}

function Field({ label, value, onSave, type = 'number', prefix }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const errorId = useId();
  useEffect(() => {
    if (!saving && !saveError) setDraft(String(value ?? ''));
  }, [value, saving, saveError]);

  async function submit() {
    if (saving) return;
    if (draft === String(value ?? '')) { setSaveError(false); return; }
    setSaving(true);
    setSaveError(false);
    try {
      if (await onSave(draft) === false) setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.inputWrap}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <input className={styles.input} type={type} inputMode={type === 'number' ? 'decimal' : undefined} aria-label={label} aria-describedby={saveError ? errorId : undefined} value={draft} disabled={saving} onChange={e => setDraft(e.target.value)} onBlur={submit} />
      </span>
      {saving && <span className={styles.checkNote} role="status">שומר…</span>}
      {saveError && <span id={errorId} className={styles.saveError} role="alert">הערך לא נשמר. הוא נשאר כאן.<button type="button" className={styles.retry} aria-label={'נסה לשמור שוב: ' + label} onClick={submit}>נסה שוב</button></span>}
    </label>
  );
}

function Check({ title, value, note, tone }) {
  return (
    <div className={styles.check + (tone ? ' ' + styles[tone] : '')}>
      <div className={styles.checkTitle}>{title}</div>
      <div className={styles.checkValue + (value === 'חסר' ? ' ' + styles.missing : '')}>{value}</div>
      {note && <div className={styles.checkNote}>{note}</div>}
    </div>
  );
}

export default function Mortgage({ clientUserId, advisorId, year, month }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) return <Skeleton height="260px" radius="18px" />;

  const scenario = data.mortgage_scenario || {};
  const patch = change => save({ mortgage_scenario: { ...scenario, ...change } });

  const loansMonthly = (data.loans || []).filter(l => !l.closed && !l.hidden).reduce((s, l) => s + num(l.monthly), 0);
  const income = scenario.income !== undefined && scenario.income !== '' ? num(scenario.income) : monthSummary(data, year, month).income;

  const elapsed = monthsBetween(scenario.asOf, year, month);
  const principal = num(scenario.principal);
  const monthly = num(scenario.monthly);
  const principalNow = principal > 0 ? principal : null;
  const monthsNow = scenario.monthsLeft !== undefined && scenario.monthsLeft !== '' ? Math.max(0, num(scenario.monthsLeft) - elapsed) : null;
  const propertyValue = num(scenario.propertyValue);
  const ltv = principalNow !== null && propertyValue > 0 ? (principalNow / propertyValue) * 100 : null;
  const gapTo = pct => (principalNow !== null && propertyValue > 0 ? Math.max(0, principalNow - propertyValue * pct / 100) : null);
  const ratio = income > 0 ? ((monthly + loansMonthly) / income) * 100 : null;
  const empty = !principal && !monthly && !propertyValue && !scenario.financier;

  return (
    <section className={styles.card + (scenario.hidden ? ' ' + styles.hidden : '')}>
      <div className={styles.head}>
        <h2 className={styles.title}>משכנתא</h2>
        <button type="button" className={styles.eye} aria-pressed={!scenario.hidden} aria-label={scenario.hidden ? 'הצג בחישוב · משכנתא' : 'הסתר מהחישוב · משכנתא'} title={scenario.hidden ? 'מוסתרת מהחישוב' : 'נכללת בחישוב'} onClick={() => patch({ hidden: !scenario.hidden })}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
            {scenario.hidden && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </div>
      <div className={styles.notes}>
        {empty && <p className={styles.noteStrong}>עוד לא מילאת משכנתא.</p>}
        <p className={styles.note}>ההחזר החודשי משתקף במיפוי ההוצאות הקבועות. יתרת הקרן נשארת כפי שדווחה מהבנק, נכון לתאריך שהוזן, עד לעדכון הבא. מספר החודשים שנותרו מתעדכן לפי החודש הנבחר.</p>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>פרטי המשכנתא</h3>
        <div className={styles.grid + ' ' + styles.detailsGrid}>
          <Field label="גוף מממן" type="text" value={scenario.financier} onSave={v => patch({ financier: v })} />
          <Field label="שווי הנכס" prefix="₪" value={scenario.propertyValue} onSave={v => patch({ propertyValue: v })} />
          <Field label="יתרת קרן" prefix="₪" value={scenario.principal} onSave={v => patch({ principal: v })} />
          <Field label="נכון לתאריך" type="date" value={scenario.asOf} onSave={v => patch({ asOf: v })} />
          <Field label="חודשים שנותרו" value={scenario.monthsLeft} onSave={v => patch({ monthsLeft: v })} />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>החזרים והכנסות</h3>
        <div className={styles.grid}>
          <Field label="החזר חודשי משכנתא" prefix="₪" value={scenario.monthly} onSave={v => patch({ monthly: v })} />
          <div className={styles.field}>
            <span className={styles.fieldLabel}>החזר חודשי הלוואות <span className={styles.calculated}>מחושב</span></span>
            <span className={styles.static}>{fmt(loansMonthly)}</span>
          </div>
          <Field label="הכנסות (לכושר החזר)" prefix="₪" value={scenario.income} onSave={v => patch({ income: v })} />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>המצב החודש</h3>
        <div className={styles.checks}>
          <Check title="יתרת קרן" value={principalNow === null ? 'חסר' : fmt(principalNow)} note="היתרה שדווחה מהבנק, נכון לתאריך שהוזן" />
          <Check title="חודשים שנותרו" value={monthsNow === null ? 'חסר' : monthsNow} note={monthsNow === null ? 'מלאו "חודשים שנותרו" כדי לראות' : undefined} />
          <Check title="אחוז מימון" value={ltv === null ? 'חסר' : ltv.toFixed(1) + '%'} note="ירוק עד 50% · כתום עד 70%" tone={ltv === null ? undefined : ltvTone(ltv)} />
          <Check title="השלמה ל-50% מימון" value={gapTo(50) === null ? 'חסר' : fmt(gapTo(50))} note="כמה הון עצמי חסר כדי להגיע ל-50%" />
          <Check title="השלמה ל-70% מימון" value={gapTo(70) === null ? 'חסר' : fmt(gapTo(70))} note="כמה הון עצמי חסר כדי להגיע ל-70%" />
          <Check title="יחס החזר להכנסה" value={ratio === null ? 'חסר' : ratio.toFixed(1) + '%'} note="משכנתא והלוואות מתוך ההכנסות" tone={ratio === null ? undefined : ratio <= 40 ? 'good' : 'bad'} />
        </div>
      </div>
    </section>
  );
}
