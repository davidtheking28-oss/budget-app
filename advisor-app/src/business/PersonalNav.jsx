import { icons } from './BusinessNav.jsx';

export const PERSONAL_NAV = [
  { key: 'personal-expenses', label: 'ניהול הוצאות', icon: icons.coins, groupLabel: 'שוטף', description: 'מעקב חודשי אחרי התקציב שלך: לפי קטגוריות.' },
  { key: 'personal-budget', label: 'תקציב', icon: icons.pie, description: 'מיפוי, תקציב חודשי ושנתי, ותוכנית ארוכת טווח.' },
  { key: 'personal-assets', label: 'שווי נקי', icon: icons.trend, description: 'תמונה עדכנית של הנכסים וההתחייבויות שלך.' },
  { key: 'personal-calculator', label: 'מחשבון ריבית דריבית', icon: icons.percent, description: 'כמה הכסף צומח לאורך זמן, או כמה להפקיד כדי להגיע למטרה.' },
  { key: 'personal-settings', label: 'ההגדרות שלי', icon: icons.gear, groupLabel: 'חשבון', description: 'הפרטים שלך.' }
];

export const PERSONAL_KEYS = PERSONAL_NAV.map(n => n.key);
