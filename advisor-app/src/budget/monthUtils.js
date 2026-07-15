export function mk(y, m) {
  return y + '-' + String(m + 1).padStart(2, '0');
}

export function getMonthTx(transactions, y, m) {
  const prefix = mk(y, m);
  return (transactions || []).filter(t => t.date && t.date.startsWith(prefix));
}

export function addMonths(y, m, delta) {
  const d = new Date(y, m + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
