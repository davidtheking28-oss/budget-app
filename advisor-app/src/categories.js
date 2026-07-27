export const EXPENSE_CATS = ['מזון לבית','אוכל בחוץ ובילויים','פארם','דלק וחניה','מתנות לאירועים ולשמחות','ביגוד והנעלה','תחב״צ','כבישי אגרה','תספורת וקוסמטיקה','תחביבים','סיגריות','חופשה/טיול','עזרת/שמרטף','תיקוני רכב','בריאות','בעלי חיים','דמי כיס/ילדים','יהדות/חגים','ביטוח לאומי','שונות'];
export const FIXED_CATS = ['דיור','ועד בית','גז','ארנונה','מים וביוב','חשמל','תרומות בהוראת קבע','חינוך, חוגים וקייטנות','ביטוחים','הוראת קבע לחסכון','ריבית על המינוס','עמלת פעולות בערוץ ישיר','עמלת SMS','דמי כרטיס אשראי','החזר הלוואות + חיוב קבוע','עסקאות בתשלומים','מנויים ושירותים'];
export const BUDGET_CATS = [...EXPENSE_CATS, ...FIXED_CATS.filter(c => !EXPENSE_CATS.includes(c))];
export const INCOME_CATS = ['שכר','שכר בן/בת זוג','פרילנס','קצבת ילדים','קצבאות','הכנסה מנכס','מזונות','מתנות','השקעות','אחר'];
export const CHART_PALETTE = ['#0f766e', '#2dd4a7', '#155e9c', '#7dd3c0', '#b45309', '#5b8def', '#c2410c', '#9a7fd1'];

// Free-text keys (subscription names, custom asset labels) have no canonical
// position, so they hash into a slot. Eight slots collided constantly — the four
// seeded subscriptions produced only two distinct colours. These sixteen are
// spaced at least 23 ΔE apart, clear at least 4:1 against both the light and the
// dark card surface, and stay at least 20 ΔE away from the green/red status
// colours so a chip never reads as a verdict.
export const HASH_PALETTE = [
  '#777c86', '#d74f26', '#b7674e', '#b16d1f', '#8a7c38', '#668718', '#1a8a92', '#2084b6',
  '#6b77c3', '#6d6de5', '#a853e1', '#ad5dbd', '#d326d9', '#db34a4', '#bd5d86', '#dd3d7d'
];

// A category's colour must be stable everywhere — filtering or re-sorting a list
// must never repaint it. Key the palette on the category's position in the
// canonical arrays, not on its rank in whatever list is being rendered.
const CAT_ORDER = [...BUDGET_CATS, ...INCOME_CATS.filter(c => !BUDGET_CATS.includes(c))];

export function stableColor(key, order) {
  const k = String(key);
  const i = order ? order.indexOf(k) : -1;
  if (i >= 0) return CHART_PALETTE[i % CHART_PALETTE.length];
  let h = 0;
  for (let j = 0; j < k.length; j++) h = (h * 31 + k.charCodeAt(j)) >>> 0;
  return HASH_PALETTE[h % HASH_PALETTE.length];
}

export function catColor(cat) {
  return stableColor(cat, CAT_ORDER);
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
    font: cssVar('--font-body', 'Assistant').split(',')[0].replace(/['"]/g, '').trim(),
    bg: cssVar('--bg', '#eef3f1'),
    surface: cssVar('--surface', '#ffffff'),
    text: cssVar('--text', '#0f231e'),
    text2: cssVar('--text2', '#566963'),
    border: cssVar('--border', 'rgba(15, 35, 30, 0.12)'),
    green: cssVar('--green', '#046b4d'),
    greenHover: cssVar('--green-hover', '#068b62'),
    red: cssVar('--red', '#b02631'),
    redHover: cssVar('--red-hover', '#cd2f3c')
  };
}
