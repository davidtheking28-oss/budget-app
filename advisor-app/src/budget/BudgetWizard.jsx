import { useMemo, useState } from 'react';
import { FIXED_CATS, EXPENSE_CATS, CHART_PALETTE } from '../categories.js';
import { getMonthTx } from './monthUtils.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './BudgetWizard.module.css';
import { fmt } from '../format.js';

const STEPS = ['הכנסות', 'הוצאות קבועות', 'הוצאות משתנות', 'סיכום'];
const SUGGESTED_INCOME = ['שכר', 'שכר בן/בת זוג', 'קצבת ילדים', 'פרילנס'];

function sumAmounts(list) {
  return list.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
}

// Loose match so a suggestion chip doesn't offer a category the advisor already added
// under a different custom name (e.g. "ביטוחים" vs. an existing "ביטוח בריאות") — compares
// the first few characters of each word so a shared root counts as the same category.
function sameCategory(a, b) {
  const words = s => s.trim().split(/\s+/);
  return words(a).some(wa => words(b).some(wb => wa.slice(0, 4) === wb.slice(0, 4)));
}

export default function BudgetWizard({ data, save, year, month }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Income sources and fixed expenses aren't month-scoped in storage — they're the
  // recurring plan and already apply to every month by default. What's missing is
  // showing this month's actual next to that plan, matched by name (income) / category
  // (fixed), the same way transactions already resolve against them elsewhere.
  const monthTx = useMemo(() => getMonthTx(data?.transactions, year, month), [data, year, month]);
  const incomeActual = useMemo(() => {
    const map = {};
    monthTx.filter(t => t.type === 'income').forEach(t => {
      const descKey = (t.desc || '').trim().toLowerCase();
      if (descKey) map[descKey] = (map[descKey] || 0) + t.amount;
      const catKey = (t.cat || '').trim().toLowerCase();
      if (catKey) map[catKey] = (map[catKey] || 0) + t.amount;
    });
    return map;
  }, [monthTx]);
  const fixedActual = useMemo(() => {
    const map = {};
    monthTx.filter(t => t.type === 'expense' && FIXED_CATS.includes(t.cat)).forEach(t => {
      map[t.cat] = (map[t.cat] || 0) + t.amount;
    });
    return map;
  }, [monthTx]);
  const variableActual = useMemo(() => {
    const map = {};
    monthTx.filter(t => t.type === 'expense' && !FIXED_CATS.includes(t.cat)).forEach(t => {
      map[t.cat] = (map[t.cat] || 0) + t.amount;
    });
    return map;
  }, [monthTx]);

  const [incomes, setIncomes] = useState(() => {
    const existing = data?.settings?.incomeSources || [];
    return existing.length ? existing.map(s => ({ name: s.name || '', amount: s.amount ?? '', day: s.day ?? '' })) : [{ name: 'שכר', amount: '', day: '' }];
  });
  const [fixed, setFixed] = useState(() => {
    const existing = Object.fromEntries((data?.fixed_expenses || []).map(f => [f.id, f.amount ?? '']));
    return FIXED_CATS.map(name => ({ name, amount: existing[name] ?? '' }));
  });
  const [variable, setVariable] = useState(() => {
    const existing = data?.budgets || {};
    return EXPENSE_CATS.map(name => ({ name, amount: existing[name] ?? '' }));
  });
  const [goals] = useState(() =>
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

  // income actual is keyed by both desc and cat per transaction (see incomeActual above),
  // so summing its values would double-count — sum straight off the month's transactions instead
  const totalIncomeActual = useMemo(() => monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [monthTx]);
  const totalFixedActual = useMemo(() => Object.values(fixedActual).reduce((s, v) => s + v, 0), [fixedActual]);
  const totalVarActual = useMemo(() => Object.values(variableActual).reduce((s, v) => s + v, 0), [variableActual]);
  const actualFlow = totalIncomeActual - (totalFixedActual + totalVarActual);

  function addRow(setter, name = '') { setter(prev => [...prev, { name, amount: '' }]); }
  function updateRow(setter, i, patch) { setter(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  function removeRow(setter, i) { setter(prev => prev.filter((_, idx) => idx !== i)); }

  function pickSuggestion(setter, list, name) {
    if (list.some(r => sameCategory(r.name, name))) { toast('כבר ברשימה', 'info'); return; }
    addRow(setter, name);
  }

  async function finish() {
    const cleanIncomes = incomes.filter(r => r.name.trim() && parseFloat(r.amount) > 0)
      .map(r => ({ name: r.name.trim(), amount: parseFloat(r.amount), day: parseInt(r.day, 10) || undefined }));
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
      // keep the Budget tab's per-category budgets in sync with this fixed-expenses list,
      // so the two screens don't show different numbers for the same fixed category
      (cur.fixed_expenses || []).forEach(f => { if (!cleanFixed.some(r => r.id === f.id)) delete nextBudgets[f.id]; });
      cleanFixed.forEach(r => { nextBudgets[r.id] = r.amount; });
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
  }

  const breakdown = [
    { label: 'הוצאות קבועות', value: totalFixed, color: CHART_PALETTE[0] },
    { label: 'תקציב משתנה', value: totalVar, color: CHART_PALETTE[1] },
    { label: 'הפרשה ליעדים', value: goalsMonthly, color: CHART_PALETTE[2] },
    { label: 'נותר פנוי', value: Math.max(0, left), color: CHART_PALETTE[5] }
  ].filter(b => b.value > 0);
  const breakdownTotal = breakdown.reduce((s, b) => s + b.value, 0) || 1;

  function rowList(list, setter, placeholder, suggestions, actualOf, compact = false, dayField = false) {
    const amounts = (r, i) => (
      <>
        <div className={styles.itemAmountBox}>
          <div className={styles.itemAmountBoxLabel}>תכנון</div>
          <input
            className={styles.itemAmountInput}
            type="number"
            inputMode="decimal"
            aria-label="סכום חודשי"
            placeholder="0"
            value={r.amount}
            onChange={e => updateRow(setter, i, { amount: e.target.value })}
          />
        </div>
        {actualOf && (
          <div className={styles.itemActualBox}>
            <div className={styles.itemAmountBoxLabel}>ביצוע</div>
            <div className={styles.itemActualValue}>{fmt(actualOf(r.name))}</div>
          </div>
        )}
      </>
    );

    return (
      <>
        {suggestions.length > 0 && (
          <div className={styles.chips}>
            {suggestions.filter(s => !list.some(r => sameCategory(r.name, s))).map(s => (
              <button type="button" key={s} className={styles.chip} onClick={() => pickSuggestion(setter, list, s)}>
                {getCategoryIcon(s)}{s}
              </button>
            ))}
          </div>
        )}
        <div className={compact ? styles.rowsGrid : styles.rows}>
          {list.map((r, i) => compact ? (
            <div className={styles.itemCard} key={i}>
              <div className={styles.itemCardHead}>
                <span className={styles.itemIcon} aria-hidden="true">{getCategoryIcon(r.name)}</span>
                <input
                  className={styles.itemName}
                  aria-label="שם"
                  placeholder={placeholder}
                  value={r.name}
                  onChange={e => updateRow(setter, i, { name: e.target.value })}
                />
                <DeleteButton onClick={() => removeRow(setter, i)} />
              </div>
              <div className={styles.itemCardAmounts}>{amounts(r, i)}</div>
            </div>
          ) : (
            <div className={styles.itemRow} key={i}>
              <span className={styles.itemIcon} aria-hidden="true">{getCategoryIcon(r.name)}</span>
              <input
                className={styles.itemName}
                aria-label="שם"
                placeholder={placeholder}
                value={r.name}
                onChange={e => updateRow(setter, i, { name: e.target.value })}
              />
              {dayField && (
                <div className={styles.itemAmountBox}>
                  <div className={styles.itemAmountBoxLabel}>יום בחודש</div>
                  <input
                    className={styles.itemAmountInput}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="28"
                    aria-label="יום קבלת ההכנסה בחודש"
                    placeholder="—"
                    value={r.day || ''}
                    onChange={e => updateRow(setter, i, { day: e.target.value })}
                  />
                </div>
              )}
              {amounts(r, i)}
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

      {left < 0 && <div className={styles.warn}>ההקצאה חורגת מההכנסות ב-{fmt(Math.abs(left))} לחודש</div>}

      <div className={styles.body}>
        {step === 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>מאיפה מגיע הכסף?</div>
            {rowList(incomes, setIncomes, 'שם מקור ההכנסה', SUGGESTED_INCOME, name => incomeActual[(name || '').trim().toLowerCase()] || 0, false, true)}
          </div>
        )}

        {step === 1 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>הוצאות קבועות</div>
            {rowList(fixed, setFixed, 'שם ההוצאה הקבועה', [], name => fixedActual[name] || 0, true)}
          </div>
        )}

        {step === 2 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>הוצאות משתנות</div>
            {rowList(variable, setVariable, 'שם הקטגוריה', [], name => variableActual[name] || 0, true)}
          </div>
        )}

        {step === 3 && (
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
                {(() => {
                  const cleanIncomes = incomes.filter(r => r.name.trim() && parseFloat(r.amount) > 0);
                  if (!cleanIncomes.length) return <div className={styles.reviewEmpty}>לא הוגדרו מקורות הכנסה</div>;
                  return (
                    <>
                      <div className={styles.reviewItemHead}><span /><span>תכנון</span><span>בפועל</span></div>
                      {cleanIncomes.map((r, i) => {
                        const plan = parseFloat(r.amount);
                        const actual = incomeActual[(r.name || '').trim().toLowerCase()] || 0;
                        return (
                          <div className={styles.reviewItem} key={i}>
                            <span className={styles.reviewName}>{r.name}</span>
                            <span className={styles.reviewAmt}>{fmt(plan)}</span>
                            <span className={styles.reviewAmt + ' ' + (actual < plan ? styles.negative : styles.positive)}>{fmt(actual)}</span>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
              <div className={styles.reviewCol}>
                <div className={styles.reviewColTitle}>הוצאות</div>
                {(() => {
                  const cleanFixed = fixed.filter(r => r.name.trim() && parseFloat(r.amount) > 0);
                  const cleanVar = variable.filter(r => r.name.trim() && parseFloat(r.amount) > 0);
                  if (!cleanFixed.length && !cleanVar.length) return <div className={styles.reviewEmpty}>לא הוגדרו הוצאות</div>;
                  const expenseRow = (r, key, actualOf) => {
                    const plan = parseFloat(r.amount);
                    const actual = actualOf(r.name) || 0;
                    return (
                      <div className={styles.reviewItem} key={key}>
                        <span className={styles.reviewName}>{r.name}</span>
                        <span className={styles.reviewAmt}>-{fmt(plan)}</span>
                        <span className={styles.reviewAmt + ' ' + (actual > plan ? styles.negative : styles.positive)}>-{fmt(actual)}</span>
                      </div>
                    );
                  };
                  return (
                    <>
                      <div className={styles.reviewItemHead}><span /><span>תכנון</span><span>בפועל</span></div>
                      {cleanFixed.length > 0 && <div className={styles.groupTitle}>הוצאות קבועות</div>}
                      {cleanFixed.map((r, i) => expenseRow(r, 'f' + i, name => fixedActual[name]))}
                      {cleanVar.length > 0 && <div className={styles.groupTitle}>הוצאות משתנות</div>}
                      {cleanVar.map((r, i) => expenseRow(r, 'v' + i, name => variableActual[name]))}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className={styles.totalsStripLabel}>תכנון</div>
            <div className={styles.totalsStrip}>
              <div className={styles.totalCell + ' ' + styles.totalIncome}><span>סה״כ הכנסות</span><span>{fmt(totalIncome)}</span></div>
              <div className={styles.totalCell + ' ' + styles.totalExpense}><span>סה״כ הוצאות</span><span>-{fmt(totalFixed + totalVar)}</span></div>
              {goalsMonthly > 0 && <div className={styles.totalCell + ' ' + styles.totalGoal}><span>הפרשה ליעדים</span><span>-{fmt(goalsMonthly)}</span></div>}
              <div className={styles.totalCell + ' ' + (left < 0 ? styles.totalFlowBad : styles.totalFlowOk)}><span>תזרים</span><span>{fmt(left)}</span></div>
            </div>

            <div className={styles.totalsStripLabel}>בפועל</div>
            <div className={styles.totalsStrip}>
              <div className={styles.totalCell + ' ' + styles.totalIncome}><span>סה״כ הכנסות</span><span>{fmt(totalIncomeActual)}</span></div>
              <div className={styles.totalCell + ' ' + styles.totalExpense}><span>סה״כ הוצאות</span><span>-{fmt(totalFixedActual + totalVarActual)}</span></div>
              <div className={styles.totalCell + ' ' + (actualFlow < 0 ? styles.totalFlowBad : styles.totalFlowOk)}><span>תזרים</span><span>{fmt(actualFlow)}</span></div>
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
