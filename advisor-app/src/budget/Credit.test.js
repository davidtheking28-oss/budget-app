import { describe, it, expect } from 'vitest';
import { pmtSpitzer, spitzerPrincipalFromPmt } from './Credit.jsx';

describe('pmtSpitzer', () => {
  it('matches the standard amortization formula (100k @ 5% / 60mo)', () => {
    expect(pmtSpitzer(100000, 5, 60)).toBeCloseTo(1887.12, 1);
  });

  it('divides evenly when the rate is zero', () => {
    expect(pmtSpitzer(50000, 0, 12)).toBeCloseTo(4166.67, 1);
  });

  it('matches the standard formula for a long-term mortgage-scale loan', () => {
    expect(pmtSpitzer(1000000, 4.5, 240)).toBeCloseTo(6326.49, 1);
  });

  it('returns 0 for missing or non-positive inputs', () => {
    expect(pmtSpitzer(0, 5, 60)).toBe(0);
    expect(pmtSpitzer(100000, 5, 0)).toBe(0);
    expect(pmtSpitzer(-100, 5, 60)).toBe(0);
  });
});

describe('spitzerPrincipalFromPmt', () => {
  it('is the inverse of pmtSpitzer', () => {
    const pmt = pmtSpitzer(200000, 3.5, 120);
    expect(spitzerPrincipalFromPmt(pmt, 3.5, 120)).toBeCloseTo(200000, 0);
  });

  it('is the inverse of pmtSpitzer at zero rate', () => {
    const pmt = pmtSpitzer(50000, 0, 12);
    expect(spitzerPrincipalFromPmt(pmt, 0, 12)).toBeCloseTo(50000, 0);
  });

  it('returns 0 for missing or non-positive inputs', () => {
    expect(spitzerPrincipalFromPmt(0, 5, 60)).toBe(0);
    expect(spitzerPrincipalFromPmt(1000, 5, 0)).toBe(0);
  });
});
