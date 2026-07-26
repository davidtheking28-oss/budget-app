export const EXPENSE_CATS = ['מזון לבית','אוכל בחוץ ובילויים','פארם','דלק וחניה','מתנות לאירועים ולשמחות','ביגוד והנעלה','תחב״צ','כבישי אגרה','תספורת וקוסמטיקה','תחביבים','סיגריות','חופשה/טיול','עזרת/שמרטף','תיקוני רכב','בריאות','בעלי חיים','דמי כיס/ילדים','יהדות/חגים','ביטוח לאומי','שונות'];
export const FIXED_CATS = ['דיור','ועד בית','גז','ארנונה','מים וביוב','חשמל','תרומות בהוראת קבע','חינוך, חוגים וקייטנות','ביטוחים','הוראת קבע לחסכון','ריבית על המינוס','עמלת פעולות בערוץ ישיר','עמלת SMS','דמי כרטיס אשראי','החזר הלוואות + חיוב קבוע','עסקאות בתשלומים','מנויים ושירותים'];
export const BUDGET_CATS = [...EXPENSE_CATS, ...FIXED_CATS.filter(c => !EXPENSE_CATS.includes(c))];
export const INCOME_CATS = ['שכר','שכר בן/בת זוג','פרילנס','קצבת ילדים','קצבאות','הכנסה מנכס','מזונות','מתנות','השקעות','אחר'];
export const CHART_PALETTE = ['#0f766e', '#2dd4a7', '#155e9c', '#7dd3c0', '#b45309', '#5b8def', '#c2410c', '#9a7fd1'];

// A category's colour must be stable everywhere — filtering or re-sorting a list
// must never repaint it. Key the palette on the category's position in the
// canonical arrays, not on its rank in whatever list is being rendered.
const CAT_ORDER = [...BUDGET_CATS, ...INCOME_CATS.filter(c => !BUDGET_CATS.includes(c))];

export function catColor(cat) {
  const i = CAT_ORDER.indexOf(cat);
  if (i >= 0) return CHART_PALETTE[i % CHART_PALETTE.length];
  let h = 0;
  for (let j = 0; j < cat.length; j++) h = (h * 31 + cat.charCodeAt(j)) >>> 0;
  return CHART_PALETTE[h % CHART_PALETTE.length];
}
// Chart.js takes plain colour strings, so it cannot follow CSS variables.
// Read the live computed values instead, and re-read them whenever the theme
// changes (callers key their charts on the theme so this re-runs).
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function chartTheme() {
  return {
    bg: cssVar('--bg', '#eef3f1'),
    surface: cssVar('--surface', '#ffffff'),
    text: cssVar('--text', '#0f231e'),
    text2: cssVar('--text2', '#566963'),
    border: cssVar('--border', 'rgba(15, 35, 30, 0.12)'),
    green: cssVar('--green', '#046b4d'),
    greenLight: cssVar('--accent', '#0a7a62'),
    red: cssVar('--red', '#b02631'),
    redLight: cssVar('--red', '#b02631')
  };
}
