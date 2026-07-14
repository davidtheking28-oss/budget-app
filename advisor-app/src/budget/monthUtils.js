export function mk(y, m) {
  return y + '-' + String(m + 1).padStart(2, '0');
}

export function getMonthTx(transactions, y, m) {
  const prefix = mk(y, m);
  return (transactions || []).filter(t => t.date && t.date.startsWith(prefix));
}
