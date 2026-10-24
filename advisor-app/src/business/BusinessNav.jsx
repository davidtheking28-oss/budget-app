const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const BUSINESS_NAV = [
  { key: 'tasks', label: 'לו״ז ומשימות', hint: 'מה עושים היום', group: 'manage', groupLabel: 'ניהול', description: 'המשימות של היום, מה באיחור ומה מתוכנן.', icon: <svg {...svgProps}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12l2 2 4-4" /></svg> },
  { key: 'projects', label: 'פרויקטים', hint: 'דברים גדולים בשלבים', group: 'manage', description: 'פרויקט הוא משהו גדול שמתחלק לשלבים ומשימות.', icon: <svg {...svgProps}><path d="M3 7h6l2 2h10v10H3z" /></svg> },
  { key: 'systems', label: 'סיסטמים', hint: 'תהליכים שחוזרים', group: 'manage', description: 'כל תהליך שחוזר על עצמו בעסק שווה סיסטם.', icon: <svg {...svgProps}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg> },
  { key: 'clients', label: 'הלקוחות שלי', hint: 'רשימה ותיקי לקוח', group: 'service', groupLabel: 'שירות', description: 'כל הלקוחות במקום אחד, עם מה שדורש טיפול.', icon: <svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M16 5a3.5 3.5 0 0 1 0 6.5M21.5 20c0-2.8-1.6-4.7-4-5.4" /></svg> },
  { key: 'marketing', label: 'משימות שיווק', hint: 'תוכנית חודשית', group: 'marketing', groupLabel: 'שיווק', description: 'משימות תוכנית השיווק של החודש ונתוני הקמפיינים.', icon: <svg {...svgProps}><path d="M4 14V9l11-5v16L4 15" /><path d="M18 9a4 4 0 0 1 0 6" /></svg> },
  { key: 'ideas', label: 'רעיונות לסרטונים', hint: 'לוח רעיונות והשראה', group: 'marketing', description: 'לוח רעיונות לסרטונים ומאגר השראה לפי נושא.', icon: <svg {...svgProps}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg> },
  { key: 'marketing-metrics', label: 'מדדי שיווק', hint: 'חודשי ושנתי', group: 'marketing', description: 'עלות לעוקב, לפגישה וללקוח, ואחוז סגירה.', icon: <svg {...svgProps}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg> },
  { key: 'prospects', label: 'לידים', hint: 'מתעניינים ואחוזי המרה', group: 'sales', groupLabel: 'מכירות', description: 'כל מי שהתעניין, מאיפה הגיע ועד איפה הוא בדרך.', icon: <svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M19 8v6M16 11h6" /></svg> },
  { key: 'sales-metrics', label: 'מדדי מכירות', hint: 'חודשי ושנתי', group: 'sales', description: 'אחוז הגעה, רלוונטיות וסגירה לאורך זמן.', icon: <svg {...svgProps}><path d="M4 20l5-6 4 3 7-9" /><path d="M16 8h4v4" /></svg> },
  { key: 'finance', label: 'פיננסים', hint: 'הכנסות והוצאות העסק', group: 'finance', groupLabel: 'פיננסים', description: 'הכנסות, הוצאות ורווח נטו משוער, חודש וחודש.', icon: <svg {...svgProps}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg> }
];

export const BUSINESS_KEYS = BUSINESS_NAV.map(n => n.key);
