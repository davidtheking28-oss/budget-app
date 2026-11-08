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

const isLegacyInsurance = t => t.type === 'expense' && t.cat === 'בריאות' && /^ביטוח/.test((t.desc || '').trim());

export function getMonthTx(transactions, y, m) {
  const prefix = mk(y, m);
  const inMonth = (transactions || []).filter(t => t.date && t.date.startsWith(prefix));
  const hasStandingInsurance = inMonth.some(t => t.fx && t.type === 'expense' && t.cat === 'ביטוחים');
  return inMonth
    .filter(t => !(hasStandingInsurance && isLegacyInsurance(t)))
    .map(t => (isLegacyInsurance(t) ? { ...t, cat: 'ביטוחים' } : t));
}

export function addMonths(y, m, delta) {
  const d = new Date(y, m + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function monthsElapsed(fromKey, toKey) {
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function loanMonthsLeft(l) {
  const n = parseInt(l?.monthsLeft, 10);
  if (!(n > 0)) return null;
  if (!l.monthsLeftAnchor) return n;
  const now = new Date();
  return Math.max(0, n - monthsElapsed(l.monthsLeftAnchor, mk(now.getFullYear(), now.getMonth())));
}

export function isLoanEnded(l) { return loanMonthsLeft(l) === 0; }

export function currentInstallments(p, total) {
  const base = parseFloat(p.current) || 0;
  if (!p.currentAnchor) return base;
  const now = new Date();
  return Math.max(0, Math.min(total, base + monthsElapsed(p.currentAnchor, mk(now.getFullYear(), now.getMonth()))));
}
