export function txPatchFromForm(form) {
  const amount = parseFloat(form.amount);
  if (!form.desc.trim()) return { error: 'תן שם לעסקה' };
  if (!amount || amount <= 0) return { error: 'הזן סכום תקין' };
  if (!form.date) return { error: 'בחר תאריך' };
  return { patch: { desc: form.desc.trim(), cat: form.cat, amount, date: form.date } };
}

export function filterMonthTx(list, filter) {
  const rows = filter === 'expense' || filter === 'income' ? list.filter(t => t.type === filter) : list;
  return [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
