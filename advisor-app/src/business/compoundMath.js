export const COMPOUND_DEFAULTS = {
  initial: 10000,
  monthly: 1000,
  years: 10,
  returnPct: 7,
  feeDepositPct: 0,
  feeAccumPct: 0.5,
  taxPct: 25,
  withTax: true
};

function grow({ initial, monthly, years, returnPct, feeDepositPct, feeAccumPct }) {
  const n = Math.round(years * 12);
  const i = Math.pow(1 + (returnPct - feeAccumPct) / 100, 1 / 12) - 1;
  const net = monthly * (1 - feeDepositPct / 100);
  let balance = initial;
  let deposited = initial;
  const rows = [];
  for (let k = 1; k <= n; k++) {
    balance = balance * (1 + i) + net;
    deposited += monthly;
    if (k % 12 === 0 || k === n) rows.push({ year: Math.ceil(k / 12), gross: balance, deposited });
  }
  return { gross: balance, deposited, rows };
}

export function simulate(params) {
  const p = { ...COMPOUND_DEFAULTS, ...params };
  const { gross, deposited, rows } = grow(p);
  const noFee = grow({ ...p, feeDepositPct: 0, feeAccumPct: 0 });
  const profit = gross - deposited;
  const tax = p.withTax ? Math.max(0, profit) * (p.taxPct / 100) : 0;
  return {
    gross,
    deposited,
    profit,
    feeCost: Math.max(0, noFee.gross - gross),
    tax,
    net: gross - tax,
    rows
  };
}

export function requiredMonthly(target, params) {
  const p = { ...COMPOUND_DEFAULTS, ...params };
  const at0 = simulate({ ...p, monthly: 0 }).net;
  const at1 = simulate({ ...p, monthly: 1 }).net;
  const slope = at1 - at0;
  if (slope <= 0) return null;
  return Math.max(0, (target - at0) / slope);
}
