import { describe, expect, it } from 'vitest';
import { clientDocumentsNotice, clientRequestNotice } from '../../../supabase/functions/budget-push/notices.ts';
import { expenseNotice } from '../../../supabase/functions/apple-pay-ingest/notice.ts';
import { urlBase64ToBytes } from './advisorPush.js';

describe('advisor notices for client activity', () => {
  it('announces a join request and links to the approvals screen', () => {
    const n = clientRequestNotice({ id: 'l1', name: 'דנה כהן', client_email: 'a@b.c' });
    expect(n.kind).toBe('advisor_new_client');
    expect(n.key).toBe('l1');
    expect(n.body).toContain('דנה כהן');
    expect(n.url).toBe('/budget-app/advisor/?dept=manage&view=client-approvals');
  });
  it('falls back to the email, then to a generic name', () => {
    expect(clientRequestNotice({ id: 'l', client_email: 'x@y.z' }).body).toContain('x@y.z');
    expect(clientRequestNotice({ id: 'l' }).body).toContain('לקוח חדש');
  });
  it('announces uploaded documents once per time bucket and opens the documents tab of that client', () => {
    const a = clientDocumentsNotice({ id: 'l', client_id: 'c1', name: 'דנה' }, 7);
    const b = clientDocumentsNotice({ id: 'l', client_id: 'c1', name: 'דנה' }, 8);
    expect(a.kind).toBe('advisor_client_docs');
    expect(a.key).not.toBe(b.key);
    expect(a.url).toBe('/budget-app/advisor/?view=client-view&client=c1&nav=documents');
  });
  it('tells the user about a recorded payment, rounded up', () => {
    expect(expenseNotice('Market In The City', 8.1)).toEqual({ title: 'נרשמה הוצאה 💳', body: 'Market In The City · ₪9', url: './' });
    expect(expenseNotice(' ', 12).body).toBe('Apple Pay · ₪12');
  });
  it('decodes the push key', () => {
    expect(Array.from(urlBase64ToBytes('AQID'))).toEqual([1, 2, 3]);
  });
});
