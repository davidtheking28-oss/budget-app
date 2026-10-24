import { FIXED_CATS } from '../categories.js';

export const SAVINGS_CATEGORY = 'הוראת קבע לחסכון';
export const ANNUAL_CATEGORY = 'הוצאות שנתיות (חלק חודשי)';
export const GUIDANCE_CATEGORY = 'ליווי פיננסי';

const entry = (key, label = key) => ({ key, label });

export const INCOME_TEMPLATE = [
  entry('שכר', 'עבודה גבר'),
  entry('עבודה גבר 2'),
  entry('שכר בן/בת זוג', 'עבודה אישה'),
  entry('עבודה אישה 2'),
  entry('קצבת ילדים'),
  entry('קצבאות', 'קצבאות נוספות'),
  entry('מזונות', 'דמי מזונות'),
  entry('הכנסה מנכס', 'שכר דירה'),
  entry('פרילנס', 'הכנסה מעסק'),
  entry('סיוע מההורים')
];

export const SAVINGS_TEMPLATE = [
  entry(SAVINGS_CATEGORY, 'הוראת קבע לחיסכון'),
  entry(GUIDANCE_CATEGORY)
];

export const FIXED_TEMPLATE = [
  entry('דיור', 'שכר דירה'),
  entry('ועד בית'),
  entry('גז'),
  entry('ארנונה'),
  entry('מים וביוב'),
  entry('חשמל'),
  entry('חינוך, חוגים וקייטנות', 'חינוך'),
  entry('ביטוחים'),
  entry('מנויים ושירותים', 'מנויים'),
  entry(ANNUAL_CATEGORY)
];

export const VARIABLE_TEMPLATE = [
  entry('מזון לבית'),
  entry('אוכל בחוץ ובילויים'),
  entry('תחביבים'),
  entry('פארם'),
  entry('תספורת וקוסמטיקה', 'קוסמטיקה'),
  entry('דלק וחניה'),
  entry('מתנות לאירועים ולשמחות', 'מתנות לאירועים ושוטפות'),
  entry('ביגוד והנעלה'),
  entry('תחב״צ', 'תחבורה'),
  entry('כבישי אגרה'),
  entry('חופשה/טיול', 'חופשות'),
  entry('סיגריות'),
  entry('עזרת/שמרטף', 'עזרה/מטפלת'),
  entry('תיקוני רכב'),
  entry('בריאות'),
  entry('בעלי חיים'),
  entry('דמי כיס/ילדים'),
  entry('עמלות'),
  entry('שונות'),
  entry('ביט ללא מעקב'),
  entry('מזומן ללא מעקב')
];

export const SAVINGS_KEYS = SAVINGS_TEMPLATE.map(t => t.key);
export const FIXED_KEYS = [...new Set([...FIXED_CATS.filter(c => c !== SAVINGS_CATEGORY), ANNUAL_CATEGORY])];

const LABELS = Object.fromEntries([...INCOME_TEMPLATE, ...SAVINGS_TEMPLATE, ...FIXED_TEMPLATE, ...VARIABLE_TEMPLATE].map(t => [t.key, t.label]));

export function labelOf(key) { return LABELS[key] || key; }
