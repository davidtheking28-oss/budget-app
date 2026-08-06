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

export function effectiveIncome(transactions, incomeSources) {
  const incomeTx = (transactions || []).filter(t => t.type === 'income');
  const manualIncome = incomeTx.reduce((s, t) => s + t.amount, 0);
  const postedNames = new Set(incomeTx.map(t => (t.desc || '').toLowerCase()));
  const unpostedIncome = (incomeSources || [])
    .filter(src => !postedNames.has((src.name || '').toLowerCase()))
    .reduce((s, src) => s + (parseFloat(src.amount) || 0), 0);
  return { manualIncome, unpostedIncome, income: manualIncome + unpostedIncome };
}

export function monthSummary(data, year, month) {
  const monthTx = getMonthTx(data?.transactions, year, month);
  const { income } = effectiveIncome(monthTx, data?.settings?.incomeSources);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const budgets = data?.budgets || {};
  const spentByCat = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });
  const totalBudget = Object.values(budgets).reduce((s, v) => s + (v || 0), 0);
  const overCats = Object.keys(budgets)
    .filter(c => budgets[c])
    .map(c => ({ cat: c, limit: effectiveLimit(data, c, year, month), spent: spentByCat[c] || 0 }))
    .filter(x => x.spent > x.limit)
    .map(x => ({ ...x, over: x.spent - x.limit }));
  const remaining = totalBudget > 0 ? totalBudget - expense : null;
  return { income, expense, net: income - expense, totalBudget, spentByCat, overCats, remaining };
}
