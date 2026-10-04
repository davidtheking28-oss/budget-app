import { describe, it, expect } from 'vitest';
import { getMonthTx } from './monthUtils.js';

describe('getMonthTx', () => {
  const tx = [
    { id: 1, type: 'expense', cat: 'בריאות', desc: 'ביטוח בריאות', amount: 116, date: '2026-10-18' },
    { id: 2, type: 'expense', cat: 'בריאות', desc: 'תרופות', amount: 123, date: '2026-10-02' },
    { id: 3, type: 'expense', cat: 'בריאות', desc: 'ביטוח בריאות', amount: 90, date: '2026-09-18' }
  ];

  it('moves health-insurance charges out of the health category', () => {
    const out = getMonthTx(tx, 2026, 9);
    expect(out.find(t => t.id === 1).cat).toBe('ביטוחים');
    expect(out.find(t => t.id === 2).cat).toBe('בריאות');
  });

  it('drops the legacy health-insurance charge when the standing insurance expense exists', () => {
    const withFx = [...tx, { id: 4, type: 'expense', cat: 'ביטוחים', desc: 'ביטוחים', amount: 117, date: '2026-10-01', fx: true }];
    const out = getMonthTx(withFx, 2026, 9);
    expect(out.map(t => t.id).sort()).toEqual([2, 4]);
  });

  it('only returns the requested month', () => {
    expect(getMonthTx(tx, 2026, 9)).toHaveLength(2);
  });
});
