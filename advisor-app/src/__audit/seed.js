import { EXPENSE_CATS, FIXED_CATS, INCOME_CATS } from '../categories.js';

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth();
const d = day => `${Y}-${pad(M + 1)}-${pad(day)}`;
const iso = daysAgo => new Date(Date.now() - daysAgo * 86400000).toISOString();

const CLIENT_A = '11111111-1111-1111-1111-111111111111';
const CLIENT_B = '22222222-2222-2222-2222-222222222222';
const CLIENT_C = '33333333-3333-3333-3333-333333333333';
const CLIENT_EMPTY = '44444444-4444-4444-4444-444444444444';
const ADVISOR = '99999999-9999-9999-9999-999999999999';

const txSeed = [
  ['expense', EXPENSE_CATS[0], 'סופר יוחננוף — קניות שבועיות גדולות במיוחד', 1240.5, 3],
  ['expense', EXPENSE_CATS[0], 'רמי לוי', 380, 7],
  ['expense', EXPENSE_CATS[1], 'ארוחת ערב במסעדה', 268, 5],
  ['expense', EXPENSE_CATS[1], 'קפה', 22, 6],
  ['expense', EXPENSE_CATS[2], 'סופר פארם', 154.9, 8],
  ['expense', EXPENSE_CATS[3], 'דלק פז', 410, 9],
  ['expense', EXPENSE_CATS[3], 'חניון', 35, 11],
  ['expense', EXPENSE_CATS[5], 'קסטרו', 599, 12],
  ['expense', EXPENSE_CATS[7], 'רב קו', 225, 13],
  ['expense', EXPENSE_CATS[13], 'מרפאת שיניים', 890, 14],
  ['expense', FIXED_CATS[0], 'שכר דירה', 6200, 1],
  ['expense', FIXED_CATS[3], 'ארנונה', 640, 2],
  ['expense', FIXED_CATS[5], 'חשמל', 385, 2],
  ['expense', FIXED_CATS[8], 'ביטוח רכב', 320, 4],
  ['income', INCOME_CATS[0], 'משכורת', 18400, 1],
  ['income', INCOME_CATS[3], 'קצבת ילדים', 620, 1],
  ['income', INCOME_CATS[8], 'דיבידנד', 1150, 10]
];

const transactions = txSeed.map(([type, cat, desc, amount, day], i) => ({
  id: 'tx' + i, type, cat, desc, amount, date: d(day), recurring: false
}));

// previous month, so trend charts have history
const prev = new Date(Y, M - 1, 1);
const prevTx = txSeed.slice(0, 12).map(([type, cat, desc, amount, day], i) => ({
  id: 'ptx' + i, type, cat, desc,
  amount: Math.round(amount * 0.86),
  date: `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(day)}`,
  recurring: false
}));

const budgets = {
  [EXPENSE_CATS[0]]: 1500, [EXPENSE_CATS[1]]: 200, [EXPENSE_CATS[2]]: 250,
  [EXPENSE_CATS[3]]: 500, [EXPENSE_CATS[5]]: 400, [EXPENSE_CATS[7]]: 300,
  [EXPENSE_CATS[13]]: 700, [FIXED_CATS[0]]: 6200, [FIXED_CATS[3]]: 700, [FIXED_CATS[5]]: 400
};

const full = {
  user_id: CLIENT_A,
  transactions: [...transactions, ...prevTx],
  budgets,
  goals: [
    { id: 'g1', name: 'חופשה משפחתית ביוון', target: 18000, saved: 7400, months: 10 },
    { id: 'g2', name: 'קרן חירום', target: 60000, saved: 60000, months: 24 },
    { id: 'g3', name: 'החלפת רכב', target: 90000, saved: 3200, months: 36 }
  ],
  subscriptions: [
    { id: 's1', name: 'Netflix', category: 'סטרימינג', amount: 54.9, cycle: 'monthly', nextDate: d(20), active: true },
    { id: 's2', name: 'Spotify Family', category: 'מוזיקה', amount: 32.9, cycle: 'monthly', nextDate: d(24), active: true },
    { id: 's3', name: 'iCloud+ 2TB', category: 'אחסון ענן', amount: 399, cycle: 'yearly', nextDate: d(28), active: true },
    { id: 's4', name: 'ChatGPT Plus', category: 'כלי AI', amount: 78, cycle: 'monthly', nextDate: d(15), active: true }
  ],
  loans: [
    { id: 'l1', name: 'משכנתא', lender: 'בנק לאומי', monthly: 4800, remaining: 890000, original: 1100000, rate: 3.9 },
    { id: 'l2', name: 'הלוואת רכב', lender: 'מימון ישיר', monthly: 1250, remaining: 42000, original: 90000, rate: 6.4 }
  ],
  payments: [
    { id: 'p1', name: 'מקרר סמסונג', total: 12, current: 5, amount: 420, currentAnchor: `${Y}-${pad(M + 1)}` },
    { id: 'p2', name: 'מחשב נייד', total: 6, current: 2, amount: 980, currentAnchor: `${Y}-${pad(M + 1)}` }
  ],
  fixed_expenses: [
    { id: FIXED_CATS[0], amount: 6200 },
    { id: FIXED_CATS[3], amount: 640 },
    { id: FIXED_CATS[5], amount: 385 }
  ],
  insurances: [
    { id: 'i1', name: 'ביטוח בריאות משלים', monthly: 310 },
    { id: 'i2', name: 'ביטוח דירה', monthly: 95 }
  ],
  assets: [
    { id: 'a1', name: 'עו״ש לאומי', category: 'עו״ש', amount: 24500 },
    { id: 'a2', name: 'פנסיה מנורה', category: 'קרן פנסיה', amount: 412000 },
    { id: 'a3', name: 'השתלמות אלטשולר', category: 'קרן השתלמות', amount: 168000 },
    { id: 'a4', name: 'דירה ברמת גן', category: 'נדל״ן', amount: 2150000 },
    { id: 'a5', name: 'תיק מניות IBKR', category: 'תיק השקעות', amount: 96000 }
  ],
  settings: { incomeSources: [{ name: 'משכורת', amount: 18400 }] },
  updated_at: iso(2),
  updated_by: CLIENT_A
};

const thin = {
  user_id: CLIENT_B,
  transactions: transactions.slice(0, 4),
  budgets: { [EXPENSE_CATS[0]]: 900 },
  goals: [], subscriptions: [], loans: [], payments: [], fixed_expenses: [], insurances: [], assets: [],
  updated_at: iso(28), updated_by: ADVISOR
};

const overspent = {
  user_id: CLIENT_C,
  transactions: transactions.map(t => ({ ...t, amount: t.type === 'expense' ? t.amount * 2.4 : t.amount * 0.5 })),
  budgets,
  goals: [{ id: 'g1', name: 'חיסכון', target: 10000, saved: 250, months: 12 }],
  subscriptions: [], loans: [], payments: [], fixed_expenses: [], insurances: [], assets: [],
  updated_at: iso(1), updated_by: CLIENT_C
};

const economicMapping = {
  id: 'em1',
  advisor_id: ADVISOR,
  client_id: CLIENT_A,
  period_start: `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-01`,
  period_end: d(28),
  months_covered: 2,
  category_averages: {
    [EXPENSE_CATS[0]]: 1310, [EXPENSE_CATS[1]]: 240, [EXPENSE_CATS[2]]: 155,
    [EXPENSE_CATS[3]]: 410, [EXPENSE_CATS[5]]: 599, [EXPENSE_CATS[13]]: 620
  },
  transactions: [
    { date: d(3), desc: 'סופר יוחננוף', amount: 1240.5, category: EXPENSE_CATS[0], source_month: `${Y}-${pad(M + 1)}` },
    { date: d(7), desc: 'רמי לוי', amount: 380, category: EXPENSE_CATS[0], source_month: `${Y}-${pad(M + 1)}` },
    { date: d(5), desc: 'ארוחת ערב במסעדה', amount: 268, category: EXPENSE_CATS[1], source_month: `${Y}-${pad(M + 1)}` },
    { date: d(8), desc: 'סופר פארם', amount: 154.9, category: EXPENSE_CATS[2], source_month: `${Y}-${pad(M + 1)}` },
    { date: d(9), desc: 'דלק פז', amount: 410, category: EXPENSE_CATS[3], source_month: `${Y}-${pad(M + 1)}` },
    { date: d(12), desc: 'קסטרו', amount: 599, category: EXPENSE_CATS[5], source_month: `${Y}-${pad(M + 1)}` },
    { date: d(14), desc: 'מרפאת שיניים', amount: 620, category: EXPENSE_CATS[13], source_month: `${Y}-${pad(M + 1)}` }
  ],
  created_at: iso(20),
  updated_at: iso(2)
};

export const IDS = { CLIENT_A, CLIENT_B, CLIENT_C, CLIENT_EMPTY, ADVISOR };

export function makeDb(mode) {
  const empty = mode === 'empty';
  return {
    advisors: [{ user_id: ADVISOR }],
    advisor_clients: empty ? [] : [
      { id: 'r1', advisor_id: ADVISOR, client_id: CLIENT_A, client_email: 'yael.abramovich@gmail.com', status: 'active', created_at: iso(90) },
      { id: 'r2', advisor_id: ADVISOR, client_id: CLIENT_B, client_email: 'moshe@example.co.il', status: 'active', created_at: iso(60) },
      { id: 'r3', advisor_id: ADVISOR, client_id: CLIENT_C, client_email: 'a-very-long-client-email-address@some-long-domain-name.com', status: 'active', created_at: iso(30) },
      { id: 'r4', advisor_id: ADVISOR, client_id: CLIENT_EMPTY, client_email: 'new.client@gmail.com', status: 'active', created_at: iso(1) }
    ],
    budget_data: empty ? [] : [full, thin, overspent],
    economic_mappings: empty ? [] : [economicMapping],
    advisor_notes: empty ? [] : [
      { id: 'n1', advisor_id: ADVISOR, client_id: CLIENT_A, body: 'הלקוחה מעוניינת להגדיל הפרשה לפנסיה ב-2% החל מהרבעון הבא. לבדוק השלכות מס.', created_at: iso(5) },
      { id: 'n2', advisor_id: ADVISOR, client_id: CLIENT_A, body: 'שיחת טלפון קצרה.', created_at: iso(20) }
    ],
    advisor_tasks: empty ? [] : [
      { id: 't1', advisor_id: ADVISOR, client_id: CLIENT_A, title: 'לשלוח דוח רבעוני', due_date: d(Math.min(28, now.getDate() + 3)), done: false, created_at: iso(4) },
      { id: 't2', advisor_id: ADVISOR, client_id: CLIENT_A, title: 'להשוות מסלולי משכנתא מול שלושה בנקים ולחזור עם המלצה', due_date: d(Math.max(1, now.getDate() - 2)), done: false, created_at: iso(9) },
      { id: 't3', advisor_id: ADVISOR, client_id: CLIENT_A, title: 'לעדכן תקציב מזון', due_date: null, done: true, created_at: iso(15) },
      { id: 't4', advisor_id: ADVISOR, client_id: CLIENT_C, title: 'פגישת חירום', due_date: null, done: false, created_at: iso(2) }
    ],
    advisor_meetings: empty ? [] : [
      { id: 'm1', advisor_id: ADVISOR, client_id: CLIENT_A, scheduled_at: new Date(Date.now() + 4 * 86400000).toISOString(), notes: 'סקירה רבעונית', created_at: iso(10) },
      { id: 'm2', advisor_id: ADVISOR, client_id: CLIENT_A, scheduled_at: iso(40), notes: 'פגישת היכרות', created_at: iso(45) }
    ]
  };
}
