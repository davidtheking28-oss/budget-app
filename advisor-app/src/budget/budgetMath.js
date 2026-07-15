import { getMonthTx } from './monthUtils.js';

export function monthSummary(data, year, month) {
  const monthTx = getMonthTx(data?.transactions, year, month);
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const budgets = data?.budgets || {};
  const spentByCat = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });
  const totalBudget = Object.values(budgets).reduce((s, v) => s + (v || 0), 0);
  const overCats = Object.keys(budgets)
    .filter(c => budgets[c] && (spentByCat[c] || 0) > budgets[c])
    .map(c => ({ cat: c, limit: budgets[c], spent: spentByCat[c] || 0, over: (spentByCat[c] || 0) - budgets[c] }));
  const remaining = totalBudget > 0 ? totalBudget - expense : null;
  return { income, expense, net: income - expense, totalBudget, spentByCat, overCats, remaining };
}
