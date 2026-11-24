export function bookingAnnouncement(meeting, clientName) {
  const when = new Date(meeting.scheduled_at).toLocaleString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `בקשת פגישה חדשה: ${clientName || 'לקוח'} · ${when} · ממתינה לאישור שלך`;
}
