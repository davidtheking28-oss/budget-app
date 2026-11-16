export const DOC_KINDS = [
  { key: 'bank', label: 'עו"ש' },
  { key: 'credit', label: 'אשראי' }
];

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function docsMonths(startIso) {
  const start = new Date(startIso);
  const out = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(start.getFullYear(), start.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  }
  return out;
}

export function docsMonthLabel(month) {
  const [year, m] = month.split('-');
  return `${MONTHS_HE[Number(m) - 1]} ${year}`;
}

export function docsMissing(rows, months) {
  const missing = [];
  for (const { key } of DOC_KINDS) {
    for (const month of months) {
      if (!rows.some(r => r.kind === key && r.period_month === month)) missing.push(`${key}|${month}`);
    }
  }
  return missing;
}
