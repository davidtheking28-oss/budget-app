import { localISODate } from '../budget/monthUtils.js';

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

export function syncJourneyMeetings(raw, appointments, now = new Date()) {
  const journey = readJourney(raw);
  const rows = (appointments || []).filter(row => Number.isFinite(Date.parse(row.scheduled_at))).sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  const byId = new Map(rows.map(row => [row.id, row]));
  const used = new Set();
  const reserved = new Set(MEETINGS.map(step => journey.meetings[step.key].meetingId).filter(Boolean));
  const completed = MEETINGS.filter(step => journey.meetings[step.key].done);
  const past = rows.filter(row => row.status !== 'declined' && Date.parse(row.scheduled_at) <= now.getTime()).slice(-completed.length);
  const assign = (step, row) => {
    const own = journey.meetings[step.key];
    if ('summary' in row) {
      const summary = row.summary || '';
      const previousSummary = own.summary?.trim() && own.summary.trim() !== summary.trim() ? own.summary : own.previousSummary || '';
      journey.meetings[step.key] = { ...own, summary, previousSummary: previousSummary.trim() === summary.trim() ? '' : previousSummary, decisions: row.decisions || '' };
    }
    used.add(row.id);
    journey.meetings[step.key] = { ...journey.meetings[step.key], date: localISODate(new Date(row.scheduled_at)), meetingId: row.id, meetingStatus: row.status === 'pending' && row.for_client === false ? 'scheduled' : row.status || 'pending' };
  };
  completed.forEach(step => {
    const own = journey.meetings[step.key];
    const row = byId.get(own.meetingId) || past.find(item => !used.has(item.id) && !reserved.has(item.id) && (!own.date || localISODate(new Date(item.scheduled_at)) === own.date));
    if (row) assign(step, row);
  });
  MEETINGS.filter(step => !journey.meetings[step.key].done).forEach(step => {
    const own = journey.meetings[step.key];
    const linked = byId.get(own.meetingId);
    const row = linked && linked.status !== 'declined' && Date.parse(linked.scheduled_at) >= now.getTime() ? linked : rows.find(item => !used.has(item.id) && (!reserved.has(item.id) || item.id === own.meetingId) && item.status !== 'declined' && Date.parse(item.scheduled_at) >= now.getTime());
    if (row) assign(step, row);
    else if (own.meetingId) journey.meetings[step.key] = { ...own, date: '', meetingId: linked?.id || null, meetingStatus: linked?.status === 'declined' ? 'declined' : null };
  });
  return journey;
}

export function meetingStatusLabel(status) {
  return { pending: 'ממתינה לאישור הלקוח', confirmed: 'מאושרת', declined: 'נדחתה — נדרש תיאום חדש', scheduled: 'נקבעה' }[status] || '';
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
  return next ? { title: next.title, date: j.meetings[next.key].date || '', status: j.meetings[next.key].meetingStatus || null } : null;
}

export function journeyAttention(raw) {
  const j = readJourney(raw);
  const items = [];
  if (!j.onboarding.whatsapp) items.push('לפתוח קבוצת וואטסאפ');
  if (!j.onboarding.questionnaire) items.push('שאלון פתיחה');
  if (!j.onboarding.uploaded || !j.onboarding.docsOk) items.push('חסרים מסמכים');
  return items;
}
