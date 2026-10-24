import { describe, it, expect } from 'vitest';
import { funnelStats, marketingMetrics, sumMarketing, bucketTasks, projectProgress, percentLabel, ymKey, leadMonthKey } from './bizMath.js';

describe('funnelStats', () => {
  it('computes each conversion step from the previous one', () => {
    const leads = [
      { showed: true, relevant: true, closed: true },
      { showed: true, relevant: true, closed: false },
      { showed: true, relevant: false, closed: false },
      { showed: false, relevant: false, closed: false }
    ];
    const s = funnelStats(leads);
    expect(s.total).toBe(4);
    expect(s.showRate).toBeCloseTo(0.75);
    expect(s.relevantRate).toBeCloseTo(2 / 3);
    expect(s.closeRate).toBeCloseTo(0.5);
    expect(s.closeOfShowedRate).toBeCloseTo(1 / 3);
  });

  it('ignores a relevant or closed flag on a lead that never showed', () => {
    const s = funnelStats([{ showed: false, relevant: true, closed: true }]);
    expect(s.relevant).toBe(0);
    expect(s.closed).toBe(0);
  });

  it('returns null rates on an empty set instead of dividing by zero', () => {
    const s = funnelStats([]);
    expect(s.showRate).toBeNull();
    expect(percentLabel(s.showRate)).toBe('אין');
  });
});

describe('marketingMetrics', () => {
  it('derives costs per follower, meeting and client', () => {
    const m = marketingMetrics({ followers: 100, followersBudget: 500, boosts: 600, meetings: 6, closings: 2 });
    expect(m.costPerFollower).toBe(5);
    expect(m.costPerMeeting).toBe(100);
    expect(m.costPerClient).toBe(300);
    expect(m.closeRate).toBeCloseTo(1 / 3);
    expect(m.budget).toBe(1100);
  });

  it('accepts string input from form fields and leaves empty denominators null', () => {
    const m = marketingMetrics({ followers: '', followersBudget: '200', boosts: '50', meetings: '', closings: '' });
    expect(m.costPerFollower).toBeNull();
    expect(m.costPerMeeting).toBeNull();
    expect(m.budget).toBe(250);
  });

  it('sums months before computing yearly ratios', () => {
    const y = sumMarketing([
      { followers: 10, followersBudget: 100, boosts: 100, meetings: 1, closings: 0 },
      { followers: 30, followersBudget: 100, boosts: 300, meetings: 3, closings: 1 }
    ]);
    expect(y.costPerFollower).toBe(5);
    expect(y.costPerMeeting).toBe(100);
    expect(y.costPerClient).toBe(400);
  });
});

describe('bucketTasks', () => {
  const tasks = [
    { id: 1, dueDate: '2026-10-24' },
    { id: 2, dueDate: '2026-10-20' },
    { id: 3, dueDate: '2026-11-01' },
    { id: 4 },
    { id: 5, dueDate: '2026-10-01', done: true }
  ];
  it('splits open tasks into today, overdue and upcoming; done ones separately', () => {
    const b = bucketTasks(tasks, '2026-10-24');
    expect(b.today.map(t => t.id)).toEqual([1]);
    expect(b.overdue.map(t => t.id)).toEqual([2]);
    expect(b.upcoming.map(t => t.id)).toEqual([3, 4]);
    expect(b.done.map(t => t.id)).toEqual([5]);
  });
});

describe('helpers', () => {
  it('projectProgress counts done steps', () => {
    expect(projectProgress({ steps: [{ done: true }, { done: false }] }).rate).toBe(0.5);
    expect(projectProgress({}).rate).toBeNull();
  });
  it('ymKey pads the month and leadMonthKey reads the contact date', () => {
    expect(ymKey(2026, 0)).toBe('2026-01');
    expect(leadMonthKey({ contacted_at: '2026-10-05' })).toBe('2026-10');
  });
});

import { fixedActiveIn, previousPeriod, monthPeriods, financeMonth, financeRange, expenseBreakdown } from './bizMath.js';

describe('finance periods', () => {
  it('walks months across a year boundary', () => {
    expect(monthPeriods('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(previousPeriod('2026-01')).toBe('2025-12');
  });

  it('keeps a fixed expense active until its end month', () => {
    const e = { fixed: true, startPeriod: '2026-03', endPeriod: '2026-05' };
    expect(fixedActiveIn(e, '2026-02')).toBe(false);
    expect(fixedActiveIn(e, '2026-03')).toBe(true);
    expect(fixedActiveIn(e, '2026-05')).toBe(true);
    expect(fixedActiveIn(e, '2026-06')).toBe(false);
    expect(fixedActiveIn({ fixed: true, startPeriod: '2026-03' }, '2030-01')).toBe(true);
  });
});

describe('financeMonth', () => {
  const entries = [
    { type: 'income', period: '2026-10', amount: 11800, clearing: 0, receipt: true },
    { type: 'expense', fixed: true, startPeriod: '2026-09', amount: 1000, category: 'שיווק' },
    { type: 'expense', period: '2026-10', amount: 500, receipt: false, category: 'שירות' }
  ];

  it('removes VAT only for a licensed dealer', () => {
    const licensed = financeMonth(entries, '2026-10', 'עוסק מורשה');
    expect(licensed.afterVat).toBeCloseTo(10000);
    expect(licensed.vat).toBeCloseTo(1800);
    const exempt = financeMonth(entries, '2026-10', 'עוסק פטור');
    expect(exempt.vat).toBe(0);
    expect(exempt.afterVat).toBe(11800);
  });

  it('carries fixed expenses forward and taxes only a positive operating profit', () => {
    const m = financeMonth(entries, '2026-10', 'עוסק מורשה');
    expect(m.fixedTotal).toBe(1000);
    expect(m.variableTotal).toBe(500);
    expect(m.operating).toBeCloseTo(8500);
    expect(m.incomeTax).toBeCloseTo(850);
    expect(m.nationalInsurance).toBeCloseTo(1020);
    expect(m.net).toBeCloseTo(6630);
    expect(m.missingReceipts).toBe(1);
    expect(financeMonth([{ type: 'expense', period: '2026-10', amount: 100, receipt: true }], '2026-10', 'עוסק פטור').incomeTax).toBe(0);
  });

  it('does not count a fixed expense before its start month', () => {
    expect(financeMonth(entries, '2026-08', 'עוסק פטור').fixedTotal).toBe(0);
  });

  it('sums a range and breaks expenses down by category', () => {
    const r = financeRange(entries, '2026-09', '2026-10', 'עוסק מורשה');
    expect(r.rows).toHaveLength(2);
    expect(r.expenses).toBe(2500);
    const b = expenseBreakdown(entries.filter(e => e.type === 'expense'));
    expect(b[0]).toMatchObject({ category: 'שיווק', value: 1000 });
    expect(b[0].share).toBeCloseTo(2 / 3);
  });
});
