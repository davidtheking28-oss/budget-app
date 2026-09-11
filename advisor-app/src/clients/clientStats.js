const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function countNewThisWeek(clients, now = Date.now()) {
  return clients.filter(c => c.createdAt && (now - new Date(c.createdAt).getTime()) < WEEK_MS).length;
}
