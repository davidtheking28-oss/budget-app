import { CLIENT_APP_URL } from './clientApp.js';

export const DOCS_TOTAL = 6;

export function newInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const inviteLink = (advisorId, token) => CLIENT_APP_URL + '?advisor=' + advisorId + '&inv=' + token;

export const inviteMessage = (name, advisorId, token) =>
  'היי ' + name.trim() + ', הנה הקישור האישי שלך להרשמה לפלטפורמה שלנו: ' + inviteLink(advisorId, token) + ' . אחרי ההרשמה אאשר אותך מהמערכת שלי.';

export function waPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? '972' + digits.slice(1) : digits;
}

export function inviteStatus(invite, links, docsByClient) {
  if (!invite.client_id) return { key: 'sent', label: 'נשלח, עוד לא נרשם' };
  const link = links.find(l => l.client_id === invite.client_id);
  if (!link || (link.status !== 'pending' && link.status !== 'active')) return { key: 'removed', label: 'נרשם, הבקשה הוסרה' };
  if (link.status === 'pending') return { key: 'requested', label: 'נרשם, ממתין לאישורך' };
  const n = Math.min(DOCS_TOTAL, docsByClient[invite.client_id] || 0);
  return n >= DOCS_TOTAL ? { key: 'ready', label: 'אושר · המסמכים הועלו' } : { key: 'docs', label: 'אושר · מסמכים ' + n + ' מתוך ' + DOCS_TOTAL };
}
