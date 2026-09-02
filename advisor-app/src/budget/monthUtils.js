export const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function mk(y, m) {
  return y + '-' + String(m + 1).padStart(2, '0');
}

export function localISODate(d) {
  d = d || new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return dateFmt.format(new Date(y, m - 1, d));
}

const dateTimeFmt = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateTimeFmt.format(d);
}

export function getMonthTx(transactions, y, m) {
  const prefix = mk(y, m);
  return (transactions || []).filter(t => t.date && t.date.startsWith(prefix));
}

export function addMonths(y, m, delta) {
  const d = new Date(y, m + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
