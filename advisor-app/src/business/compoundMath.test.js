import { describe, expect, it } from 'vitest';
import { simulate, requiredMonthly } from './compoundMath.js';

describe('compoundMath', () => {
  it('matches the reference defaults: 10,000 + 1,000/month for 10 years at 7%, 0.5% accumulation fee', () => {
    const r = simulate({});
    expect(Math.round(r.deposited)).toBe(130000);
    expect(Math.round(r.gross)).toBe(185474);
    expect(Math.round(r.feeCost)).toBe(5249);
    expect(Math.round(r.tax)).toBe(13868);
    expect(Math.round(r.net)).toBe(171605);
  });

  it('skips tax when switched off', () => {
    const r = simulate({ withTax: false });
    expect(r.tax).toBe(0);
    expect(Math.round(r.net)).toBe(185474);
  });

  it('never taxes a loss', () => {
    const r = simulate({ returnPct: -5, feeAccumPct: 0 });
    expect(r.tax).toBe(0);
  });

  it('solves the monthly deposit needed for a net target', () => {
    const m = requiredMonthly(1000000, { years: 15 });
    expect(Math.round(m)).toBe(3636);
    expect(Math.round(simulate({ monthly: m, years: 15 }).net)).toBe(1000000);
  });

  it('returns one row per year, ending at the last year', () => {
    const r = simulate({ years: 3 });
    expect(r.rows.map(x => x.year)).toEqual([1, 2, 3]);
    expect(Math.round(r.rows[2].gross)).toBe(Math.round(r.gross));
  });
});
