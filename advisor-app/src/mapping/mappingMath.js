const SAVINGS_CATEGORY = 'הוראת קבע לחסכון';

export function computeCategoryAverages(transactions) {
  const monthsPresent = new Set(transactions.map(t => t.source_month));
  const monthCount = monthsPresent.size || 1;
  const totals = {};
  for (const t of transactions) {
    if (t.type === 'income') continue;
    totals[t.category] = (totals[t.category] || 0) + (Number(t.amount) || 0);
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

export function computeCashflowSummary(transactions) {
  const monthsPresent = new Set(transactions.map(t => t.source_month));
  const monthCount = monthsPresent.size || 1;

  const sum = list => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);

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
