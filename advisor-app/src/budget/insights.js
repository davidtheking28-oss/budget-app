import { getMonthTx } from './monthUtils.js';
import { monthSummary } from './budgetMath.js';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export function computeInsights(data, year, month) {
  const insights = [];
  const summary = monthSummary(data, year, month);

  summary.overCats.forEach(o => {
    insights.push({ kind: 'danger', text: `חריגה בקטגוריית ${o.cat} — ${fmt(o.over)} מעבר לתקציב` });
  });

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  if (isCurrentMonth && now.getDate() > 5 && summary.income === 0) {
    insights.push({ kind: 'warn', text: 'אין הכנסה רשומה החודש' });
  }

  const priorMonths = [1, 2, 3].map(back => {
    const d = new Date(year, month - back, 1);
    return getMonthTx(data?.transactions, d.getFullYear(), d.getMonth()).filter(t => t.type === 'expense');
  });
  Object.keys(summary.spentByCat).forEach(cat => {
    const priorAvg = priorMonths.reduce((s, txs) => s + txs.filter(t => t.cat === cat).reduce((s2, t) => s2 + t.amount, 0), 0) / 3;
    const current = summary.spentByCat[cat];
    if (current > 200 && priorAvg > 0 && current >= priorAvg * 1.5) {
      insights.push({ kind: 'warn', text: `${cat} גבוה ב-${Math.round((current / priorAvg - 1) * 100)}% מהממוצע התלת-חודשי` });
    }
  });

  if (isCurrentMonth && summary.totalBudget > 0) {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (dayOfMonth < daysInMonth) {
      const projected = (summary.expense / dayOfMonth) * daysInMonth;
      if (projected > summary.totalBudget) {
        insights.push({ kind: 'warn', text: `בקצב הנוכחי צפויה חריגה של ${fmt(projected - summary.totalBudget)} עד סוף החודש` });
      }
    }
  }

  return insights;
}
