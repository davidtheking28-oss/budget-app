export type Notice = { kind: string; key: string; title: string; body: string }

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
