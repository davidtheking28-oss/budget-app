import { describe, it, expect } from 'vitest';
import { formatAuditEvents, agreementPrintHtml, whenImagesLoaded } from './agreementAudit.js';

describe('whenImagesLoaded', () => {
  it('waits for every image that is not complete yet', async () => {
    let listeners = 0;
    const pending = { complete: false, addEventListener: (type, cb) => { listeners += 1; setTimeout(cb, 5); } };
    await whenImagesLoaded({ querySelectorAll: () => [{ complete: true }, pending] });
    expect(listeners).toBe(2);
  });
  it('resolves at once when there are no images', async () => {
    await expect(whenImagesLoaded({ querySelectorAll: () => [] })).resolves.toBeUndefined();
  });
});

const record = {
  presented_at: '2026-11-22T10:26:00Z',
  presented_ip: '87.1.2.3',
  presented_user_agent: 'Safari 26',
  signed_at: '2026-11-22T10:31:00Z',
  signed_ip: null,
  signed_user_agent: 'Safari 26',
};

describe('formatAuditEvents', () => {
  it('returns sent, opened and signed in that order', () => {
    expect(formatAuditEvents(record).map(e => e.label)).toEqual(['נשלח', 'נפתח', 'נחתם']);
  });
  it('shows dates as DD/MM/YYYY HH:MM in Israel time', () => {
    const events = formatAuditEvents(record);
    expect(events[0].at).toBe('22/11/2026 12:26');
    expect(events[2].at).toBe('22/11/2026 12:31');
  });
  it('shows a dash for a missing network detail and keeps the ones it has', () => {
    const events = formatAuditEvents(record);
    expect(events[0].ip).toBe('—');
    expect(events[0].device).toBe('—');
    expect(events[1].ip).toBe('87.1.2.3');
    expect(events[2].ip).toBe('—');
    expect(events[2].device).toBe('Safari 26');
  });
  it('shows a dash for an invalid date', () => {
    expect(formatAuditEvents({ ...record, signed_at: 'x' })[2].at).toBe('—');
  });
});

describe('agreementPrintHtml', () => {
  const full = {
    ...record,
    id: 'agr-1',
    version: '2026-11',
    full_name: 'דנה <script>x</script>',
    national_id: '000000018',
    birth_date: '1990-01-31',
    address: 'תל אביב',
    phone: '0501234567',
    email: 'dana@example.test',
    body: 'סעיף 1 <img src=x onerror=alert(1)>',
    signature_png: 'data:image/png;base64,iVBORw0KGgo=',
    body_sha256: 'aaa111',
    record_sha256: 'bbb222',
  };
  it('contains the agreement, signer details, audit events and fingerprints', () => {
    const html = agreementPrintHtml(full);
    for (const text of ['סעיף 1', 'dana@example.test', '31/01/1990', 'נשלח', 'נפתח', 'נחתם', 'agr-1', 'aaa111', 'bbb222', '22/11/2026 12:26']) {
      expect(html).toContain(text);
    }
  });
  it('escapes every stored text so nothing becomes markup', () => {
    const html = agreementPrintHtml(full);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });
});
