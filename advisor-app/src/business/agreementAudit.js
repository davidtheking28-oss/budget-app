const DASH = '—';

function formatDate(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return DASH;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function formatBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : DASH;
}

export function formatAuditEvents(record) {
  const event = (label, at, ip, device) => ({ label, at: formatDate(at), ip: ip || DASH, device: device || DASH });
  return [
    event('נשלח', record.presented_at, null, null),
    event('נפתח', record.presented_at, record.presented_ip, record.presented_user_agent),
    event('נחתם', record.signed_at, record.signed_ip, record.signed_user_agent),
  ];
}

export function agreementPrintHtml(record) {
  const details = [
    ['שם מלא', record.full_name],
    ['תעודת זהות', record.national_id],
    ['תאריך לידה', formatBirthDate(record.birth_date)],
    ['כתובת', record.address],
    ['טלפון', record.phone],
    ['דוא"ל', record.email],
  ].map(([label, value]) => `<div>${escapeHtml(label)}: <b>${escapeHtml(value)}</b></div>`).join('');
  const events = formatAuditEvents(record).map(e => `<tr><td>${escapeHtml(e.label)}</td><td>${escapeHtml(e.at)}</td><td dir="ltr">${escapeHtml(e.ip)}</td><td dir="ltr">${escapeHtml(e.device)}</td></tr>`).join('');
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>הסכם התקשרות חתום</title>'
    + '<style>body{font-family:Arial,sans-serif;color:#111;background:#fff;line-height:1.7;padding:24px}.text{white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #888;padding:6px;text-align:right;word-break:break-word}img{max-width:260px;border:1px solid #888}.audit{break-before:page}</style></head><body>'
    + `<div class="text">${escapeHtml(record.body)}</div>`
    + `<h3>פרטי החותם</h3>${details}`
    + `<h3>חתימה</h3><img alt="חתימת הלקוח" src="${escapeHtml(record.signature_png)}">`
    + `<div class="audit"><h3>דף ביקורת</h3><div>מזהה הסכם: <span dir="ltr">${escapeHtml(record.id)}</span></div>`
    + `<table><thead><tr><th>אירוע</th><th>תאריך ושעה (שעון ישראל)</th><th>כתובת רשת</th><th>מכשיר</th></tr></thead><tbody>${events}</tbody></table>`
    + `<div>גרסת ההסכם: <span dir="ltr">${escapeHtml(record.version)}</span></div>`
    + `<div>טביעת אצבע של הנוסח (SHA-256): <span dir="ltr">${escapeHtml(record.body_sha256)}</span></div>`
    + `<div>טביעת אצבע של הרשומה (SHA-256): <span dir="ltr">${escapeHtml(record.record_sha256)}</span></div></div>`
    + '</body></html>';
}
