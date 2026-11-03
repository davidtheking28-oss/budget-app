import { FIXED_KEYS } from './mappingTemplates.js';

const SAVINGS_CATEGORY = 'הוראת קבע לחסכון';

export const MANUAL_PERIOD_MONTHS = 3;

// The mapping covers the last three months, so an amount typed by hand into a variable
// expense category is the total for that period and counts as a third of it per month.
function isPeriodTotal(t) {
  return t.manual && !t.auto && t.category !== SAVINGS_CATEGORY && !FIXED_KEYS.includes(t.category);
}

export function manualMonthly(t) {
  const amount = Number(t.amount) || 0;
  return isPeriodTotal(t) ? amount / MANUAL_PERIOD_MONTHS : amount;
}

const CARD_CHARGE = /כרטיס אשראי|ישראכרט|לאומי קארד|דיינרס|אמריקן אקספרס|חיוב\s+(ויזה|כאל|מקס)|visa cal|isracard|max it/i;

export function looksLikeCardCharge(t) {
  return t.type !== 'income' && CARD_CHARGE.test(String(t.desc || ''));
}

function statementMonthCount(allTransactions) {
  return new Set(allTransactions.filter(t => !t.manual).map(t => t.source_month)).size || 1;
}

export function computeCategoryAverages(allTransactions) {
  const transactions = allTransactions.filter(t => !t.excluded);
  const monthCount = statementMonthCount(allTransactions);
  const totals = {};
  for (const t of transactions) {
    if (t.type === 'income') continue;
    totals[t.category] = (totals[t.category] || 0) + (t.manual ? manualMonthly(t) * monthCount : (Number(t.amount) || 0));
  }
  const averages = {};
  for (const cat of Object.keys(totals)) averages[cat] = totals[cat] / monthCount;
  return { averages, monthsCovered: monthCount };
}

// The "מיפוי" only ever captured expenses. Older saved rows have no `type` on
// their transactions at all — treat those as expense so this keeps working for
// mappings uploaded before income capture existed.
const isIncome = t => t.type === 'income';
const isExpense = t => t.type !== 'income';
const isSavingsTransfer = t => isExpense(t) && t.category === SAVINGS_CATEGORY;

export function computeCashflowSummary(allTransactions) {
  const transactions = allTransactions.filter(t => !t.excluded);
  const monthCount = statementMonthCount(allTransactions);

  const sum = list => list.reduce((s, t) => s + (t.manual ? manualMonthly(t) * monthCount : (Number(t.amount) || 0)), 0);

  const income = sum(transactions.filter(isIncome)) / monthCount;
  const expense = sum(transactions.filter(isExpense)) / monthCount;
  const savings = sum(transactions.filter(isSavingsTransfer)) / monthCount;

  return {
    monthsCovered: monthCount,
    income,
    expense,
    savings,
    netInAccount: income - expense,
    netExcludingSavings: income - expense + savings,
    hasIncomeData: transactions.some(isIncome)
  };
}

export function computeExpenseTypeBreakdown(averages) {
  let fixed = 0;
  let variable = 0;
  let savings = 0;
  for (const [category, value] of Object.entries(averages)) {
    if (category === SAVINGS_CATEGORY) savings += value;
    else if (FIXED_KEYS.includes(category)) fixed += value;
    else variable += value;
  }
  return [{ name: 'קבועות', value: fixed }, { name: 'משתנות', value: variable }, { name: 'חיסכון', value: savings }].filter(part => part.value !== 0);
}

export function computeMappingRows(allTransactions) {
  const transactions = allTransactions.filter(t => !t.excluded);
  const monthCount = statementMonthCount(allTransactions);
  const sums = { income: {}, expense: {} };
  for (const t of transactions) {
    if (t.manual) continue;
    const bucket = t.type === 'income' ? sums.income : sums.expense;
    bucket[t.category] = (bucket[t.category] || 0) + (Number(t.amount) || 0);
  }
  const rows = { income: [], expense: [] };
  for (const kind of ['income', 'expense']) {
    for (const [category, total] of Object.entries(sums[kind])) {
      if (total > 0) rows[kind].push({ key: 's:' + kind + ':' + category, category, amount: total / monthCount, manual: false });
    }
  }
  for (const t of transactions) {
    if (!t.manual) continue;
    rows[t.type === 'income' ? 'income' : 'expense'].push({ key: 'm:' + t.id, id: t.id, category: t.category, name: t.name, entries: t.entries, desc: t.desc, amount: manualMonthly(t), raw: Number(t.amount) || 0, manual: true, auto: !!t.auto });
  }
  return rows;
}

export function mortgageMappingAmount(data, transactions) {
  const scenario = data?.mortgage_scenario;
  if (!scenario || scenario.hidden) return 0;
  const recorded = transactions.some(t => !t.excluded && t.type !== 'income' && (t.category === 'משכנתא' || (/משכנת[אה]/.test(t.desc || '') && !/ביטוח/.test(t.desc || ''))));
  return recorded ? 0 : Math.max(0, Number(scenario.monthly) || 0);
}
