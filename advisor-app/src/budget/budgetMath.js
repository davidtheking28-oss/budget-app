import { fixedCatsFor } from '../categories.js';
import { getMonthTx } from './monthUtils.js';

// Mirrors _budgetCarry in the client app (index.html): when the client has budget rollover
// enabled, an unused surplus carries into the next month and compounds, and the carry is
// computed off the previous month's EFFECTIVE limit so an overspend isn't charged twice.
// Without this the advisor flags "over budget" on clients who are actually within limit.
export function budgetCarry(data, cat, year, month) {
  const budgets = data?.budgets || {};
  if (!data?.settings?.budgetRollover || !budgets[cat]) return 0;
  const prior = [];
  let m = month, y = year;
  for (let i = 0; i < 24; i++) {
    if (m === 0) { m = 11; y--; } else { m--; }
    const mTx = getMonthTx(data?.transactions, y, m);
    if (!mTx.length) break;
    prior.unshift(mTx);
  }
  let carry = 0;
  prior.forEach(mTx => {
    const spent = mTx.filter(t => t.type === 'expense' && t.cat === cat).reduce((s, t) => s + t.amount, 0);
    carry = Math.max(0, budgets[cat] + carry) - spent;
  });
  return carry;
}

export function effectiveLimit(data, cat, year, month) {
  const base = (data?.budgets || {})[cat];
  if (!base) return 0;
  return Math.max(0, base + budgetCarry(data, cat, year, month));
}

export function monthKeyOf(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function incomeSourcesFor(settings, year, month) {
  const history = settings?.incomeHistory;
  if (!history) return settings?.incomeSources || [];
  const key = monthKeyOf(year, month);
  const keys = Object.keys(history).filter(k => k <= key).sort();
  return keys.length ? history[keys[keys.length - 1]] : (settings?.incomeSources || []);
}

export function incomeActualsBySource(transactions, sources) {
  const amounts = sources.map(() => 0);
  const indexes = new Map();
  sources.forEach((source, index) => {
    const name = (source.name || '').trim().toLowerCase();
    if (name && !indexes.has(name)) indexes.set(name, index);
  });
  let unmatched = 0;
  (transactions || []).filter(row => row.type === 'income').forEach(row => {
    const index = indexes.get((row.desc || '').trim().toLowerCase());
    const amount = parseFloat(row.amount) || 0;
    if (index === undefined) unmatched += amount;
    else amounts[index] += amount;
  });
  return { amounts, unmatched };
}

export function effectiveIncome(transactions, incomeSources) {
  const incomeTx = (transactions || []).filter(t => t.type === 'income');
  const manualIncome = incomeTx.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const postedNames = new Set(incomeTx.map(t => (t.desc || '').trim().toLowerCase()));
  const unpostedIncome = (incomeSources || [])
    .filter(src => !postedNames.has((src.name || '').trim().toLowerCase()))
    .reduce((s, src) => s + (parseFloat(src.amount) || 0), 0);
  return { manualIncome, unpostedIncome, income: manualIncome + unpostedIncome };
}

export function monthSummary(data, year, month) {
  const monthTx = getMonthTx(data?.transactions, year, month);
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  const { income } = !isCurrent && !monthTx.length ? { income: 0 } : effectiveIncome(monthTx, incomeSourcesFor(data?.settings, year, month));
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const budgets = data?.budgets || {};
  const spentByCat = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });
  // effective, not nominal: with rollover on, the client's real ceiling includes the carry,
  // otherwise projected-overrun warnings and the "remaining" chip fire on clients who are fine
  const totalBudget = Object.keys(budgets).reduce((s, c) => s + effectiveLimit(data, c, year, month), 0);
  const overCats = Object.keys(budgets)
    .filter(c => budgets[c])
    .map(c => ({ cat: c, limit: effectiveLimit(data, c, year, month), spent: spentByCat[c] || 0 }))
    .filter(x => x.spent > x.limit)
    .map(x => ({ ...x, over: x.spent - x.limit }));
  const remaining = totalBudget > 0 ? totalBudget - expense : null;
  return { income, expense, net: income - expense, totalBudget, spentByCat, overCats, remaining };
}


export function budgetActuals(data, transactions) {
  const fixedNames = new Set(fixedCatsFor(data));
  const savingsNames = new Set(['הוראת קבע לחסכון', ...(data?.fixed_expenses || []).filter(row => row.savings).map(row => row.id)]);
  const result = { income: 0, fixed: {}, variable: {}, savings: 0 };
  (transactions || []).forEach(transaction => {
    const amount = parseFloat(transaction.amount) || 0;
    if (transaction.type === 'income') result.income += amount;
    if (transaction.type !== 'expense' && transaction.type !== 'saving') return;
    const isSavings = transaction.type === 'saving' || savingsNames.has(transaction.cat);
    const bucket = fixedNames.has(transaction.cat) || isSavings ? result.fixed : result.variable;
    bucket[transaction.cat] = (bucket[transaction.cat] || 0) + amount;
    if (isSavings) result.savings += amount;
  });
  return result;
}

export function averageMonthSummary(data) {
  const transactions = (data?.transactions || []).filter(transaction => transaction.date);
  const months = new Set(transactions.map(transaction => transaction.date.slice(0, 7))).size;
  const mapped = (data?.fixed_expenses || []).filter(row => row.linkedSource);
  if (!months && !mapped.length) return null;
  const actual = budgetActuals(data, transactions);
  const fixed = Object.fromEntries(Object.entries(actual.fixed).map(([category, amount]) => [category, amount / (months || 1)]));
  mapped.forEach(row => { fixed[row.id] = Number(row.amount) || 0; });
  const sum = bucket => Object.values(bucket).reduce((total, amount) => total + amount, 0);
  return { months, income: actual.income / (months || 1), fixed: sum(fixed), variable: sum(actual.variable) / (months || 1), savings: actual.savings / (months || 1), ...(mapped.length ? { mappedFixed: true } : {}) };
}
