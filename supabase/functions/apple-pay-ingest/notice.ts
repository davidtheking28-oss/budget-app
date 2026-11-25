export function expenseNotice(merchant: string, amount: number) {
  const who = merchant.trim() || 'Apple Pay'
  return {
    title: 'נרשמה הוצאה 💳',
    body: `${who} · ₪${Math.ceil(Math.round(amount * 100) / 100).toLocaleString('he-IL')}`,
    url: './',
  }
}

export const setupNotice = {
  title: 'Apple Pay עוד לא מחובר',
  body: 'ודא שיש לך iOS 27, מחק את הקיצור הישן, ובהגדרות ← Apple Pay צור קוד חדש ועקוב אחרי "מדריך עם תמונות"',
  url: './',
}
