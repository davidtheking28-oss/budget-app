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

export function financeSummary(entries) {
  const income = entries.filter(e => e.type === 'income').reduce((s, e) => s + num(e.amount), 0);
  const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + num(e.amount), 0);
  const net = income - expense;
  return {
    income,
    expense,
    net,
    margin: ratio(net, income),
    missingReceipts: entries.filter(e => e.type === 'expense' && !e.receipt).length
  };
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
