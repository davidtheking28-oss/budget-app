export function monthsToTarget(remaining, rate) {
  if (remaining <= 0) return 0;
  if (!(rate > 0)) return Infinity;
  return Math.ceil(remaining / rate);
}

export function baselineMonthlySaving(transactions, today = new Date()) {
  const since = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
  const sinceIso = since.getFullYear() + '-' + String(since.getMonth() + 1).padStart(2, '0') + '-' + String(since.getDate()).padStart(2, '0');
  const deposited = (transactions || [])
    .filter(t => t.goalTx && t.type === 'expense' && t.date >= sinceIso)
    .reduce((s, t) => s + (t.amount || 0), 0);
  return Math.round(deposited / 3);
}

export function savingsSeries(saved, rate, target, months) {
  return Array.from({ length: months + 1 }, (_, i) => Math.min(target, saved + rate * i));
}
