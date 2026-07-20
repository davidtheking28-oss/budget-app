import { getMonthTx } from './monthUtils.js';
import { monthSummary } from './budgetMath.js';

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');

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
      insights.push({ kind: 'warn', text: `${cat}: ${fmt(current)} החודש, פי ${(current / priorAvg).toFixed(1)} מהרגיל (בממוצע ${fmt(priorAvg)})` });
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

  Object.keys(summary.spentByCat).forEach(cat => {
    if (!data?.budgets?.[cat] && summary.spentByCat[cat] > 300) {
      insights.push({ kind: 'tip', text: `${cat} — ${fmt(summary.spentByCat[cat])} הוצאה ללא תקציב מוגדר` });
    }
  });

  if (summary.totalBudget > 0 && summary.overCats.length === 0 && summary.expense > 0) {
    insights.push({ kind: 'good', text: 'כל הקטגוריות בתקציב החודש' });
  }

  const priorSummaries = [1, 2, 3].map(back => {
    const d = new Date(year, month - back, 1);
    return monthSummary(data, d.getFullYear(), d.getMonth());
  }).filter(s => s.income > 0);
  if (summary.income > 0 && priorSummaries.length) {
    const priorAvgRate = priorSummaries.reduce((s, x) => s + x.net / x.income, 0) / priorSummaries.length;
    const currentRate = summary.net / summary.income;
    if (currentRate > 0 && currentRate > priorAvgRate + 0.05) {
      insights.push({ kind: 'good', text: `קצב החיסכון השתפר לעומת הממוצע התלת-חודשי — ${Math.round(currentRate * 100)}% מההכנסה` });
    }
  }

  return insights;
}

export function computeHealthScore(data, year, month) {
  const summary = monthSummary(data, year, month);
  let score = 100;
  score -= summary.overCats.length * 12;
  if (summary.income > 0) {
    const savingsRate = summary.net / summary.income;
    if (savingsRate < 0) score -= 30;
    else if (savingsRate < 0.1) score -= 10;
  } else if (summary.expense > 0) {
    score -= 25;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
