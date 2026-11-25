export function expenseNotice(merchant: string, amount: number) {
  const who = merchant.trim() || 'Apple Pay'
  return {
    title: 'נרשמה הוצאה 💳',
    body: `${who} · ₪${Math.ceil(Math.round(amount * 100) / 100).toLocaleString('he-IL')}`,
    url: './',
  }
}
