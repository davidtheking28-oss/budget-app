import { useMemo, useState } from 'react';
import { FIXED_CATS, EXPENSE_CATS, CHART_PALETTE } from '../categories.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './BudgetWizard.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

const STEPS = ['הכנסות', 'הוצאות קבועות', 'תקציב משתנה', 'יעדים', 'סיכום'];
const SUGGESTED_INCOME = ['שכר', 'שכר בן/בת זוג', 'קצבת ילדים', 'פרילנס'];
const SUGGESTED_FIXED = ['דיור', 'ארנונה', 'חשמל', 'מים וביוב', 'ביטוחים', 'חינוך, חוגים וקייטנות'];
const SUGGESTED_VAR = ['מזון לבית', 'אוכל בחוץ ובילויים', 'דלק וחניה', 'ביגוד והנעלה', 'בריאות', 'תחביבים'];

function sumAmounts(list) {
  return list.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
}

export default function BudgetWizard({ data, save, onClose }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [incomes, setIncomes] = useState(() => {
    const existing = data?.settings?.incomeSources || [];
    return existing.length ? existing.map(s => ({ name: s.name || '', amount: s.amount ?? '' })) : [{ name: 'שכר', amount: '' }];
  });
  const [fixed, setFixed] = useState(() =>
    (data?.fixed_expenses || []).map(f => ({ name: f.id, amount: f.amount ?? '' }))
  );
  const [variable, setVariable] = useState(() =>
    Object.entries(data?.budgets || {})
      .filter(([c]) => !FIXED_CATS.includes(c))
      .map(([name, amount]) => ({ name, amount }))
  );
  const [goals, setGoals] = useState(() =>
    (data?.goals || []).map(g => ({ id: g.id, name: g.name || '', target: g.target ?? '', months: g.months ?? '', saved: g.saved || 0 }))
  );

  const totalIncome = useMemo(() => sumAmounts(incomes), [incomes]);
  const totalFixed = useMemo(() => sumAmounts(fixed), [fixed]);
  const totalVar = useMemo(() => sumAmounts(variable), [variable]);
  const goalsMonthly = useMemo(
    () => goals.reduce((s, g) => {
      const t = parseFloat(g.target) || 0;
      const m = parseFloat(g.months) || 0;
      return s + (m > 0 ? Math.max(0, t - (g.saved || 0)) / m : 0);
    }, 0),
    [goals]
  );
  const allocated = totalFixed + totalVar + goalsMonthly;
  const left = totalIncome - allocated;

  function addRow(setter, name = '') { setter(prev => [...prev, { name, amount: '' }]); }
  function updateRow(setter, i, patch) { setter(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  function removeRow(setter, i) { setter(prev => prev.filter((_, idx) => idx !== i)); }

  function pickSuggestion(setter, list, name) {
    if (list.some(r => r.name === name)) { toast('כבר ברשימה', 'info'); return; }
    addRow(setter, name);
  }

  function addGoal() { setGoals(prev => [...prev, { id: Date.now() + Math.random(), name: '', target: '', months: '', saved: 0 }]); }
  function updateGoal(i, patch) { setGoals(prev => prev.map((g, idx) => idx === i ? { ...g, ...patch } : g)); }
  function removeGoal(i) { setGoals(prev => prev.filter((_, idx) => idx !== i)); }

  async function finish() {
    const cleanIncomes = incomes.filter(r => r.name.trim() && parseFloat(r.amount) > 0)
      .map(r => ({ name: r.name.trim(), amount: parseFloat(r.amount) }));
    const cleanFixed = fixed.filter(r => r.name.trim() && parseFloat(r.amount) > 0)
      .map(r => ({ id: r.name.trim(), amount: parseFloat(r.amount) }));
    const cleanVar = variable.filter(r => r.name.trim() && parseFloat(r.amount) > 0);
    const cleanGoals = goals.filter(g => g.name.trim() && parseFloat(g.target) > 0)
      .map(g => ({ id: g.id, name: g.name.trim(), target: parseFloat(g.target), months: parseFloat(g.months) || 0, saved: g.saved || 0 }));

    if (!cleanIncomes.length) { toast('צריך לפחות מקור הכנסה אחד', 'error'); setStep(0); return; }

    setSaving(true);
    const ok = await save(cur => {
      const nextBudgets = { ...(cur.budgets || {}) };
      Object.keys(nextBudgets).forEach(c => { if (!FIXED_CATS.includes(c)) delete nextBudgets[c]; });
      cleanVar.forEach(r => { nextBudgets[r.name.trim()] = parseFloat(r.amount); });
      return {
        settings: { ...(cur.settings || {}), incomeSources: cleanIncomes },
        fixed_expenses: cleanFixed,
        budgets: nextBudgets,
        goals: cleanGoals
      };
    });
    setSaving(false);
    if (ok === false) return;
    toast('התקציב נשמר ועבר לאפליקציה של הלקוח', 'success');
    onClose();
  }

  const breakdown = [
    { label: 'הוצאות קבועות', value: totalFixed, color: CHART_PALETTE[0] },
    { label: 'תקציב משתנה', value: totalVar, color: CHART_PALETTE[1] },
    { label: 'הפרשה ליעדים', value: goalsMonthly, color: CHART_PALETTE[2] },
    { label: 'נותר פנוי', value: Math.max(0, left), color: CHART_PALETTE[5] }
  ].filter(b => b.value > 0);
  const breakdownTotal = breakdown.reduce((s, b) => s + b.value, 0) || 1;

  function rowList(list, setter, placeholder, suggestions) {
    return (
      <>
        {suggestions.length > 0 && (
          <div className={styles.chips}>
            {suggestions.filter(s => !list.some(r => r.name === s)).map(s => (
              <button type="button" key={s} className={styles.chip} onClick={() => pickSuggestion(setter, list, s)}>
                {getCategoryIcon(s)}{s}
              </button>
            ))}
          </div>
        )}
        <div className={styles.rows}>
          {list.map((r, i) => (
            <div className={styles.row} key={i}>
              <input
                className={styles.input}
                aria-label="שם"
                placeholder={placeholder}
                value={r.name}
                onChange={e => updateRow(setter, i, { name: e.target.value })}
              />
              <input
                className={styles.input + ' ' + styles.amountInput}
                type="number"
                inputMode="decimal"
                aria-label="סכום חודשי"
                placeholder="0"
                value={r.amount}
                onChange={e => updateRow(setter, i, { amount: e.target.value })}
              />
              <DeleteButton onClick={() => removeRow(setter, i)} />
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={() => addRow(setter)}>+ הוסף שורה</Button>
      </>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>בניית תקציב עם הלקוח</div>
          <div className={styles.subtitle}>{STEPS[step]} · שלב {step + 1} מתוך {STEPS.length}</div>
        </div>
        <Button variant="ghost" onClick={onClose}>סגור</Button>
      </div>

      <div className={styles.stepper}>
        {STEPS.map((s, i) => (
          <button
            type="button"
            key={s}
            className={styles.stepDot + (i === step ? ' ' + styles.stepActive : '') + (i < step ? ' ' + styles.stepDone : '')}
            onClick={() => setStep(i)}
            aria-label={s}
            aria-current={i === step ? 'step' : undefined}
          >
            <span>{s}</span>
          </button>
        ))}
      </div>

      <div className={styles.tally}>
        <div className={styles.tallyItem}>
          <div className={styles.tallyLabel}>הכנסות</div>
          <div className={styles.tallyValue}>{fmt(totalIncome)}</div>
        </div>
        <div className={styles.tallyItem}>
          <div className={styles.tallyLabel}>הוקצה</div>
          <div className={styles.tallyValue}>{fmt(allocated)}</div>
        </div>
        <div className={styles.tallyItem + ' ' + styles.tallyMain}>
          <div className={styles.tallyLabel}>נותר לתקצוב</div>
          <div className={styles.tallyValue + ' ' + (left < 0 ? styles.negative : styles.positive)}>{fmt(left)}</div>
        </div>
      </div>
      {left < 0 && <div className={styles.warn}>ההקצאה חורגת מההכנסות ב-{fmt(Math.abs(left))} לחודש</div>}

      <div className={styles.body}>
        {step === 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>מאיפה מגיע הכסף?</div>
            {rowList(incomes, setIncomes, 'שם מקור ההכנסה', SUGGESTED_INCOME)}
          </div>
        )}

        {step === 1 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>מה יוצא כל חודש בלי קשר להתנהגות</div>
            {rowList(fixed, setFixed, 'שם ההוצאה הקבועה', SUGGESTED_FIXED)}
          </div>
        )}

        {step === 2 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>כמה להקצות לכל קטגוריה משתנה</div>
            {rowList(variable, setVariable, 'שם הקטגוריה', SUGGESTED_VAR)}
          </div>
        )}

        {step === 3 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>למה חוסכים</div>
            <div className={styles.rows}>
              {goals.map((g, i) => {
                const t = parseFloat(g.target) || 0;
                const m = parseFloat(g.months) || 0;
                const monthly = m > 0 ? Math.max(0, t - (g.saved || 0)) / m : 0;
                const pct = t > 0 ? Math.min(100, Math.round(((g.saved || 0) / t) * 100)) : 0;
                return (
                  <div className={styles.goalRow} key={g.id}>
                    <div className={styles.row}>
                      <input className={styles.input} aria-label="שם היעד" placeholder="שם היעד" value={g.name} onChange={e => updateGoal(i, { name: e.target.value })} />
                      <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" aria-label="סכום יעד" placeholder="סכום" value={g.target} onChange={e => updateGoal(i, { target: e.target.value })} />
                      <input className={styles.input + ' ' + styles.monthsInput} type="number" inputMode="numeric" aria-label="תוך כמה חודשים" placeholder="חוד'" value={g.months} onChange={e => updateGoal(i, { months: e.target.value })} />
                      <DeleteButton onClick={() => removeGoal(i)} />
                    </div>
                    <div className={styles.goalMeta}>
                      <div className={styles.goalBar}>
                        <div className={styles.goalFill} style={{ transform: `scaleX(${pct / 100})` }} />
                      </div>
                      <span className={styles.pctChip}>{pct}%</span>
                      {monthly > 0 && <span className={styles.goalNote}>{fmt(monthly)} לחודש</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" onClick={addGoal}>+ הוסף יעד</Button>
          </div>
        )}

        {step === 4 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>סיכום התקציב</div>
            <div className={styles.kpiRow}>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>הכנסה חודשית</div>
                <div className={styles.kpiValue}>{fmt(totalIncome)}</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>תזרים חודשי פנוי</div>
                <div className={styles.kpiValue + ' ' + (left < 0 ? styles.negative : styles.positive)}>{fmt(left)}</div>
              </div>
            </div>
            <div className={styles.reviewCols}>
              <div className={styles.reviewCol}>
                <div className={styles.reviewColTitle}>הכנסות</div>
                {incomes.filter(r => r.name.trim() && parseFloat(r.amount) > 0).length
                  ? incomes.filter(r => r.name.trim() && parseFloat(r.amount) > 0).map((r, i) => (
                    <div className={styles.reviewItem} key={i}>
                      <span className={styles.reviewName}>{r.name}</span>
                      <span className={styles.reviewAmt + ' ' + styles.positive}>{fmt(parseFloat(r.amount))}</span>
                    </div>
                  ))
                  : <div className={styles.reviewEmpty}>לא הוגדרו מקורות הכנסה</div>}
              </div>
              <div className={styles.reviewCol}>
                <div className={styles.reviewColTitle}>הוצאות</div>
                {[...fixed, ...variable].filter(r => r.name.trim() && parseFloat(r.amount) > 0).length
                  ? [...fixed, ...variable].filter(r => r.name.trim() && parseFloat(r.amount) > 0).map((r, i) => (
                    <div className={styles.reviewItem} key={i}>
                      <span className={styles.reviewName}>{r.name}</span>
                      <span className={styles.reviewAmt + ' ' + styles.negative}>-{fmt(parseFloat(r.amount))}</span>
                    </div>
                  ))
                  : <div className={styles.reviewEmpty}>לא הוגדרו הוצאות</div>}
              </div>
            </div>

            <div className={styles.totalsStrip}>
              <div className={styles.totalCell + ' ' + styles.totalIncome}><span>סה״כ הכנסות</span><span>{fmt(totalIncome)}</span></div>
              <div className={styles.totalCell + ' ' + styles.totalExpense}><span>סה״כ הוצאות</span><span>-{fmt(totalFixed + totalVar)}</span></div>
              <div className={styles.totalCell + ' ' + (left < 0 ? styles.totalFlowBad : styles.totalFlowOk)}><span>תזרים</span><span>{fmt(left)}</span></div>
            </div>

            {breakdown.length > 0 && (
              <>
                <div className={styles.stackBar}>
                  {breakdown.map(b => (
                    <div key={b.label} className={styles.stackSeg} style={{ width: (b.value / breakdownTotal * 100) + '%', background: b.color }} title={b.label} />
                  ))}
                </div>
                <div className={styles.legend}>
                  {breakdown.map(b => (
                    <div className={styles.legendRow} key={b.label}>
                      <span className={styles.legendDot} style={{ background: b.color }} />
                      <span className={styles.legendLabel}>{b.label}</span>
                      <span className={styles.legendValue}>{fmt(b.value)}</span>
                      <span className={styles.pctChip}>{Math.round(b.value / breakdownTotal * 100)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className={styles.summaryNote}>השמירה תעדכן את התקציב, ההוצאות הקבועות, מקורות ההכנסה והיעדים באפליקציה של הלקוח.</div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>הקודם</Button>
        {step < STEPS.length - 1
          ? <Button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}>הבא</Button>
          : <Button onClick={finish} disabled={saving}>{saving ? 'שומר...' : 'שמור ושלח ללקוח'}</Button>}
      </div>
    </div>
  );
}
