const p = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const ICONS = {
  food: <svg {...p}><path d="M3 2v7a3 3 0 0 0 3 3v10M8 2v20M13 2v7a2 2 0 0 0 2 2M15 2v20" /></svg>,
  transport: <svg {...p}><rect x="3" y="8" width="18" height="9" rx="2" /><circle cx="7.5" cy="19.5" r="1.5" /><circle cx="16.5" cy="19.5" r="1.5" /><path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" /></svg>,
  health: <svg {...p}><path d="M19 14c1.5-1.5 3-3.5 3-6a4 4 0 0 0-7-2.5A4 4 0 0 0 8 8c0 2.5 1.5 4.5 3 6l5 5 3-3" /><path d="M12 21s-8-4.5-8-11" /></svg>,
  home: <svg {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>,
  family: <svg {...p}><circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" /><path d="M17 14a4 4 0 0 1 4 4v3" /></svg>,
  travel: <svg {...p}><path d="M21 16v-2l-8-5V4a1.5 1.5 0 0 0-3 0v5l-8 5v2l8-2.5V19l-2.5 1.5V22l4.5-1 4.5 1v-1.5L12 19v-5.5z" /></svg>,
  shopping: <svg {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
  finance: <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5a2.5 2.5 0 0 1 2.5-1h.5a2 2 0 0 1 0 4h-1a2 2 0 0 0 0 4h.5a2.5 2.5 0 0 0 2.5-1" /></svg>,
  default: <svg {...p}><path d="M20.6 12.3 12.3 20.6a2 2 0 0 1-2.8 0l-7.1-7.1a2 2 0 0 1 0-2.8L10.7 2.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.9a2 2 0 0 1-.4 1.6z" /><circle cx="15.5" cy="8.5" r="1.5" /></svg>
};

const RULES = [
  [/מזון|אוכל|בילוי/, 'food'],
  [/רכב|דלק|חני|תחב״צ|תחבורה|כביש/, 'transport'],
  [/בריאות|ביטוח.*חיים|ביטוח בריאות|בעלי חיים/, 'health'],
  [/משכנת|שכר דיר|ועד בית|חשמל|מים|ארנונה|גז\b/, 'home'],
  [/ילדים|חוגים|קייטנ|עזרת|שמרטף/, 'family'],
  [/חופש|טיול/, 'travel'],
  [/ביגוד|הנעלה|תספורת|קוסמטיקה|פארם|מתנות/, 'shopping'],
  [/מניות|ריבית|עמלת|כרטיס אשראי|הלוואות|תשלומים/, 'finance']
];

export function getCategoryIcon(cat) {
  const key = RULES.find(([re]) => re.test(cat))?.[1] || 'default';
  return ICONS[key];
}
