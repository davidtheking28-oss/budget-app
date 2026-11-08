import { describe, it, expect } from 'vitest';
import { getMonthTx, loanMonthsLeft, isLoanEnded } from './monthUtils.js';

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

describe('loan months left', () => {
  const monthAgo = n => { const d = new Date(); d.setMonth(d.getMonth() - n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const thisMonth = monthAgo(0);
  it('is unknown when no remaining payments were entered', () => {
    expect(loanMonthsLeft({})).toBe(null);
    expect(loanMonthsLeft({ monthsLeft: 0 })).toBe(null);
    expect(isLoanEnded({ monthsLeft: 0 })).toBe(false);
  });
  it('counts down one payment per calendar month from the anchor', () => {
    expect(loanMonthsLeft({ monthsLeft: 6, monthsLeftAnchor: thisMonth })).toBe(6);
    expect(loanMonthsLeft({ monthsLeft: 6, monthsLeftAnchor: monthAgo(2) })).toBe(4);
  });
  it('ends the loan when the payments run out and never goes negative', () => {
    expect(isLoanEnded({ monthsLeft: 3, monthsLeftAnchor: monthAgo(3) })).toBe(true);
    expect(loanMonthsLeft({ monthsLeft: 3, monthsLeftAnchor: monthAgo(10) })).toBe(0);
  });
  it('keeps a legacy static value without an anchor', () => {
    expect(loanMonthsLeft({ monthsLeft: 12 })).toBe(12);
    expect(isLoanEnded({ monthsLeft: 12 })).toBe(false);
  });
});
