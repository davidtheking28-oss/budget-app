export function computeCategoryAverages(transactions) {
  const monthsPresent = new Set(transactions.map(t => t.source_month));
  const monthCount = monthsPresent.size || 1;
  const totals = {};
  for (const t of transactions) {
    totals[t.category] = (totals[t.category] || 0) + (Number(t.amount) || 0);
  }
  const averages = {};
  for (const cat of Object.keys(totals)) averages[cat] = totals[cat] / monthCount;
  return { averages, monthsCovered: monthCount };
}
