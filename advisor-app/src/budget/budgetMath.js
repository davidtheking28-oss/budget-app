import { getMonthTx } from './monthUtils.js';

export function monthSummary(data, year, month) {
  const monthTx = getMonthTx(data?.transactions, year, month);
  const incomeTx = monthTx.filter(t => t.type === 'income');
  const manualIncome = incomeTx.reduce((s, t) => s + t.amount, 0);
  const incomeSources = data?.settings?.incomeSources || [];
  const postedNames = new Set(incomeTx.map(t => (t.desc || '').toLowerCase()));
  const unpostedIncome = incomeSources
    .filter(src => !postedNames.has((src.name || '').toLowerCase()))
    .reduce((s, src) => s + (parseFloat(src.amount) || 0), 0);
  const income = manualIncome + unpostedIncome;
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
