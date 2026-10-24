export const DEPARTMENTS = ['שירות', 'שיווק', 'מכירות', 'פיננסים', 'ניהול', 'לימודים', 'כללי'];
export const PRIORITIES = ['גבוהה', 'בינונית', 'נמוכה'];
export const DIFFICULTIES = ['קלה', 'בינונית', 'קשה'];
export const BUSINESS_TYPES = ['עוסק מורשה', 'עוסק פטור', 'עוסק זעיר'];
export const LEAD_SOURCES = ['דף נחיתה', 'הודעות בפרטי', 'פה לאוזן · לקוח ישן', 'המלצה'];

export function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function ratio(part, whole) {
  return whole > 0 ? part / whole : null;
}

export function percentLabel(value) {
  return value === null ? 'אין' : Math.round(value * 100) + '%';
}

export function ymKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function funnelStats(leads) {
  const total = leads.length;
  const showed = leads.filter(l => l.showed).length;
  const relevant = leads.filter(l => l.showed && l.relevant).length;
  const closed = leads.filter(l => l.showed && l.relevant && l.closed).length;
  return {
    total,
    showed,
    relevant,
    closed,
    showRate: ratio(showed, total),
    relevantRate: ratio(relevant, showed),
    closeRate: ratio(closed, relevant),
    closeOfShowedRate: ratio(closed, showed)
  };
}

export function leadMonthKey(lead) {
  return (lead.contacted_at || lead.created_at || '').slice(0, 7);
}

export function marketingMetrics(month) {
  const followers = num(month.followers);
  const followersBudget = num(month.followersBudget);
  const boosts = num(month.boosts);
  const meetings = num(month.meetings);
  const closings = num(month.closings);
  return {
    followers,
    followersBudget,
    boosts,
    meetings,
    closings,
    budget: followersBudget + boosts,
    costPerFollower: followers > 0 ? followersBudget / followers : null,
    costPerMeeting: meetings > 0 ? boosts / meetings : null,
    costPerClient: closings > 0 ? boosts / closings : null,
    closeRate: ratio(closings, meetings)
  };
}

export function sumMarketing(months) {
  const total = months.reduce((acc, m) => ({
    followers: acc.followers + num(m.followers),
    followersBudget: acc.followersBudget + num(m.followersBudget),
    boosts: acc.boosts + num(m.boosts),
    meetings: acc.meetings + num(m.meetings),
    closings: acc.closings + num(m.closings)
  }), { followers: 0, followersBudget: 0, boosts: 0, meetings: 0, closings: 0 });
  return marketingMetrics(total);
}

export function planProgress(tasks) {
  const done = tasks.filter(t => t.done).length;
  return { done, total: tasks.length, rate: ratio(done, tasks.length) };
}

export function bucketTasks(tasks, today) {
  const open = tasks.filter(t => !t.done);
  return {
    today: open.filter(t => t.dueDate === today),
    overdue: open.filter(t => t.dueDate && t.dueDate < today),
    upcoming: open.filter(t => !t.dueDate || t.dueDate > today),
    done: tasks.filter(t => t.done)
  };
}

export function projectProgress(project) {
  return planProgress(project.steps || []);
}

export const EXPENSE_CATEGORIES = ['שירות', 'שיווק', 'מכירות', 'פיננסים', 'ייעוץ עסקי', 'מנטלי', 'העשרה', 'ללא קטגוריה'];
export const VAT_RATE = 0.18;
export const INCOME_TAX_RATE = 0.1;
export const NATIONAL_INSURANCE_RATE = 0.12;

export function comparePeriods(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function fixedActiveIn(entry, period) {
  return entry.fixed && comparePeriods(entry.startPeriod, period) <= 0 && (!entry.endPeriod || comparePeriods(period, entry.endPeriod) <= 0);
}

export function previousPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function monthPeriods(from, to) {
  const out = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export function financeMonth(entries, period, businessType) {
  const incomes = entries.filter(e => e.type === 'income' && e.period === period);
  const fixed = entries.filter(e => e.type === 'expense' && fixedActiveIn(e, period));
  const variable = entries.filter(e => e.type === 'expense' && !e.fixed && e.period === period);
  const income = incomes.reduce((s, e) => s + num(e.amount), 0);
  const clearing = incomes.reduce((s, e) => s + num(e.clearing), 0);
  const afterClearing = income - clearing;
  const vatRate = businessType === 'עוסק מורשה' ? VAT_RATE : 0;
  const afterVat = afterClearing / (1 + vatRate);
  const vat = afterClearing - afterVat;
  const fixedTotal = fixed.reduce((s, e) => s + num(e.amount), 0);
  const variableTotal = variable.reduce((s, e) => s + num(e.amount), 0);
  const expenses = fixedTotal + variableTotal;
  const operating = afterVat - expenses;
  const incomeTax = Math.max(0, operating) * INCOME_TAX_RATE;
  const nationalInsurance = Math.max(0, operating) * NATIONAL_INSURANCE_RATE;
  const net = operating - incomeTax - nationalInsurance;
  return {
    incomes,
    fixed,
    variable,
    income,
    clearing,
    afterClearing,
    afterVat,
    vat,
    fixedTotal,
    variableTotal,
    expenses,
    operating,
    incomeTax,
    nationalInsurance,
    taxes: vat + incomeTax + nationalInsurance,
    net,
    margin: ratio(net, income),
    missingReceipts: [...incomes, ...variable].filter(e => !e.receipt).length
  };
}

export function financeRange(entries, from, to, businessType) {
  const rows = monthPeriods(from, to).map(period => ({ period, ...financeMonth(entries, period, businessType) }));
  const income = rows.reduce((s, r) => s + r.income, 0);
  const expenses = rows.reduce((s, r) => s + r.expenses, 0);
  const net = rows.reduce((s, r) => s + r.net, 0);
  return { rows, income, expenses, net, margin: ratio(net, income), missingReceipts: rows.reduce((s, r) => s + r.missingReceipts, 0) };
}

export function expenseBreakdown(expenseEntries) {
  const totals = {};
  for (const e of expenseEntries) {
    const key = e.category || 'ללא קטגוריה';
    totals[key] = (totals[key] || 0) + num(e.amount);
  }
  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  return Object.entries(totals).map(([category, value]) => ({ category, value, share: ratio(value, total) })).sort((a, b) => b.value - a.value);
}
