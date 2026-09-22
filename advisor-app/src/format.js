export const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

// Live thousand-separator formatting for a text input mid-typing — preserves
// a trailing decimal point/partial decimal digits, unlike toLocaleString alone.
export function formatAmountInput(v) {
  if (v === '' || v === null || v === undefined) return '';
  const raw = String(v).replace(/,/g, '');
  if (raw === '' || raw === '-' || isNaN(Number(raw))) return raw;
  const [intPart, decPart] = raw.split('.');
  const formattedInt = Number(intPart || 0).toLocaleString('en-US');
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

export const unformatAmountInput = v => v.replace(/,/g, '');
