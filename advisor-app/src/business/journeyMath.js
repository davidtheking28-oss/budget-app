export const ONBOARDING = [
  { key: 'whatsapp', label: 'נפתחה קבוצת WhatsApp' },
  { key: 'questionnaire', label: 'מילא שאלון פתיחה' },
  { key: 'uploaded', label: 'העלה מסמכים' },
  { key: 'docsOk', label: 'מסמכים תקינים' }
];

export const MEETINGS = [
  { key: 'm1', title: 'פגישה 1: מיפוי', balance: 'נתוני המיפוי', tasks: 'משימות לאחר פגישה 1', followups: 0 },
  { key: 'm2', title: 'פגישה 2: בניית תוכנית כלכלית', balance: 'תקציב פיילוט', tasks: 'משימות לאחר פגישה 2', followups: 3 },
  { key: 'm3', title: 'פגישה 3: התאמת התוכנית הכלכלית', balance: 'תקציב חדש', tasks: 'משימות לאחר פגישה 3', followups: 3 },
  { key: 'm4', title: 'פגישה 4: מפגש סיום', balance: 'תקציב סופי', tasks: 'משימות לאחר פגישה 4', followups: 0 }
];

export const emptyJourney = () => ({
  onboarding: {},
  note: '',
  meetings: Object.fromEntries(MEETINGS.map(m => [m.key, { done: false, date: '', summary: '', income: '', expenses: '', tasks: [], followups: Array.from({ length: m.followups }, () => false) }])),
  goals: ['', ''],
  recommendation: { requested: false, received: false, text: '' }
});

export function readJourney(raw) {
  const base = emptyJourney();
  const src = raw || {};
  const meetings = Object.fromEntries(MEETINGS.map(m => {
    const own = src.meetings?.[m.key] || {};
    const followups = Array.isArray(own.followups) && own.followups.length >= m.followups ? own.followups : base.meetings[m.key].followups;
    return [m.key, { ...base.meetings[m.key], ...own, followups, tasks: Array.isArray(own.tasks) ? own.tasks : [] }];
  }));
  return {
    ...base,
    ...src,
    onboarding: { ...(src.onboarding || {}) },
    meetings,
    goals: Array.isArray(src.goals) && src.goals.length ? src.goals : base.goals,
    recommendation: { ...base.recommendation, ...(src.recommendation || {}) }
  };
}

const num = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
export const cashflow = m => num(m.income) - num(m.expenses);

export function journeyProgress(raw) {
  const j = readJourney(raw);
  const steps = [
    ...ONBOARDING.map(s => !!j.onboarding[s.key]),
    ...MEETINGS.flatMap(m => [!!j.meetings[m.key].done, ...j.meetings[m.key].followups.slice(0, m.followups).map(Boolean)]),
    !!j.recommendation.received
  ];
  const done = steps.filter(Boolean).length;
  return { done, total: steps.length, rate: steps.length ? done / steps.length : 0 };
}

export function currentStage(raw) {
  const j = readJourney(raw);
  const onboardingDone = ONBOARDING.every(s => j.onboarding[s.key]);
  const next = MEETINGS.find(m => !j.meetings[m.key].done);
  if (!next) return j.recommendation.received ? 'התהליך הושלם' : 'בקשת המלצה';
  if (next.key === 'm1' && !onboardingDone) return 'קליטה: לפני פגישה 1';
  const prior = MEETINGS[MEETINGS.indexOf(next) - 1];
  return prior ? `אחרי ${prior.title.split(':')[0]}` : next.title;
}

export function nextMeeting(raw) {
  const j = readJourney(raw);
  const next = MEETINGS.find(m => !j.meetings[m.key].done);
  return next ? { title: next.title, date: j.meetings[next.key].date || '' } : null;
}

export function journeyAttention(raw) {
  const j = readJourney(raw);
  const items = [];
  if (!j.onboarding.whatsapp) items.push('לפתוח קבוצת וואטסאפ');
  if (!j.onboarding.questionnaire) items.push('שאלון פתיחה');
  if (!j.onboarding.uploaded || !j.onboarding.docsOk) items.push('חסרים מסמכים');
  return items;
}
