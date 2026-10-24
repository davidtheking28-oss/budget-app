const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const icons = {
  briefcase: <svg {...svgProps}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>,
  headset: <svg {...svgProps}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /><path d="M19 20a4 4 0 0 1-4 2h-2" /></svg>,
  megaphone: <svg {...svgProps}><path d="M4 14V9l11-5v16L4 15" /><path d="M18 9a4 4 0 0 1 0 6" /></svg>,
  chart: <svg {...svgProps}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>,
  coins: <svg {...svgProps}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3M3 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3" /><path d="M15 11c3.3 0 6 1.3 6 3v5c0 1.7-2.7 3-6 3" /></svg>,
  calendarCheck: <svg {...svgProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>,
  folder: <svg {...svgProps}><path d="M3 7h6l2 2h10v10H3z" /></svg>,
  nodes: <svg {...svgProps}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="12" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8.5 6H12a3 3 0 0 1 3 3v0M8.5 18H12a3 3 0 0 0 3-3v0" /></svg>,
  users: <svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M16 5a3.5 3.5 0 0 1 0 6.5M21.5 20c0-2.8-1.6-4.7-4-5.4" /></svg>,
  clipboard: <svg {...svgProps}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 14l2 2 4-4" /></svg>,
  tasks: <svg {...svgProps}><path d="M4 6h2l1 1 2-2M4 12h2l1 1 2-2M4 18h2l1 1 2-2M13 7h7M13 13h7M13 19h7" /></svg>,
  bulb: <svg {...svgProps}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>,
  table: <svg {...svgProps}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></svg>,
  trend: <svg {...svgProps}><path d="M4 20l5-6 4 3 7-9" /><path d="M16 8h4v4" /></svg>,
  pie: <svg {...svgProps}><path d="M12 3v9h9" /><circle cx="12" cy="12" r="9" /></svg>,
  calendar: <svg {...svgProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  userPlus: <svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8M19 8v6M16 11h6" /></svg>
};

export const DEPARTMENTS = [
  {
    key: 'manage',
    label: 'ניהול',
    icon: icons.briefcase,
    items: [
      { key: 'tasks', label: 'לו״ז + משימות', icon: icons.calendarCheck, bare: true },
      { key: 'projects', label: 'פרויקטים', icon: icons.folder, bare: true, description: 'פרויקט הוא משהו גדול שמתחלק לשלבים ומשימות.' },
      { key: 'systems', label: 'סיסטמים', icon: icons.nodes, bare: true, description: 'כל תהליך שחוזר על עצמו בעסק שווה סיסטם.' }
    ]
  },
  {
    key: 'service',
    label: 'שירות',
    icon: icons.headset,
    items: [
      { key: 'clients', label: 'ניהול לקוחות', title: 'לקוחות', icon: icons.users, bare: true },
      { key: 'client-service', label: 'שירות לקוחות', title: 'שירות', icon: icons.headset, bare: true, description: 'מי דורש טיפול, מתי הפגישה הבאה ואיפה כל לקוח בתהליך.' },
      { key: 'client-tasks', label: 'משימות לקוחות', icon: icons.clipboard, bare: true, description: 'מה דורש טיפול אצל הלקוחות היום.' }
    ]
  },
  {
    key: 'marketing',
    label: 'שיווק',
    icon: icons.megaphone,
    items: [
      { key: 'marketing', label: 'משימות שיווק', icon: icons.tasks },
      { key: 'ideas', label: 'רעיונות לסרטונים', icon: icons.bulb },
      { key: 'marketing-month', label: 'מדדים חודשי', icon: icons.table },
      { key: 'marketing-year', label: 'מדדים שנתי', icon: icons.trend },
      { key: 'marketing-full', label: 'מדדים מלא', icon: icons.pie }
    ]
  },
  {
    key: 'sales',
    label: 'מכירות',
    icon: icons.chart,
    items: [
      { key: 'prospects', label: 'לידים', icon: icons.userPlus },
      { key: 'sales-month', label: 'מדדים חודשי', icon: icons.table },
      { key: 'sales-year', label: 'מדדים שנתי', icon: icons.trend }
    ]
  },
  {
    key: 'finance',
    label: 'פיננסים',
    icon: icons.coins,
    items: [
      { key: 'fin-month', label: 'חודשי', icon: icons.table },
      { key: 'fin-year', label: 'שנתי', icon: icons.trend },
      { key: 'fin-full', label: 'מלא', icon: icons.pie },
      { key: 'fin-custom', label: 'אחר', icon: icons.calendar }
    ]
  }
];

export const BUSINESS_NAV = DEPARTMENTS.flatMap(d => d.items.map((item, i) => ({ ...item, dept: d.key, deptLabel: d.label, group: d.key, groupLabel: i === 0 ? d.label : undefined })));

export const BUSINESS_KEYS = BUSINESS_NAV.map(n => n.key);

export const deptOf = key => DEPARTMENTS.find(d => d.items.some(i => i.key === key)) || DEPARTMENTS[0];

export const pageTitle = item => item?.title || (item?.bare ? item.label : item ? `${item.deptLabel}: ${item.label}` : '');
