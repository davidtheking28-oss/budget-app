export type Notice = { kind: string; key: string; title: string; body: string; url?: string }

export type MeetingRow = {
  id: string
  scheduled_at: string
  notes?: string | null
  status: string
  requested_by_client?: boolean | null
}

const ilDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })

const ilTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })

export function meetingConfirmedNotice(m: MeetingRow): Notice {
  const when = new Date(m.scheduled_at).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return {
    kind: 'advisor_meeting_confirmed',
    key: `${m.id}:${m.scheduled_at}`,
    title: 'הפגישה אושרה ✅',
    body: `${m.notes || 'פגישת ייעוץ'} · ${when}`,
  }
}

export function meetingEveNotice(m: MeetingRow, tomorrow: string): Notice | null {
  if (m.status !== 'confirmed' || ilDay(m.scheduled_at) !== tomorrow) return null
  return {
    kind: 'advisor_meeting_eve',
    key: `${m.id}:${tomorrow}`,
    title: 'תזכורת: פגישה מחר עם היועץ 📅',
    body: `${m.notes || 'פגישת ייעוץ'} · מחר ב-${ilTime(m.scheduled_at)}`,
  }
}

export type ClientRequestRow = {
  id: string
  name?: string | null
  client_email?: string | null
  invited_email?: string | null
}

export const APPROVALS_URL = '/budget-app/advisor/?dept=manage&view=client-approvals'

export function clientRequestNotice(l: ClientRequestRow): Notice {
  const who = l.name || l.client_email || l.invited_email || 'לקוח חדש'
  return {
    kind: 'advisor_new_client',
    key: l.id,
    title: 'בקשת הצטרפות חדשה 👤',
    body: `${who} מבקש להצטרף. ממתין לאישורך`,
    url: APPROVALS_URL,
  }
}

export function clientDocumentsNotice(l: ClientRequestRow & { client_id: string }, bucket: number): Notice {
  const who = l.name || l.client_email || l.invited_email || 'לקוח'
  return {
    kind: 'advisor_client_docs',
    key: `${l.client_id}:${bucket}`,
    title: 'מסמכים חדשים מלקוח 📄',
    body: `${who} העלה מסמכים`,
    url: `/budget-app/advisor/?view=client-view&client=${l.client_id}&nav=documents`,
  }
}
