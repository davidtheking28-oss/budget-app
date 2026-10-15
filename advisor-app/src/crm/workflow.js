import { localISODate } from '../budget/monthUtils.js';

export function taskMatches(task, filter, today = localISODate()) {
  if (task.done) return false;
  if (filter === 'overdue') return !!task.due_date && task.due_date < today;
  if (filter === 'today') return task.due_date === today;
  if (filter === 'documents') return task.task_kind === 'document';
  return true;
}

export function lastHeldMeeting(meetings, now = new Date()) {
  return meetings.filter(m => m.status !== 'declined' && new Date(m.scheduled_at) <= now)
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))[0] || null;
}

export function meetingChanges(transactions, since, now = new Date()) {
  if (!since) return null;
  const start = localISODate(new Date(since));
  const end = localISODate(now);
  const rows = (transactions || []).filter(t => t.date > start && t.date <= end);
  return { count: rows.length, expense: rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0) };
}
