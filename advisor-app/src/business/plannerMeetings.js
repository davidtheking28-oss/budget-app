import { meetingStatusLabel } from './journeyMath.js';

const pad = n => String(n).padStart(2, '0');

export function meetingEvents(meetings, clients) {
  const names = new Map(clients.map(c => [c.client_id, c.name || c.client_email]));
  return meetings.filter(m => m.status !== 'declined' && Number.isFinite(new Date(m.scheduled_at).getTime())).map(m => {
    const start = new Date(m.scheduled_at);
    const minute = start.getHours() * 60 + start.getMinutes();
    const end = Math.min(1440, minute + 60);
    const status = m.status === 'pending' && !m.for_client ? 'scheduled' : m.status || 'pending';
    return {
      id: 'meeting-' + m.id, meetingId: m.id, clientId: m.client_id,
      date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      s: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      e: `${pad(Math.floor(end / 60))}:${pad(end % 60)}`,
      t: 'client', n: 'פגישה · ' + (names.get(m.client_id) || 'לקוח'), o: m.notes || '',
      status, statusLabel: meetingStatusLabel(status)
    };
  });
}
