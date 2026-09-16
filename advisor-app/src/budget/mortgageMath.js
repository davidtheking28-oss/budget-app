import { pmtSpitzer } from './Credit.jsx';

function normalizeTrack(t) {
  const principal = parseFloat(t.principal) || 0;
  const annualRate = parseFloat(t.annualRate) || 0;
  const years = parseInt(t.years, 10) || 0;
  return { id: t.id, label: t.label, type: t.type, principal, annualRate, years, months: years * 12 };
}

export function trackMonthlyPayment(track) {
  const { principal, annualRate, months } = normalizeTrack(track);
  return pmtSpitzer(principal, annualRate, months);
}

export function tracksSummary(tracks) {
  const list = (tracks || []).map(normalizeTrack);
  const totalPrincipal = list.reduce((s, t) => s + t.principal, 0);
  const totalMonthly = list.reduce((s, t) => s + pmtSpitzer(t.principal, t.annualRate, t.months), 0);
  const termMonths = list.reduce((m, t) => Math.max(m, t.months), 0);
  return { totalPrincipal, totalMonthly, termMonths, list };
}

// Month-by-month combined schedule across all tracks. Each track amortizes
// independently and drops out of the payment once its own term ends —
// matching how mixed Israeli mortgages behave when tracks have different
// lengths.
export function amortizationSchedule(tracks) {
  const list = (tracks || [])
    .map(normalizeTrack)
    .filter(t => t.principal > 0 && t.months > 0)
    .map(t => ({ ...t, pmt: pmtSpitzer(t.principal, t.annualRate, t.months), balance: t.principal }));
  const termMonths = list.reduce((m, t) => Math.max(m, t.months), 0);
  const schedule = [];
  for (let m = 1; m <= termMonths; m++) {
    let totalPayment = 0, principalPaid = 0, interestPaid = 0;
    for (const t of list) {
      if (m > t.months || t.balance <= 0.005) continue;
      const rMonthly = t.annualRate / 1200;
      const interest = t.balance * rMonthly;
      let principal = t.pmt - interest;
      if (m === t.months || principal > t.balance) principal = t.balance;
      t.balance = Math.max(0, t.balance - principal);
      totalPayment += principal + interest;
      principalPaid += principal;
      interestPaid += interest;
    }
    const balance = list.reduce((s, t) => s + t.balance, 0);
    schedule.push({ month: m, totalPayment, principalPaid, interestPaid, balance });
  }
  return schedule;
}

export function yearlyRollup(schedule) {
  const years = [];
  for (let i = 0; i < schedule.length; i += 12) {
    const rows = schedule.slice(i, i + 12);
    years.push({
      year: Math.floor(i / 12) + 1,
      totalPaid: rows.reduce((s, r) => s + r.totalPayment, 0),
      totalInterest: rows.reduce((s, r) => s + r.interestPaid, 0),
      totalPrincipal: rows.reduce((s, r) => s + r.principalPaid, 0),
      remaining: rows[rows.length - 1].balance
    });
  }
  return years;
}
