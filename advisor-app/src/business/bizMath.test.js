import { describe, it, expect } from 'vitest';
import { funnelStats, marketingMetrics, sumMarketing, financeSummary, bucketTasks, projectProgress, percentLabel, ymKey, leadMonthKey } from './bizMath.js';

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

describe('financeSummary', () => {
  it('computes net, margin and missing receipts on expenses only', () => {
    const s = financeSummary([
      { type: 'income', amount: 10000 },
      { type: 'expense', amount: 2000, receipt: true },
      { type: 'expense', amount: 1000, receipt: false },
      { type: 'income', amount: '0', receipt: false }
    ]);
    expect(s.net).toBe(7000);
    expect(s.margin).toBeCloseTo(0.7);
    expect(s.missingReceipts).toBe(1);
  });

  it('has no margin without income', () => {
    expect(financeSummary([{ type: 'expense', amount: 50, receipt: true }]).margin).toBeNull();
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
