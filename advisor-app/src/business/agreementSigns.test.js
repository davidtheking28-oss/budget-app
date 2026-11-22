import { describe, expect, it } from 'vitest';
import { summarizeSigns } from './agreementSigns.js';

describe('summarizeSigns', () => {
  it('marks signed clients and counts agreements the advisor has not opened', () => {
    const agreements = [
      { id: 'a1', user_id: 'c1' },
      { id: 'a2', user_id: 'c2' },
      { id: 'a3', user_id: 'c2' },
    ];
    const views = [{ agreement_id: 'a1' }];
    const out = summarizeSigns(agreements, views);
    expect([...out.signedClientIds].sort()).toEqual(['c1', 'c2']);
    expect(out.unseenCount).toBe(2);
    expect([...out.unseenClientIds]).toEqual(['c2']);
  });

  it('is empty without agreements and ignores views of unknown agreements', () => {
    const out = summarizeSigns([], [{ agreement_id: 'x' }]);
    expect(out.signedClientIds.size).toBe(0);
    expect(out.unseenCount).toBe(0);
    expect(out.unseenClientIds.size).toBe(0);
  });

  it('tolerates missing input', () => {
    expect(summarizeSigns(undefined, undefined).unseenCount).toBe(0);
  });
});
