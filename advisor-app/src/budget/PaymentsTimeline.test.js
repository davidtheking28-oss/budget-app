import { describe, it, expect } from 'vitest';
import { paymentSchedule, offsetLabel } from './PaymentsTimeline.jsx';

const at = (y, m) => new Date(y, m, 15);

describe('paymentSchedule', () => {
  it('is empty when there is nothing outstanding', () => {
    expect(paymentSchedule([]).periods).toEqual([]);
    expect(paymentSchedule([{ name: 'שולם', total: 6, current: 6, amount: 100 }]).periods).toEqual([]);
  });

  it('ignores plans with no amount', () => {
    expect(paymentSchedule([{ name: 'ריק', total: 6, current: 0, amount: 0 }]).periods).toEqual([]);
  });

  it('describes a single plan as one period that ends', () => {
    const s = paymentSchedule([{ name: 'מקרר', total: 10, current: 4, amount: 250 }]);
    expect(s.monthlyNow).toBe(250);
    expect(s.horizon).toBe(6);
    expect(s.totalLeft).toBe(1500);
    expect(s.periods).toHaveLength(1);
    expect(s.periods[0]).toMatchObject({ months: 6, monthly: 250, monthlyAfter: 0, freed: 250 });
    expect(s.periods[0].ending.map(e => e.name)).toEqual(['מקרר']);
  });

  it('steps the burden down as each plan finishes', () => {
    const s = paymentSchedule([
      { name: 'מקרר', total: 10, current: 7, amount: 250 },   // 3 left
      { name: 'ספה', total: 12, current: 4, amount: 530 },    // 8 left
    ]);
    expect(s.monthlyNow).toBe(780);
    expect(s.horizon).toBe(8);
    expect(s.periods).toHaveLength(2);

    expect(s.periods[0]).toMatchObject({ startOffset: 0, endOffset: 2, months: 3, monthly: 780, monthlyAfter: 530, freed: 250 });
    expect(s.periods[0].ending.map(e => e.name)).toEqual(['מקרר']);

    expect(s.periods[1]).toMatchObject({ startOffset: 3, endOffset: 7, months: 5, monthly: 530, monthlyAfter: 0, freed: 530 });
    expect(s.periods[1].ending.map(e => e.name)).toEqual(['ספה']);
  });

  it('groups plans that end in the same month into one step', () => {
    const s = paymentSchedule([
      { name: 'א', total: 5, current: 2, amount: 100 },
      { name: 'ב', total: 8, current: 5, amount: 200 },
    ]);
    expect(s.periods).toHaveLength(1);
    expect(s.periods[0].freed).toBe(300);
    expect(s.periods[0].ending.map(e => e.name).sort()).toEqual(['א', 'ב']);
    expect(s.periods[0].monthlyAfter).toBe(0);
  });

  it('totalLeft equals the sum of every remaining installment', () => {
    const s = paymentSchedule([
      { name: 'א', total: 10, current: 7, amount: 250 },  // 3 * 250
      { name: 'ב', total: 12, current: 4, amount: 530 },  // 8 * 530
    ]);
    expect(s.totalLeft).toBe(3 * 250 + 8 * 530);
  });

  it('falls back to a default name', () => {
    const s = paymentSchedule([{ name: '   ', total: 3, current: 0, amount: 90 }]);
    expect(s.periods[0].ending[0].name).toBe('תשלום');
  });
});

describe('offsetLabel', () => {
  it('labels the current month at offset 0', () => {
    expect(offsetLabel(0, at(2026, 7), true)).toBe('אוגוסט 2026');
  });

  it('rolls over the year', () => {
    expect(offsetLabel(6, at(2026, 7), true)).toBe('פברואר 2027');
  });

  it('has a short form', () => {
    expect(offsetLabel(2, at(2026, 7))).toBe('אוק׳ 2026');
  });
});
