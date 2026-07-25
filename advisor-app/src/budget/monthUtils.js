export function mk(y, m) {
  return y + '-' + String(m + 1).padStart(2, '0');
}

export function localISODate(d) {
  d = d || new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function getMonthTx(transactions, y, m) {
  const prefix = mk(y, m);
  return (transactions || []).filter(t => t.date && t.date.startsWith(prefix));
}

export function addMonths(y, m, delta) {
  const d = new Date(y, m + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
