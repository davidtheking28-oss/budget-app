import { describe, it, expect } from 'vitest';
import { inviteLink, inviteMessage, waPhone, inviteStatus, newInviteToken } from './invites.js';

describe('personal invites', () => {
  it('builds a link that carries the advisor and the invite code', () => {
    expect(inviteLink('adv-1', 'Tok_123456789')).toBe('https://davidtheking28-oss.github.io/budget-app/?advisor=adv-1&inv=Tok_123456789');
    expect(inviteMessage('יוסי', 'adv-1', 'Tok_123456789')).toContain('היי יוסי');
    expect(inviteMessage('יוסי', 'adv-1', 'Tok_123456789')).toContain('&inv=Tok_123456789');
  });

  it('turns an Israeli mobile number into a WhatsApp number', () => {
    expect(waPhone('050-448 7878')).toBe('972504487878');
    expect(waPhone('+972504487878')).toBe('972504487878');
    expect(waPhone('')).toBe('');
  });

  it('makes tokens the database accepts', () => {
    const t = newInviteToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{12,40}$/);
    expect(newInviteToken()).not.toBe(t);
  });

  it('follows a client from sent to approved with documents', () => {
    const links = [{ client_id: 'c1', status: 'pending' }, { client_id: 'c2', status: 'active' }, { client_id: 'c3', status: 'active' }];
    const docs = { c2: 3, c3: 6 };
    expect(inviteStatus({ client_id: null }, links, docs).key).toBe('sent');
    expect(inviteStatus({ client_id: 'c1' }, links, docs)).toMatchObject({ key: 'requested', label: 'נרשם, ממתין לאישורך' });
    expect(inviteStatus({ client_id: 'c2' }, links, docs)).toMatchObject({ key: 'docs', label: 'אושר · מסמכים 3 מתוך 6' });
    expect(inviteStatus({ client_id: 'c3' }, links, docs)).toMatchObject({ key: 'ready', label: 'אושר · המסמכים הועלו' });
    expect(inviteStatus({ client_id: 'c9' }, links, docs).key).toBe('removed');
  });
});
