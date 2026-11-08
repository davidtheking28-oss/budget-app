import { flushSync } from 'react-dom';
import { BudgetModeContext } from './useClientBudget.js';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FIXED_CATS, CHART_PALETTE, chartTheme, fixedCatsFor, expenseCatsFor, budgetCatsFor } from '../categories.js';
import { getMonthTx } from './monthUtils.js';
import { monthKeyOf, incomeSourcesFor, incomeActualsBySource, budgetActuals, averageMonthSummary, renameExpenseCategories, incomeSourcePatch } from './budgetMath.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import MonthTransactions from './MonthTransactions.jsx';
import { toast } from '../toast.js';
import styles from './BudgetWizard.module.css';
import { fmt } from '../format.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const SAVINGS_CATEGORY = 'הוראת קבע לחסכון';

const topLabels = {
  id: 'topLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const color = getComputedStyle(chart.canvas).color;
    chart.data.datasets.forEach((ds, di) => {
      chart.getDatasetMeta(di).data.forEach((bar, i) => {
        ctx.save();
        ctx.font = '700 15px ' + (chart.options.font?.family || 'inherit');
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmt(ds.data[i]), bar.x, bar.y - 8);
        ctx.restore();
      });
    });
  }
};

const isSavingsRow = r => r.savings || r.name === SAVINGS_CATEGORY;

let rowSequence = 0;

function trackRow(row) { return { ...row, _key: row._key ?? ++rowSequence, _before: { name: row.name, amount: row.amount, day: row.day } }; }

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

export default function BudgetWizard({ data, save, year, month, focusCategory, onDirtyChange, period, onPeriodChange, onEditLinkedExpense }) {
  const mode = useContext(BudgetModeContext);
  const wizardRef = useRef(null);
  useEffect(() => {
    if (!focusCategory) return;
    const frame = requestAnimationFrame(() => {
      const row = [...(wizardRef.current?.querySelectorAll('[data-budget-category]') || [])].find(el => el.dataset.budgetCategory === focusCategory);
      row?.querySelector('input[aria-label^="תקציב"]')?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusCategory]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveProblem, setSaveProblem] = useState('');
  const autoSaveRequested = useRef(false);
  const saveInFlight = useRef(false);
  const retryAutoSave = useRef(false);
  const autoSaveAction = useRef(null);
  const activeSave = useRef(null);
  const flushDraft = useRef(null);
  const [localPeriod, setLocalPeriod] = useState('month');
  const flowPeriod = period ?? localPeriod;
  const setFlowPeriod = onPeriodChange ?? setLocalPeriod;

  const [incomes, setIncomes] = useState(() => {
    const existing = incomeSourcesFor(data?.settings, year, month);
    return (existing.length ? existing.map(s => ({ name: s.name || '', amount: s.amount ?? '', day: s.day ?? '' })) : [{ name: 'שכר', amount: '', day: '' }]).map(trackRow);
  });
  const [fixed, setFixed] = useState(() => {
    const existing = Object.fromEntries((data?.fixed_expenses || []).map(f => [f.id, f.amount ?? '']));
    return fixedCatsFor(data).map(name => trackRow({ name, amount: existing[name] ?? '', ...((data?.fixed_expenses || []).find(row => row.id === name)?.savings ? { savings: true } : {}) }));
  });
  const [variable, setVariable] = useState(() => {
    const existing = data?.budgets || {};
    return expenseCatsFor(mode, data).map(name => trackRow({ name, amount: existing[name] ?? '' }));
  });

  const categoryRenames = useMemo(() => Object.fromEntries([...fixed, ...variable]
    .filter(row => row._before?.name && row.name.trim() && row._before.name !== row.name.trim())
    .map(row => [row._before.name, row.name.trim()])), [fixed, variable]);
  const draftData = useMemo(() => ({
    ...data,
    transactions: renameExpenseCategories(data?.transactions, categoryRenames),
    fixed_expenses: fixed.map(row => ({ ...(data?.fixed_expenses || []).find(item => item.id === (row._before?.name || row.name)), id: row.name.trim(), ...(isSavingsRow(row) ? { savings: true } : {}) })),
    settings: { ...data?.settings, customFixedCats: (data?.settings?.customFixedCats || []).map(name => categoryRenames[name] || name) }
  }), [data, categoryRenames, fixed]);

  // Income sources and fixed expenses aren't month-scoped in storage — they're the
  // recurring plan and already apply to every month by default. What's missing is
  // showing this month's actual next to that plan, matched by name (income) / category
  // (fixed), the same way transactions already resolve against them elsewhere.
  const monthTx = useMemo(() => getMonthTx(draftData.transactions, year, month), [draftData, year, month]);
  const monthlyActual = useMemo(() => budgetActuals(draftData, monthTx), [draftData, monthTx]);
  const fixedActual = monthlyActual.fixed;
  const fixedNameSet = useMemo(() => new Set(fixedCatsFor(draftData)), [draftData]);
  const [rowActualEdits, setRowActualEdits] = useState({});
  const actualEdits = useMemo(() => Object.fromEntries([...fixed, ...variable]
    .filter(row => Object.hasOwn(rowActualEdits, row._key))
    .map(row => [row.name.trim(), rowActualEdits[row._key]])), [fixed, variable, rowActualEdits]);
  const incomeActual = useMemo(() => incomeActualsBySource(monthTx, incomes), [monthTx, incomes]);
  const variableActualBase = monthlyActual.variable;
  const variableActual = useMemo(() => {
    const map = { ...variableActualBase };
    Object.entries(actualEdits).forEach(([name, v]) => {
      const n = parseFloat(v);
      if (!fixedNameSet.has(name) && Number.isFinite(n) && n >= (variableActualBase[name] || 0)) map[name] = n;
    });
    return map;
  }, [variableActualBase, actualEdits, fixedNameSet]);
  const fixedActualFinal = useMemo(() => {
    const map = { ...fixedActual };
    Object.entries(actualEdits).forEach(([name, v]) => {
      const n = parseFloat(v);
      if (fixedNameSet.has(name) && Number.isFinite(n) && n >= (fixedActual[name] || 0)) map[name] = n;
    });
    return map;
  }, [fixedActual, actualEdits, fixedNameSet]);

  const draftSignature = JSON.stringify({ incomes: incomes.map(r => [r.name, String(r.amount ?? ''), String(r.day ?? '')]), fixed: fixed.map(r => [r.name, String(r.amount ?? '')]), variable: variable.map(r => [r.name, String(r.amount ?? '')]), actualEdits });
  const [savedDraft, setSavedDraft] = useState(draftSignature);
  const dirty = draftSignature !== savedDraft;
  useEffect(() => { onDirtyChange?.(dirty || saving); }, [dirty, saving, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, saving]);
  useEffect(() => { if (!dirty && saveStatus === 'dirty') setSaveStatus('idle'); }, [dirty, saveStatus]);
  useEffect(() => { if (dirty && saveStatus === 'saved') setSaveStatus('dirty'); }, [dirty, saveStatus]);

  const totalIncome = useMemo(() => sumAmounts(incomes), [incomes]);
  const totalFixed = useMemo(() => sumAmounts(fixed), [fixed]);
  const totalSavings = useMemo(() => sumAmounts(fixed.filter(isSavingsRow)), [fixed]);
  const totalVar = useMemo(() => sumAmounts(variable), [variable]);
  // goal contributions aren't something the advisor enters in this wizard (goal editing
  // lives in the separate יעדים screen) — don't silently deduct them from cash flow here
  const left = totalIncome - (totalFixed + totalVar);

  const totalIncomeActual = useMemo(
    () => monthTx.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0),
    [monthTx]
  );
  const totalFixedActual = useMemo(() => Object.values(fixedActualFinal).reduce((s, v) => s + v, 0), [fixedActualFinal]);
  const totalVarActual = useMemo(() => Object.values(variableActual).reduce((s, v) => s + v, 0), [variableActual]);
  const actualFlow = totalIncomeActual - (totalFixedActual + totalVarActual);

  // "left"/actualFlow already have the savings standing-order subtracted as an ordinary
  // fixed expense — that's "with a savings deposit". Add it back for the "without" figure.
  const plannedSavings = totalSavings;
  const savingsNames = new Set([SAVINGS_CATEGORY, ...fixed.filter(isSavingsRow).map(row => row.name.trim())]);
  const actualSavings = monthlyActual.savings + Object.entries(actualEdits).reduce((sum, [name, value]) => savingsNames.has(name) ? sum + Math.max(0, (parseFloat(value) || 0) - (fixedActual[name] || 0)) : sum, 0);

  const CT = chartTheme();
  const summaryChartOptions = {
    maintainAspectRatio: false,
    layout: { padding: { top: 28 } },
    animation: ChartJS.defaults.animation === false ? false : { duration: 700, easing: 'easeOutQuart' },
    scales: {
      x: { reverse: true, ticks: { color: CT.text2, font: { family: CT.font, weight: '600' } }, grid: { display: false } },
      y: { display: false, beginAtZero: true, grid: { display: false } }
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
  };
  const chartDataOf = (income, expenses) => ({
    labels: ['הכנסות', 'הוצאות'],
    datasets: [{ data: [income, expenses], backgroundColor: [CT.green, CT.red], hoverBackgroundColor: [CT.greenHover, CT.redHover], borderRadius: 6, barPercentage: 0.45, categoryPercentage: 0.9 }]
  });
  const periodMul = flowPeriod === 'year' ? 12 : 1;
  const avg = useMemo(() => averageMonthSummary(data), [data]);
  const actualCard = flowPeriod === 'avg' && avg
    ? { sub: avg.mappedFixed ? 'קבועות מהמיפוי ומהמחשבונים · יתר התנועות בממוצע בפועל' : `ממוצע חודשי על פני ${avg.months === 1 ? 'חודש אחד' : `${avg.months} חודשים`}`, income: avg.income, expenses: avg.fixed + avg.variable, flow: avg.income - avg.fixed - avg.variable, savings: avg.savings, fixed: avg.fixed, variable: avg.variable }
    : { sub: 'מה קרה בפועל', income: totalIncomeActual, expenses: totalFixedActual + totalVarActual, flow: actualFlow, savings: actualSavings, fixed: totalFixedActual, variable: totalVarActual };
  const planCategories = [...fixed.filter(r => !isSavingsRow(r)), ...variable].map(r => ({ label: r.name, value: parseFloat(r.amount) || 0 }));
  const actualCategories = [...Object.entries(fixedActualFinal), ...Object.entries(variableActual)].map(([label, value]) => ({ label, value }));
  const summaryCards = [
    { key: 'plan', title: 'תכנון', sub: 'מה תוכנן לחודש הזה', income: totalIncome, expenses: totalFixed + totalVar, flow: left, flowNoSavings: left + plannedSavings, breakdown: breakdownOf(totalFixed, totalVar, left), categories: planCategories },
    { key: 'actual', title: flowPeriod === 'avg' ? 'חודש ממוצע' : 'ביצוע', sub: actualCard.sub, income: actualCard.income, expenses: actualCard.expenses, flow: actualCard.flow, flowNoSavings: actualCard.flow + actualCard.savings, breakdown: breakdownOf(actualCard.fixed, actualCard.variable, actualCard.flow), categories: flowPeriod === 'avg' ? null : actualCategories }
  ];
  const [years, setYears] = useState(5);
  const [breakdownBy, setBreakdownBy] = useState('type');

  function addRow(setter, name = '', extra = {}) { autoSaveRequested.current = false; setter(prev => [...prev, { ...trackRow({ name, amount: '', ...extra }), _before: {} }]); }
  function updateRow(setter, i, patch) {
    autoSaveRequested.current = Object.values(patch).some(value => String(value).trim() !== '');
    setter(prev => prev.map((r, idx) => idx === i ? { ...r, ...(patch.name !== undefined && isSavingsRow(r) ? { savings: true } : {}), ...patch } : r));
  }
  function removeRow(setter, i) {
    autoSaveRequested.current = true;
    if (setter !== setIncomes) {
      const row = (setter === setFixed ? fixed : variable)[i];
      setRowActualEdits(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== String(row._key))));
    }
    setter(prev => prev.filter((_, idx) => idx !== i));
  }

  function pickSuggestion(setter, list, name) {
    if (list.some(r => sameCategory(r.name, name))) { toast('כבר ברשימה', 'info'); return; }
    addRow(setter, name);
  }

  async function finish(automatic = false) {
    if (saveInFlight.current) return false;
    autoSaveRequested.current = false;
    const invalid = message => {
      setSaveProblem(message);
      setSaveStatus('invalid');
      if (!automatic) toast(message, 'error');
    };
    const baseline = JSON.parse(savedDraft);
    const submittedDraft = JSON.parse(draftSignature);
    const incomeChanged = JSON.stringify(submittedDraft.incomes) !== JSON.stringify(baseline.incomes);
    const amountOnly = automatic && JSON.stringify(fixed.map(row => row.name)) === JSON.stringify(baseline.fixed.map(row => row[0])) && JSON.stringify(variable.map(row => row.name)) === JSON.stringify(baseline.variable.map(row => row[0]));
    const changedFixed = fixed.filter((row, index) => String(row.amount ?? '') !== baseline.fixed[index]?.[1]);
    const changedVariable = variable.filter((row, index) => String(row.amount ?? '') !== baseline.variable[index]?.[1]);
    const fields = [...fixed, ...variable, ...incomes];
    if (fields.some(row => !row.name.trim() && Number(row.amount) > 0)) { invalid('יש לתת שם לקטגוריה לפני שמירת הסכום.'); return false; }
    if (fields.some(row => row.amount !== '' && (!Number.isFinite(Number(row.amount)) || Number(row.amount) < 0)) || Object.values(actualEdits).some(value => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      invalid('יש להזין סכום תקין שאינו שלילי.');
      return false;
    }
    if (fields.some(row => row.amount === '' && (row._before?.name !== row.name || String(row._before?.amount ?? '') !== ''))) {
      invalid('יש להשלים את הסכום בשורה ששונתה. להזנת סכום אפס כתוב 0.');
      return false;
    }
    const cleanIncomes = incomes.filter(r => r.name.trim() && String(r.amount).trim() !== '' && Number.isFinite(Number(r.amount)) && Number(r.amount) >= 0)
      .map(r => ({ name: r.name.trim(), amount: parseFloat(r.amount), day: parseInt(r.day, 10) || undefined }));
    const cleanFixed = fixed.filter(r => r.name.trim() && parseFloat(r.amount) > 0)
      .map(r => ({ id: r.name.trim(), amount: parseFloat(r.amount), ...(r.savings ? { savings: true } : {}) }));
    const cleanVar = variable.filter(r => r.name.trim() && parseFloat(r.amount) > 0);

    const incomeNames = new Set();
    const duplicateIncome = cleanIncomes.find(row => {
      const name = row.name.toLowerCase();
      if (incomeNames.has(name)) return true;
      incomeNames.add(name);
      return false;
    });
    if (duplicateIncome && (incomeChanged || !amountOnly)) { invalid('מקור הכנסה כפול: ' + duplicateIncome.name + '. יש לתת שם שונה לכל מקור.'); return false; }
    const categoryNames = new Set();
    const duplicateCategory = [...fixed, ...variable].map(row => row.name.trim()).filter(Boolean).find(name => {
      const key = name.toLowerCase();
      if (categoryNames.has(key)) return true;
      categoryNames.add(key);
      return false;
    });
    if (duplicateCategory) { invalid('קטגוריה כפולה: ' + duplicateCategory + '. יש להשאיר שורה אחת לכל קטגוריה.'); return false; }



    if (Object.hasOwn(actualEdits, '')) { invalid('יש לתת שם לקטגוריה לפני שמירת הביצוע.'); return false; }

    const belowRecorded = Object.entries(actualEdits).find(([name, value]) => (parseFloat(value) || 0) < ((fixedNameSet.has(name) ? fixedActual[name] : variableActualBase[name]) || 0));
    if (belowRecorded) {
      invalid('לא ניתן להקטין ביצוע מתחת לסכום שכבר נרשם. יש לערוך או למחוק את העסקאות בתזרים.');
      if (!automatic) wizardRef.current?.querySelector('input[aria-invalid="true"]')?.focus();
      return false;
    }

    const today = new Date();
    const adjustmentDate = `${monthKeyOf(year, month)}-${year === today.getFullYear() && month === today.getMonth() ? String(today.getDate()).padStart(2, '0') : '01'}`;
    const adjustments = Object.entries(actualEdits)
      .map(([cat, v]) => ({ cat, delta: (parseFloat(v) || 0) - ((fixedNameSet.has(cat) ? fixedActual[cat] : variableActualBase[cat]) || 0) }))
      .filter(a => a.delta > 0)
      .map((a, i) => ({ id: 'adj' + Date.now() + '_' + i, type: savingsNames.has(a.cat) ? 'saving' : 'expense', cat: a.cat, desc: 'התאמת ביצוע (אשף תקציב)', amount: Math.round(a.delta * 100) / 100, date: adjustmentDate, recurring: false }));

    retryAutoSave.current = automatic;
    saveInFlight.current = true;
    setSaveProblem('');
    setSaving(true);
    setSaveStatus('saving');
    const ok = await save(cur => {
      if (amountOnly) {
        const nextBudgets = { ...(cur.budgets || {}) };
        [...changedFixed, ...changedVariable].forEach(row => {
          const amount = Number(row.amount) || 0;
          if (amount > 0) nextBudgets[row.name.trim()] = amount;
          else delete nextBudgets[row.name.trim()];
        });
        let nextFixed = [...(cur.fixed_expenses || [])];
        changedFixed.forEach(row => {
          const name = row.name.trim(), prior = nextFixed.find(item => item.id === name);
          nextFixed = nextFixed.filter(item => item.id !== name);
          if (Number(row.amount) > 0) nextFixed.push({ ...prior, id: name, amount: Number(row.amount), ...(isSavingsRow(row) ? { savings: true } : {}) });
        });
        return {
          budgets: nextBudgets,
          ...(incomeChanged ? { settings: { ...(cur.settings || {}), ...incomeSourcePatch(cur.settings, cleanIncomes, year, month) } } : {}),
          ...(changedFixed.length ? { fixed_expenses: nextFixed } : {}),
          ...(adjustments.length ? { transactions: [...adjustments, ...(cur.transactions || [])] } : {})
        };
      }
      const nextBudgets = { ...(cur.budgets || {}) };
      Object.keys(categoryRenames).forEach(name => { delete nextBudgets[name]; });
      Object.keys(nextBudgets).forEach(c => { if (!FIXED_CATS.includes(c)) delete nextBudgets[c]; });
      // keep the Budget tab's per-category budgets in sync with this fixed-expenses list,
      // so the two screens don't show different numbers for the same fixed category
      (cur.fixed_expenses || []).forEach(f => { if (!cleanFixed.some(r => r.id === f.id)) delete nextBudgets[f.id]; });
      cleanFixed.forEach(r => { nextBudgets[r.id] = r.amount; });
      cleanVar.forEach(r => { nextBudgets[r.name.trim()] = parseFloat(r.amount); });
      return {
        settings: {
          ...(cur.settings || {}),
          customCats: [...new Set([...(cur.settings?.customCats || []).map(name => categoryRenames[name] || name), ...cleanVar.map(row => row.name.trim()).filter(name => !budgetCatsFor(mode).includes(name))])],
          customFixedCats: [...new Set([...(cur.settings?.customFixedCats || []).map(name => categoryRenames[name] || name), ...cleanFixed.map(row => row.id).filter(name => !FIXED_CATS.includes(name))])],
          ...(incomeChanged || !automatic || cleanIncomes.length ? incomeSourcePatch(cur.settings, cleanIncomes, year, month) : {})
        },
        fixed_expenses: cleanFixed,
        budgets: nextBudgets,
        ...(adjustments.length || Object.keys(categoryRenames).length ? { transactions: [...adjustments, ...renameExpenseCategories(cur.transactions, categoryRenames)] } : {})
      };
    });
    saveInFlight.current = false;
    setSaving(false);
    setSaveStatus(ok === false ? 'error' : 'saved');
    if (ok === false) return false;
    flushSync(() => {
    setSavedDraft(JSON.stringify({ ...(amountOnly ? { ...baseline, incomes: incomeChanged ? submittedDraft.incomes : baseline.incomes, fixed: submittedDraft.fixed, variable: submittedDraft.variable } : JSON.parse(draftSignature)), actualEdits: {} }));
    if (!amountOnly || incomeChanged) setIncomes(rows => rows.map(row => { const submitted = incomes.find(item => item._key === row._key); return submitted && row.name === submitted.name && row.amount === submitted.amount && row.day === submitted.day ? trackRow(row) : row; }));
    setFixed(rows => rows.map(row => { const submitted = fixed.find(item => item._key === row._key); return submitted && row.name === submitted.name && row.amount === submitted.amount && row.day === submitted.day ? trackRow(row) : row; }));
    setVariable(rows => rows.map(row => { const submitted = variable.find(item => item._key === row._key); return submitted && row.name === submitted.name && row.amount === submitted.amount && row.day === submitted.day ? trackRow(row) : row; }));
    setRowActualEdits(current => Object.fromEntries(Object.entries(current).filter(([key, value]) => value !== rowActualEdits[key])));
    });
    if (!automatic) toast('התקציב נשמר ועבר לאפליקציה של הלקוח', 'success');
    return true;
  }

  function requestSave(automatic = false) {
    if (activeSave.current) return activeSave.current;
    const pending = finish(automatic).catch(() => {
      saveInFlight.current = false;
      setSaving(false);
      setSaveStatus('error');
      return false;
    }).finally(() => { if (activeSave.current === pending) activeSave.current = null; });
    activeSave.current = pending;
    return pending;
  }
  useLayoutEffect(() => {
    autoSaveAction.current = () => requestSave(true);
    flushDraft.current = async () => {
      autoSaveRequested.current = false;
      if (activeSave.current) {
        if (await activeSave.current === false) return false;
        return flushDraft.current();
      }
      if (!dirty) return true;
      if (await requestSave(true) === false) return false;
      return flushDraft.current();
    };
  });
  useEffect(() => {
    const beforeNavigate = event => event.detail.pending.push(flushDraft.current());
    window.addEventListener('budget:before-navigate', beforeNavigate);
    return () => window.removeEventListener('budget:before-navigate', beforeNavigate);
  }, []);
  useEffect(() => {
    if (!dirty || saving || !autoSaveRequested.current) return;
    const timer = setTimeout(() => {
      if (autoSaveRequested.current) autoSaveAction.current?.();
    }, 700);
    return () => clearTimeout(timer);
  }, [draftSignature, dirty, saving]);

  function breakdownOf(fixedValue, varValue, freeValue) {
    const items = [
      { label: 'הוצאות קבועות', value: fixedValue, color: CHART_PALETTE[0] },
      { label: 'תקציב משתנה', value: varValue, color: CHART_PALETTE[1] },
      { label: 'נותר פנוי', value: Math.max(0, freeValue), color: CHART_PALETTE[5] }
    ].filter(b => b.value > 0);
    return { items, total: items.reduce((sum, b) => sum + b.value, 0) || 1 };
  }

  function categoryBreakdown(categories, freeValue) {
    const sorted = categories.filter(c => c.value > 0).sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6).reduce((sum, c) => sum + c.value, 0);
    const items = [
      ...top.map((c, i) => ({ label: c.label, value: c.value, color: CHART_PALETTE[i % CHART_PALETTE.length] })),
      ...(rest > 0 ? [{ label: 'אחר', value: rest, color: CHART_PALETTE[6 % CHART_PALETTE.length] }] : []),
      ...(freeValue > 0 ? [{ label: 'נותר פנוי', value: freeValue, color: CHART_PALETTE[5] }] : [])
    ];
    return { items, total: items.reduce((sum, b) => sum + b.value, 0) || 1 };
  }

  function transactionDetails(name, income = false) {
    const matches = transaction => income
      ? transaction.type === 'income' && (transaction.desc || '').trim().toLowerCase() === name.trim().toLowerCase()
      : (transaction.type === 'expense' || transaction.type === 'saving') && (categoryRenames[transaction.cat] || transaction.cat) === name;
    const count = getMonthTx(data?.transactions, year, month).filter(matches).length;
    return (
      <details className={styles.transactionDetails} data-budget-transactions>
        <summary aria-label={'עסקאות הביצוע · ' + (name || 'שורה חדשה')}>עסקאות הביצוע · {count}</summary>
        <div className={styles.transactionPanel}>
          <p className={styles.incomeHint}>העסקאות שנרשמו בחודש הנבחר עבור {name}. שינויים בביצוע שטרם נשמרו אינם כלולים.</p>
          <MonthTransactions data={data} save={save} mode={mode} year={year} month={month} transactionFilter={matches} embedded />
        </div>
      </details>
    );
  }

  function tableList(list, setter, placeholder, actualOf, editableActual = false, rowFilter = () => true, newRow = {}) {
    return (
      <>
        <div className={styles.tbl}>
          <div className={styles.tblHead}>
            <span>קטגוריה</span>
            <span>תקציב</span>
            <span>ביצוע</span>
            <span />
          </div>
          {list.map((r, i) => rowFilter(r) && ((() => {
            const actual = rowActualEdits[r._key] ?? (actualOf(r.name.trim(), r.amount) || 0);
            const over = (parseFloat(actual) || 0) > (parseFloat(r.amount) || 0);
            const recorded = (fixedNameSet.has(r.name.trim()) ? fixedActual[r.name.trim()] : variableActualBase[r.name.trim()]) || 0;
            const belowRecorded = (parseFloat(actual) || 0) < recorded;
            const errorId = 'budget-actual-' + encodeURIComponent(r.name);
            return (
              <div className={styles.tblRow + (r.name === focusCategory ? ' ' + styles.categoryFocused : '')} data-budget-category={r.name} key={r._key}>
                <div className={styles.tblName}>
                  <span className={styles.itemIcon} aria-hidden="true">{getCategoryIcon(r.name)}</span>
                  <input
                    className={styles.itemName}
                    aria-label="שם"
                    onBlur={() => { if (r.name !== r.name.trim()) updateRow(setter, i, { name: r.name.trim() }); }}
                    readOnly={!!data?.fixed_expenses?.find(item => item.id === (r._before?.name || r.name))?.linkedSource}
                    title={data?.fixed_expenses?.find(item => item.id === (r._before?.name || r.name))?.linkedSource ? 'שם ההוצאה מסונכרן מהמקור שלה' : undefined}
                    placeholder={placeholder}
                    data-changed={String(r.name ?? '') !== String(r._before?.name ?? '')}
                    value={r.name}
                    onChange={e => updateRow(setter, i, { name: e.target.value })}
                  />
                  {data?.fixed_expenses?.find(item => item.id === (r._before?.name || r.name))?.linkedSource && <button type="button" onClick={() => onEditLinkedExpense?.(data.fixed_expenses.find(item => item.id === (r._before?.name || r.name)).linkedSource)}>עריכה במקור</button>}
                </div>
                <div className={styles.formattedAmount + " " + styles.tableAmount}>
                <input
                  className={styles.tblInput}
                  type="number"
                  inputMode="decimal"
                    onWheel={event => event.currentTarget.blur()}
                    onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault(); }}
                  readOnly={!!data?.fixed_expenses?.find(item => item.id === (r._before?.name || r.name))?.linkedSource}
                  title={data?.fixed_expenses?.find(item => item.id === (r._before?.name || r.name))?.linkedSource ? 'הסכום מסונכרן מהמקור. לעריכה פתח את מקור ההוצאה.' : undefined}
                  aria-label={'תקציב · ' + (r.name || 'שורה חדשה')}
                  placeholder="0"
                  data-changed={String(r.amount ?? '') !== String(r._before?.amount ?? '')}
                  value={r.amount}
                  onChange={e => updateRow(setter, i, { amount: e.target.value })}
                />
                  <span className={styles.amountPreview} aria-hidden="true">{fmt(Number(r.amount) || 0)}</span>
                </div>
                {editableActual ? (
                  <div className={styles.formattedAmount + " " + styles.tableAmount + (over ? " " + styles.tblOverText : "")}>
                  <input
                    className={styles.tblInput + (over ? ' ' + styles.tblOver : '')}
                    type="number"
                    inputMode="decimal"
                    onWheel={event => event.currentTarget.blur()}
                    onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault(); }}
                    aria-invalid={belowRecorded || undefined}
                    aria-describedby={belowRecorded ? errorId : undefined}
                    min={(fixedNameSet.has(r.name.trim()) ? fixedActual[r.name.trim()] : variableActualBase[r.name.trim()]) || 0}
                    aria-label={'ביצוע · ' + (r.name || 'שורה חדשה')}
                    placeholder="0"
                    data-changed={rowActualEdits[r._key] !== undefined && String(rowActualEdits[r._key]) !== String((actualOf(r.name.trim(), r.amount) || ''))}
                    value={rowActualEdits[r._key] ?? (actualOf(r.name.trim(), r.amount) || '')}
                    onChange={e => { autoSaveRequested.current = e.target.value !== ''; setRowActualEdits(prev => ({ ...prev, [r._key]: e.target.value })); }}
                  />
                    <span className={styles.amountPreview} aria-hidden="true">{fmt(Number(actual) || 0)}</span>
                  </div>
                ) : (
                  <div className={styles.tblValue + (over ? ' ' + styles.tblOverText : '')}>{fmt(actual)}</div>
                )}
                <DeleteButton title={`מחק · ${r.name || 'שורה'}`} onClick={() => removeRow(setter, i)} />
                {belowRecorded && <p className={styles.actualError} id={errorId} role="alert">כבר נרשמו {fmt(recorded)}. להקטנת הביצוע יש לערוך או למחוק את העסקאות בתזרים.</p>}
                {transactionDetails(r.name.trim())}
              </div>
            );
          })()))}
        </div>
        <Button variant="ghost" onClick={() => addRow(setter, '', newRow)}>{editableActual && list === variable ? '+ קטגוריה' : '+ הוסף שורה'}</Button>
      </>
    );
  }

  function rowList(list, setter, placeholder, suggestions, actualOf, compact = false, dayField = false, editableActual = false) {
    const dayBox = (r, i) => dayField && (
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
          data-changed={String(r.day ?? '') !== String(r._before?.day ?? '')}
          value={r.day || ''}
          onChange={e => updateRow(setter, i, { day: e.target.value })}
        />
      </div>
    );

    const amounts = (r, i) => (
      <>
        <div className={styles.itemAmountBox}>
          <div className={styles.itemAmountBoxLabel}>{actualOf ? 'תכנון' : 'סכום'}</div>
          <div className={styles.formattedAmount}>
          <input
            className={styles.itemAmountInput}
            type="number"
            inputMode="decimal"
                    onWheel={event => event.currentTarget.blur()}
                    onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault(); }}
            aria-label={actualOf ? 'תכנון הכנסה · ' + (r.name || 'מקור חדש') : 'סכום חודשי'}
            placeholder="0"
            data-changed={String(r.amount ?? '') !== String(r._before?.amount ?? '')}
                  value={r.amount}
            onChange={e => updateRow(setter, i, { amount: e.target.value })}
          />
          <span className={styles.amountPreview} aria-hidden="true">{fmt(Number(r.amount) || 0)}</span>
          </div>
        </div>
        {actualOf && (
          <div className={styles.itemActualBox}>
            <div className={styles.itemAmountBoxLabel}>ביצוע</div>
            {editableActual ? (
              <input
                className={styles.itemAmountInput}
                type="number"
                inputMode="decimal"
                    onWheel={event => event.currentTarget.blur()}
                    onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') event.preventDefault(); }}
                min={(fixedNameSet.has(r.name.trim()) ? fixedActual[r.name.trim()] : variableActualBase[r.name.trim()]) || 0}
                aria-label="ביצוע בפועל"
                data-changed={rowActualEdits[r._key] !== undefined && String(rowActualEdits[r._key]) !== String((actualOf(r.name.trim(), r.amount) || ''))}
                    value={rowActualEdits[r._key] ?? (actualOf(r.name.trim(), r.amount) || '')}
                placeholder="0"
                onChange={e => { autoSaveRequested.current = e.target.value !== ''; setRowActualEdits(prev => ({ ...prev, [r._key]: e.target.value })); }}
              />
            ) : (
              <output className={styles.itemActualValue} aria-label={'ביצוע הכנסה · ' + (r.name || 'מקור חדש')}>{fmt(actualOf(r.name.trim(), r.amount, i))}</output>
            )}
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
            <div className={styles.itemCard} key={r._key}>
              <div className={styles.itemCardHead}>
                <span className={styles.itemIcon} aria-hidden="true">{getCategoryIcon(r.name)}</span>
                <input
                  className={styles.itemName}
                  aria-label="שם"
                  placeholder={placeholder}
                  data-changed={String(r.name ?? '') !== String(r._before?.name ?? '')}
                    value={r.name}
                  onChange={e => updateRow(setter, i, { name: e.target.value })}
                />
                <DeleteButton title={`מחק · ${r.name || 'שורה'}`} onClick={() => removeRow(setter, i)} />
              </div>
              <div className={styles.itemCardAmounts}>{dayBox(r, i)}{amounts(r, i)}</div>
              {actualOf && transactionDetails(r.name, true)}
            </div>
          ) : (
            <div className={styles.itemRow} key={r._key}>
              <span className={styles.itemIcon} aria-hidden="true">{getCategoryIcon(r.name)}</span>
              <input
                className={styles.itemName}
                aria-label="שם"
                placeholder={placeholder}
                data-changed={String(r.name ?? '') !== String(r._before?.name ?? '')}
                    value={r.name}
                onChange={e => updateRow(setter, i, { name: e.target.value })}
              />
              {dayBox(r, i)}
              {amounts(r, i)}
              <DeleteButton title={`מחק · ${r.name || 'שורה'}`} onClick={() => removeRow(setter, i)} />
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={() => addRow(setter)}>+ הוסף שורה</Button>
      </>
    );
  }

  return (
    <div ref={wizardRef} className={styles.wrap} onChangeCapture={event => { if (!saving && !event.target.closest('[data-budget-transactions]')) setSaveStatus('dirty'); }}>
      <p className={styles.changeHint}>הנתונים בתקציב, כולל ההכנסות, נשמרים אוטומטית לאחר ההקלדה. שדות ששונו מסומנים עד לשמירה מוצלחת.</p>
      {left < 0 && <div className={styles.warn}>ההקצאה חורגת מההכנסות ב-{fmt(Math.abs(left))} לחודש</div>}

      <div className={styles.body}>
          {period == null && <div className={styles.viewPills} role="group" aria-label="תצוגת תקופה">
            <button type="button" aria-pressed={flowPeriod === 'month'} className={flowPeriod === 'month' ? styles.viewPillOn : styles.viewPill} onClick={() => setFlowPeriod('month')}>חודשי</button>
            <button type="button" aria-pressed={flowPeriod === 'year'} className={flowPeriod === 'year' ? styles.viewPillOn : styles.viewPill} onClick={() => setFlowPeriod('year')}>שנתי</button>
          </div>}
          {flowPeriod === 'long' && (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <span className={styles.cardTitle}>תכנון ארוך טווח</span>
                <div className={styles.flowToggle} role="group" aria-label="מספר שנים">
                  {[1, 3, 5, 10].map(y => <button key={y} type="button" aria-pressed={years === y} className={years === y ? styles.flowToggleActive : ''} onClick={() => setYears(y)}>{y === 1 ? 'שנה' : `${y} שנים`}</button>)}
                </div>
              </div>
              <div className={styles.flowLine}><span>הכנסות מצטברות</span><span>{fmt(totalIncome * 12 * years)}</span></div>
              <div className={styles.flowLine}><span>הוצאות מצטברות</span><span>{fmt((totalFixed + totalVar) * 12 * years)}</span></div>
              <div className={styles.flowLine}><span>נותר בחשבון</span><span className={left < 0 ? styles.negative : styles.positive}>{fmt(left * 12 * years)}</span></div>
              <div className={styles.flowLine}><span>חיסכון שנצבר</span><span className={styles.positive}>{fmt(plannedSavings * 12 * years)}</span></div>
              <div className={styles.summaryNote}>הקרנה לפי התכנון החודשי הנוכחי, ללא ריבית ושינויים לאורך זמן.</div>
            </div>
          )}
          <div className={styles.summarySection} style={flowPeriod === 'long' ? { display: 'none' } : undefined}>
            <div className={styles.sumGrid}>
              {summaryCards.map(c => (
                <div className={styles.sumCard} key={c.key}>
                  <div className={styles.sumTitle}>{c.title}</div>
                  <div className={styles.sumSub}>{c.sub}</div>
                  <div className={styles.summaryChart} role="img" aria-label={`${c.title}: הכנסות ${fmt(c.income * periodMul)}, הוצאות ${fmt(c.expenses * periodMul)}`}>
                    <Bar aria-hidden="true" data={chartDataOf(c.income * periodMul, c.expenses * periodMul)} plugins={[topLabels]} options={summaryChartOptions} />
                  </div>
                  <div className={styles.flowBox}>
                    <div className={styles.flowBoxHead}>
                      <span className={styles.flowBoxTitle}>תזרים</span>
                      <div className={styles.flowToggle} role="group" aria-label={`תקופה · ${c.title}`}>
                        <button type="button" aria-pressed={flowPeriod === 'month'} className={flowPeriod === 'month' ? styles.flowToggleActive : ''} onClick={() => setFlowPeriod('month')}>חודשי</button>
                        <button type="button" aria-pressed={flowPeriod === 'year'} className={flowPeriod === 'year' ? styles.flowToggleActive : ''} onClick={() => setFlowPeriod('year')}>שנתי</button>
                      </div>
                    </div>
                    <div className={styles.flowLine}>
                      <span>בחשבון</span>
                      <span className={c.flow < 0 ? styles.negative : styles.positive}>{fmt(c.flow * periodMul)}</span>
                    </div>
                    <div className={styles.flowLine}>
                      <span>בלי חיסכון</span>
                      <span className={c.flowNoSavings < 0 ? styles.negative : styles.positive}>{fmt(c.flowNoSavings * periodMul)}</span>
                    </div>
                  </div>
                  {c.breakdown.items.length > 0 && (() => {
                    const shown = breakdownBy === 'category' && c.categories ? categoryBreakdown(c.categories, c.flow) : c.breakdown;
                    return (
                    <div className={styles.breakdownBlock}>
                      <div className={styles.flowBoxHead}>
                        <div className={styles.groupTitle}>לאן הולך הכסף</div>
                        {c.categories && (
                          <div className={styles.flowToggle} role="group" aria-label={`חלוקה · ${c.title}`}>
                            <button type="button" aria-pressed={breakdownBy === 'type'} className={breakdownBy === 'type' ? styles.flowToggleActive : ''} onClick={() => setBreakdownBy('type')}>לפי סוג</button>
                            <button type="button" aria-pressed={breakdownBy === 'category'} className={breakdownBy === 'category' ? styles.flowToggleActive : ''} onClick={() => setBreakdownBy('category')}>לפי קטגוריה</button>
                          </div>
                        )}
                      </div>
                      <div className={styles.stackBar}>
                        {shown.items.map(b => (
                          <div key={b.label} className={styles.stackSeg} style={{ width: (b.value / shown.total * 100) + '%', background: b.color }} title={b.label} />
                        ))}
                      </div>
                      <div className={styles.legend}>
                        {shown.items.map(b => (
                          <div className={styles.legendRow} key={b.label}>
                            <span className={styles.legendDot} style={{ background: b.color }} />
                            <span className={styles.legendLabel}>{b.label}</span>
                            <span className={styles.legendValue}>{fmt(b.value * periodMul)}</span>
                            <span className={styles.pctChip}>{Math.round(b.value / shown.total * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            <div className={styles.summaryNote}>השמירה תעדכן את התקציב, ההוצאות הקבועות ומקורות ההכנסה באפליקציה של הלקוח.</div>
          </div>

          <div className={styles.expGrid}>
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <span className={styles.cardTitle}>מאיפה מגיע הכסף?</span>
                <div className={styles.incomeTotals}><span>תכנון <bdi>{fmt(totalIncome)}</bdi></span><span>ביצוע <bdi>{fmt(totalIncomeActual)}</bdi></span></div>
              </div>
              {rowList(incomes, setIncomes, 'שם מקור ההכנסה', [], (_name, _amount, index) => incomeActual.amounts[index], true)}
              <p className={styles.incomeHint}>הביצוע מחושב מההכנסות שנרשמו בחודש הנבחר.</p>
              {incomeActual.unmatched !== 0 && <p className={styles.incomeHint}>הכנסות בפועל ללא שיוך למקורות האלה: <bdi>{fmt(incomeActual.unmatched)}</bdi></p>}
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <span className={styles.cardTitle}>חסכונות והשקעות</span>
                <span className={styles.cardTotal}>{fmt(totalSavings)}</span>
              </div>
              {tableList(fixed, setFixed, 'שם החיסכון', name => fixedActual[name] || 0, true, isSavingsRow, { savings: true })}
            </div>
          </div>

          <div className={styles.expGrid}>
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <span className={styles.cardTitle}>הוצאות חודשיות קבועות</span>
                <span className={styles.cardTotal}>{fmt(totalFixed - totalSavings)}</span>
              </div>
              {tableList(fixed, setFixed, 'שם ההוצאה הקבועה', name => fixedActual[name] || 0, true, r => !isSavingsRow(r))}
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <span className={styles.cardTitle}>הוצאות חודשיות משתנות</span>
                <span className={styles.cardTotal}>{fmt(totalVar)}</span>
              </div>
              {tableList(variable, setVariable, 'שם הקטגוריה', name => variableActual[name] || 0, true)}
            </div>
          </div>
      </div>

      <div className={styles.saveStatus} data-status={saveStatus} role="status" aria-live="polite" aria-atomic="true" hidden={saveStatus === 'idle'}>
        {{invalid: saveProblem, dirty: 'יש שינויים שטרם נשמרו', saving: 'שומר את התקציב…', saved: 'התקציב נשמר בהצלחה', error: 'התקציב לא נשמר. השינויים עדיין בטופס — נסה לשמור שוב.'}[saveStatus]}
      </div>
      <div className={styles.footer}>
        <Button onClick={() => requestSave(saveStatus === 'error' && retryAutoSave.current)} disabled={saving}>{saving ? 'שומר…' : 'שמור ושלח ללקוח'}</Button>
      </div>
    </div>
  );
}
