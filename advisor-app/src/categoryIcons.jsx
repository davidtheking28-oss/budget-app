const p = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const bag = <svg {...p}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
const restaurant = <svg {...p}><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>;
const shield = <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
const shieldPlus = <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="9" x2="12" y2="15" /><line x1="9" y1="12" x2="15" y2="12" /></svg>;
const car = <svg {...p}><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 4v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>;
const gift = <svg {...p}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>;
const shirt = <svg {...p}><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" /></svg>;
const bus = <svg {...p}><rect x="4" y="3" width="16" height="13" rx="2" /><line x1="4" y1="11" x2="20" y2="11" /><circle cx="7.5" cy="19" r="1.5" /><circle cx="16.5" cy="19" r="1.5" /></svg>;
const toll = <svg {...p}><path d="M4 22 9 2h6l5 20" /><line x1="12" y1="6" x2="12" y2="9" /><line x1="12" y1="13" x2="12" y2="16" /></svg>;
const scissors = <svg {...p}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>;
const star = <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
const cigarette = <svg {...p}><rect x="2" y="12" width="16" height="6" rx="1" /><path d="M18 8a3 3 0 0 0 0-4" /><path d="M22 12v6" /></svg>;
const plane = <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.32 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.23 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
const users = <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const wrench = <svg {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>;
const pulse = <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
const paw = <svg {...p}><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703.461 1.5 1.5 2C4.5 14 3.5 16 2 17h12s-1.5-3-1.5-5c1.039-.5 1.42-1.297 1.5-2 .113-.994-1.177-6.53-4-7" /><path d="M14.5 5.172C14.5 3.782 16.077 2.679 18 3c2.823.47 4.113 6.006 4 7-.08.703-.461 1.5-1.5 2 .5 2 1.5 4 3 5H14s1-3 1-5" /></svg>;
const childUser = <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="23 11 17 11 17 17" /></svg>;
const sun = <svg {...p}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>;
const columns = <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><line x1="9" y1="22" x2="9" y2="12" /><line x1="15" y1="22" x2="15" y2="12" /></svg>;
const dots = <svg {...p}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>;
const house = <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
const building = <svg {...p}><rect x="4" y="3" width="16" height="18" rx="1" /><line x1="9" y1="21" x2="9" y2="14" /><line x1="15" y1="21" x2="15" y2="14" /></svg>;
const flame = <svg {...p}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><path d="M12 6v6l4 2" /></svg>;
const drop = <svg {...p}><path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z" /></svg>;
const bolt = <svg {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
const heart = <svg {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
const book = <svg {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>;
const chartUp = <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
const chartDown = <svg {...p}><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>;
const receipt = <svg {...p}><path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 2z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="16" y2="11" /></svg>;
const message = <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const card = <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="6" y1="15" x2="10" y2="15" /></svg>;
const bankNote = <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>;
const bank = <svg {...p}><line x1="3" y1="21" x2="21" y2="21" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 3 21 8 3 8" /></svg>;
const refresh = <svg {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>;
const briefcase = <svg {...p}><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
const laptop = <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;

const ICONS = {
  'מזון לבית': bag,
  'אוכל בחוץ ובילויים': restaurant,
  'פארם': shieldPlus,
  'דלק וחניה': car,
  'מתנות לאירועים ולשמחות': gift,
  'ביגוד והנעלה': shirt,
  'תחב״צ': bus,
  'כבישי אגרה': toll,
  'תספורת וקוסמטיקה': scissors,
  'תחביבים': star,
  'סיגריות': cigarette,
  'חופשה/טיול': plane,
  'עזרת/שמרטף': users,
  'תיקוני רכב': wrench,
  'בריאות': pulse,
  'בעלי חיים': paw,
  'דמי כיס/ילדים': childUser,
  'יהדות/חגים': sun,
  'ביטוח לאומי': columns,
  'שונות': dots,
  'דיור': house,
  'ועד בית': building,
  'גז': flame,
  'ארנונה': house,
  'מים וביוב': drop,
  'חשמל': bolt,
  'תרומות בהוראת קבע': heart,
  'חינוך, חוגים וקייטנות': book,
  'ביטוחים': shield,
  'הוראת קבע לחסכון': chartUp,
  'ריבית על המינוס': chartDown,
  'עמלת פעולות בערוץ ישיר': receipt,
  'עמלת SMS': message,
  'דמי כרטיס אשראי': card,
  'החזר הלוואות + חיוב קבוע': bank,
  'עסקאות בתשלומים': bankNote,
  'מנויים ושירותים': refresh,
  'שכר': briefcase,
  'שכר בן/בת זוג': users,
  'פרילנס': laptop,
  'קצבת ילדים': childUser,
  'קצבאות': briefcase,
  'הכנסה מנכס': house,
  'מזונות': shield,
  'מתנות': gift,
  'השקעות': chartUp,
  'אחר': dots,
  default: <svg {...p}><path d="M20.6 12.3 12.3 20.6a2 2 0 0 1-2.8 0l-7.1-7.1a2 2 0 0 1 0-2.8L10.7 2.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.9a2 2 0 0 1-.4 1.6z" /><circle cx="15.5" cy="8.5" r="1.5" /></svg>
};

export function getCategoryIcon(cat) {
  return ICONS[cat] || ICONS.default;
}
