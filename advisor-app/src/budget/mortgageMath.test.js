import { describe, it, expect } from 'vitest';
import { pmtSpitzer } from './Credit.jsx';
import { trackMonthlyPayment, tracksSummary, amortizationSchedule, yearlyRollup } from './mortgageMath.js';

describe('trackMonthlyPayment', () => {
  it('matches pmtSpitzer for a single track', () => {
    const track = { principal: 100000, annualRate: 5, years: 5 };
    expect(trackMonthlyPayment(track)).toBeCloseTo(pmtSpitzer(100000, 5, 60), 1);
  });
});

describe('tracksSummary', () => {
  it('sums principal and monthly payment across tracks, and takes the longer term', () => {
    const tracks = [
      { principal: 100000, annualRate: 5, years: 5 },
      { principal: 200000, annualRate: 3.5, years: 10 }
    ];
    const s = tracksSummary(tracks);
    expect(s.totalPrincipal).toBe(300000);
    expect(s.totalMonthly).toBeCloseTo(pmtSpitzer(100000, 5, 60) + pmtSpitzer(200000, 3.5, 120), 1);
    expect(s.termMonths).toBe(120);
  });

  it('returns zeros for empty or undefined tracks without throwing', () => {
    expect(tracksSummary([])).toEqual({ totalPrincipal: 0, totalMonthly: 0, termMonths: 0, list: [] });
    expect(tracksSummary(undefined)).toEqual({ totalPrincipal: 0, totalMonthly: 0, termMonths: 0, list: [] });
  });
});

describe('amortizationSchedule', () => {
  it('fully amortizes a single track to zero balance', () => {
    const schedule = amortizationSchedule([{ principal: 100000, annualRate: 5, years: 5 }]);
    expect(schedule.length).toBe(60);
    expect(schedule[0].totalPayment).toBeCloseTo(pmtSpitzer(100000, 5, 60), 1);
    expect(schedule[59].balance).toBeCloseTo(0, 1);
    const totalPrincipalPaid = schedule.reduce((s, r) => s + r.principalPaid, 0);
    expect(totalPrincipalPaid).toBeCloseTo(100000, 0);
  });

  it('drops a shorter track out of the payment after its own term ends', () => {
    const schedule = amortizationSchedule([
      { principal: 50000, annualRate: 5, years: 5 },
      { principal: 200000, annualRate: 4, years: 25 }
    ]);
    expect(schedule.length).toBe(300);
    expect(schedule[60].totalPayment).toBeCloseTo(pmtSpitzer(200000, 4, 300), 1);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].balance).toBeLessThanOrEqual(schedule[i - 1].balance + 0.01);
      expect(schedule[i].balance).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches straight-line amortization at zero rate', () => {
    const schedule = amortizationSchedule([{ principal: 12000, annualRate: 0, years: 1 }]);
    expect(schedule.length).toBe(12);
    expect(schedule[0].principalPaid).toBeCloseTo(1000, 1);
    expect(schedule[0].interestPaid).toBeCloseTo(0, 5);
  });

  it('returns an empty schedule for no tracks', () => {
    expect(amortizationSchedule([])).toEqual([]);
  });
});

describe('yearlyRollup', () => {
  it('compacts a monthly schedule into year rows', () => {
    const schedule = amortizationSchedule([{ principal: 24000, annualRate: 0, years: 2 }]);
    const rollup = yearlyRollup(schedule);
    expect(rollup.length).toBe(2);
    expect(rollup[1].remaining).toBeCloseTo(0, 1);
    const totalPrincipal = rollup.reduce((s, r) => s + r.totalPrincipal, 0);
    expect(totalPrincipal).toBeCloseTo(24000, 0);
  });
});
