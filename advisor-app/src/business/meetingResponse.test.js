import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
let result = { data: { id: 'm', status: 'confirmed' }, error: null };
vi.mock('../supabaseClient.js', () => ({
  supabase: {
    from: table => {
      const q = {
        update: patch => { calls.push(['update', table, patch]); return q; },
        eq: (col, val) => { calls.push(['eq', col, val]); return q; },
        select: () => q,
        single: () => Promise.resolve(result)
      };
      return q;
    }
  }
}));
vi.mock('../toast.js', () => ({ toast: vi.fn() }));
vi.mock('../crm/useClientCrm.js', () => ({ notifyMeetingInstant: vi.fn() }));

import { toast } from '../toast.js';
import { notifyMeetingInstant } from '../crm/useClientCrm.js';
import { respondToMeeting } from './meetingResponse.js';

beforeEach(() => { calls.length = 0; toast.mockClear(); notifyMeetingInstant.mockReset(); result = { data: { id: 'm', status: 'confirmed' }, error: null }; });

describe('advisor answering a pending meeting', () => {
  it('confirms scoped to the advisor and the meeting, then toasts', async () => {
    expect(await respondToMeeting('adv', 'm', 'confirmed')).toBe(true);
    expect(calls).toEqual([['update', 'advisor_meetings', { status: 'confirmed' }], ['eq', 'id', 'm'], ['eq', 'advisor_id', 'adv']]);
    expect(toast).toHaveBeenCalledWith('הפגישה אושרה', 'success');
  });
  it('tells the client right away when a meeting is approved, and says so', async () => {
    notifyMeetingInstant.mockResolvedValue(1);
    expect(await respondToMeeting('adv', 'm', 'confirmed')).toBe(true);
    expect(notifyMeetingInstant).toHaveBeenCalledWith('m', 'confirmed');
    expect(toast).toHaveBeenCalledWith('הפגישה אושרה והלקוח קיבל התראה', 'success');
  });
  it('warns the advisor when the client has notifications off', async () => {
    notifyMeetingInstant.mockResolvedValue(0);
    await respondToMeeting('adv', 'm', 'confirmed');
    expect(toast).toHaveBeenCalledWith('הפגישה אושרה. ללקוח לא מופעלות התראות, כדאי לעדכן אותו בעצמך', 'success');
  });
  it('does not notify the client of a decline', async () => {
    result = { data: { id: 'm', status: 'declined' }, error: null };
    await respondToMeeting('adv', 'm', 'declined');
    expect(notifyMeetingInstant).not.toHaveBeenCalled();
  });
  it('does not notify when the update failed', async () => {
    result = { data: null, error: { message: 'boom' } };
    await respondToMeeting('adv', 'm', 'confirmed');
    expect(notifyMeetingInstant).not.toHaveBeenCalled();
  });
  it('declines with its own message', async () => {
    result = { data: { id: 'm', status: 'declined' }, error: null };
    expect(await respondToMeeting('adv', 'm', 'declined')).toBe(true);
    expect(toast).toHaveBeenCalledWith('הפגישה נדחתה', 'success');
  });
  it('reports failure without claiming success', async () => {
    result = { data: null, error: { message: 'boom' } };
    expect(await respondToMeeting('adv', 'm', 'confirmed')).toBe(false);
    expect(toast).toHaveBeenCalledWith('שגיאה בעדכון הפגישה', 'error');
  });
  it('treats a zero-row update as failure', async () => {
    result = { data: null, error: { code: 'PGRST116' } };
    expect(await respondToMeeting('adv', 'm', 'confirmed')).toBe(false);
  });
});
