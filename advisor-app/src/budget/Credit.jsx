import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import { addItem, updateItem, removeItem } from './itemHelpers.js';
import PaymentsTimeline from './PaymentsTimeline.jsx';
import { MONTH_NAMES as MONTHS_HE } from './monthUtils.js';
import MonthTabs from '../components/MonthTabs.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import styles from './Credit.module.css';
import { fmt } from '../format.js';

function monthKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }

function monthsElapsed(fromKey, toKey) {
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function currentInstallments(p, total) {
  const base = parseFloat(p.current) || 0;
  if (!p.currentAnchor) return base;
  const now = new Date();
  return Math.max(0, Math.min(total, base + monthsElapsed(p.currentAnchor, monthKey(now.getFullYear(), now.getMonth()))));
}

export function loanPayoffMonths(remaining, monthly, annualRate) {
  if (!remaining || !monthly || remaining <= 0 || monthly <= 0) return null;
  const r = (annualRate || 0) / 1200;
  if (r <= 0) return Math.ceil(remaining / monthly);
  if (monthly <= remaining * r) return Infinity;
  return Math.ceil(Math.log(monthly / (monthly - remaining * r)) / Math.log(1 + r));
}

function loanPayoffLabel(l) {
  const n = loanPayoffMonths(l.remaining, l.monthly, l.rate);
  if (n === null) return null;
  if (n === Infinity) return { text: 'ההחזר לא מכסה את הריבית, היתרה תגדל', danger: true };
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  const interest = Math.max(0, n * l.monthly - l.remaining);
  const interestText = interest > 1 ? ` · ריבית כוללת ≈ ${fmt(interest)}` : '';
  return { text: `סילוק משוער: ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}${interestText}`, danger: false };
}

export function pmtSpitzer(P, annualRate, months) {
  if (!P || P <= 0 || !months || months <= 0) return 0;
  const r = (annualRate || 0) / 1200;
  if (r <= 0) return P / months;
  return P * r / (1 - Math.pow(1 + r, -months));
}
export function spitzerPrincipalFromPmt(pmt, annualRate, months) {
  if (!pmt || pmt <= 0 || !months || months <= 0) return 0;
  const r = (annualRate || 0) / 1200;
  if (r <= 0) return pmt * months;
  return pmt * (1 - Math.pow(1 + r, -months)) / r;
}

const ICONS = {
  loans: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 3.5" /></svg>,
  payments: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>,
  calc: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" /></svg>,
  merge: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v7a4 4 0 0 0 4 4h4M16 3v7a4 4 0 0 1-4 4M16 3l3 3-3 3M8 3L5 6l3 3" /></svg>,
  home: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
};

export default function Credit({ clientUserId, advisorId, month, onSelectMonth }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);

  const [loanForm, setLoanForm] = useState({ name: '', lender: '', monthly: '', remaining: '', original: '', rate: '' });
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ name: '', total: '', current: '', amount: '' });
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [spForm, setSpForm] = useState({ principal: '', rate: '', months: '' });
  const [spResult, setSpResult] = useState(null);
  const [consolChecked, setConsolChecked] = useState({});
  const [consolPaymentsChecked, setConsolPaymentsChecked] = useState({});
  const [consolOverdraftChecked, setConsolOverdraftChecked] = useState(false);
  const [consolForm, setConsolForm] = useState({ name: '', rate: '', months: '' });
  const [consolResult, setConsolResult] = useState(null);
  const [overdraftDraft, setOverdraftDraft] = useState('');
  const [editingOverdraft, setEditingOverdraft] = useState(false);

  function resetLoanForm() { setLoanForm({ name: '', lender: '', monthly: '', remaining: '', original: '', rate: '' }); setEditingLoanId(null); }
  async function submitLoan() {
    const monthly = parseFloat(loanForm.monthly) || 0;
    if (!loanForm.name.trim() || !monthly) { toast('נדרשים שם הלוואה וסכום חודשי', 'error'); return; }
    const patch = {
      name: loanForm.name.trim(),
      lender: loanForm.lender.trim(),
      monthly,
      remaining: parseFloat(loanForm.remaining) || 0,
      original: parseFloat(loanForm.original) || 0,
      rate: parseFloat(loanForm.rate) || 0
    };
    const ok = editingLoanId != null ? await updateItem(save, 'loans', editingLoanId, patch) : await addItem(save, 'loans', patch);
    if (!ok) return;
    toast(editingLoanId != null ? 'ההלוואה עודכנה' : 'הלוואה נוספה', 'success');
    resetLoanForm();
  }
  function startEditLoan(l) { setEditingLoanId(l.id); setLoanForm({ name: l.name || '', lender: l.lender || '', monthly: l.monthly || '', remaining: l.remaining || '', original: l.original || '', rate: l.rate || '' }); }

  function calcSpitzer() {
    const P = parseFloat(spForm.principal) || 0;
    const rate = parseFloat(spForm.rate) || 0;
    const months = parseInt(spForm.months) || 0;
    if (!P || !months) { toast('נדרשים סכום ותקופה', 'error'); return; }
    const pmt = pmtSpitzer(P, rate, months);
    setSpResult({ pmt, totalInterest: Math.max(0, pmt * months - P), P, rate, months });
  }
  function spitzerToLoan() {
    if (!spResult) return;
    setLoanForm({ name: 'הלוואה (משפיצר)', lender: '', monthly: String(Math.round(spResult.pmt * 100) / 100), remaining: String(spResult.P), original: String(spResult.P), rate: String(spResult.rate) });
  }
  function toggleConsol(id) { setConsolChecked(c => ({ ...c, [id]: !c[id] })); }
  function toggleConsolPayment(id) { setConsolPaymentsChecked(c => ({ ...c, [id]: !c[id] })); }
  function paymentRemainingValue(p) {
    const total = parseFloat(p.total) || 0;
    const left = Math.max(0, total - currentInstallments(p, total));
    return { left, value: left * (parseFloat(p.amount) || 0) };
  }
  function consolSelection(loans, payments) {
    const loanIds = Object.keys(consolChecked).filter(id => consolChecked[id]);
    const paymentIds = Object.keys(consolPaymentsChecked).filter(id => consolPaymentsChecked[id]);
    const includeOverdraft = consolOverdraftChecked && (overdraft.balance || 0) > 0;
    const pickedLoans = loans.filter(l => loanIds.includes(String(l.id)));
    const pickedPayments = payments.filter(p => paymentIds.includes(String(p.id)));
    const loanMonthly = pickedLoans.reduce((s, l) => s + (l.monthly || 0), 0);
    const loanRemaining = pickedLoans.reduce((s, l) => s + (l.remaining || 0), 0);
    const paymentMonthly = pickedPayments.reduce((s, p) => s + (paymentRemainingValue(p).left > 0 ? (parseFloat(p.amount) || 0) : 0), 0);
    const paymentRemaining = pickedPayments.reduce((s, p) => s + paymentRemainingValue(p).value, 0);
    const overdraftAmount = includeOverdraft ? (overdraft.balance || 0) : 0;
    return {
      loanIds, paymentIds, includeOverdraft,
      currentMonthly: loanMonthly + paymentMonthly,
      currentRemaining: loanRemaining + paymentRemaining + overdraftAmount,
      itemCount: loanIds.length + paymentIds.length + (includeOverdraft ? 1 : 0)
    };
  }
  function calcConsolidation(loans, payments) {
    const sel = consolSelection(loans, payments);
    if (sel.itemCount < 1) { toast('בחר לפחות פריט אחד למחזור', 'error'); return; }
    const rate = parseFloat(consolForm.rate) || 0;
    const months = parseInt(consolForm.months) || 0;
    if (!months) { toast('נדרשת תקופה מוצעת', 'error'); return; }
    const newMonthly = pmtSpitzer(sel.currentRemaining, rate, months);
    setConsolResult({ currentMonthly: sel.currentMonthly, currentRemaining: sel.currentRemaining, newMonthly, diff: sel.currentMonthly - newMonthly });
  }
  async function commitConsolidation(loans, payments) {
    const sel = consolSelection(loans, payments);
    if (sel.itemCount < 1) { toast('בחר לפחות פריט אחד למחזור', 'error'); return; }
    const rate = parseFloat(consolForm.rate) || 0;
    const months = parseInt(consolForm.months) || 0;
    if (!months) { toast('נדרשת תקופה מוצעת', 'error'); return; }
    const { loanIds, paymentIds, includeOverdraft } = sel;
    const ok = await save(cur => {
      const curLoans = cur.loans || [];
      const curPayments = cur.payments || [];
      const s = consolSelection(curLoans.filter(l => !l.closed), curPayments.filter(p => !p.closed));
      const newMonthly = pmtSpitzer(s.currentRemaining, rate, months);
      const newLoan = {
        id: Date.now() + Math.random(),
        name: consolForm.name.trim() || 'הלוואה מאוחדת',
        lender: '',
        monthly: Math.round(newMonthly * 100) / 100,
        remaining: s.currentRemaining,
        original: s.currentRemaining,
        rate,
        previousMonthly: s.currentMonthly,
        previousRemaining: s.currentRemaining,
        consolidatedAt: new Date().toISOString()
      };
      return {
        loans: [...curLoans.map(l => loanIds.includes(String(l.id)) ? { ...l, closed: true } : l), newLoan],
        payments: curPayments.map(p => paymentIds.includes(String(p.id)) ? { ...p, closed: true } : p),
        overdraft: includeOverdraft ? { ...(cur.overdraft || {}), balance: 0 } : cur.overdraft
      };
    });
    if (!ok) return;
    toast('המחזור בוצע — נוצרה הלוואה מאוחדת', 'success');
    setConsolChecked({});
    setConsolPaymentsChecked({});
    setConsolOverdraftChecked(false);
    setConsolResult(null);
    setConsolForm({ name: '', rate: '', months: '' });
  }
  async function saveOverdraft() {
    const balance = parseFloat(overdraftDraft) || 0;
    const ok = await save({ overdraft: { balance } });
    if (ok) { setEditingOverdraft(false); toast('יתרת המינוס נשמרה', 'success'); }
  }
  function resetPaymentForm() { setPaymentForm({ name: '', total: '', current: '', amount: '' }); setEditingPaymentId(null); }
  async function submitPayment() {
    const total = parseFloat(paymentForm.total) || 0;
    const amount = parseFloat(paymentForm.amount) || 0;
    if (!paymentForm.name.trim() || !total || !amount) { toast('נדרשים שם, מספר תשלומים וסכום', 'error'); return; }
    const remaining = paymentForm.current === '' ? total : Math.max(0, Math.min(total, parseFloat(paymentForm.current) || 0));
    const patch = { name: paymentForm.name.trim(), total, current: total - remaining, amount, currentAnchor: monthKey(new Date().getFullYear(), new Date().getMonth()) };
    const ok = editingPaymentId != null ? await updateItem(save, 'payments', editingPaymentId, patch) : await addItem(save, 'payments', patch);
    if (!ok) return;
    toast(editingPaymentId != null ? 'התשלום עודכן' : 'התשלום נוסף', 'success');
    resetPaymentForm();
  }
  function startEditPayment(p) { const total = parseFloat(p.total) || 0; setEditingPaymentId(p.id); setPaymentForm({ name: p.name || '', total: p.total || '', current: Math.max(0, total - currentInstallments(p, total)), amount: p.amount || '' }); }

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="60px" radius="8px" style={{ marginBottom: 10 }} />
        <Skeleton height="60px" radius="8px" />
      </div>
    );
  }

  const loans = [...(data.loans || [])].filter(l => !l.closed).sort((a, b) => (b.remaining || 0) - (a.remaining || 0));
  const overdraft = data.overdraft || { balance: 0 };
  const loanMonthsLeft = l => loanPayoffMonths(l.remaining, l.monthly, l.rate);
  const longTermLoans = loans.filter(l => { const n = loanMonthsLeft(l); return n === Infinity || n >= 18; });
  const shortTermLoans = loans.filter(l => { const n = loanMonthsLeft(l); return n !== null && n !== Infinity && n < 18; });
  const unclassifiedLoans = loans.filter(l => loanMonthsLeft(l) === null);
  const payments = [...(data.payments || [])].filter(p => !p.closed).sort((a, b) => {
    const totalA = parseFloat(a.total) || 0;
    const totalB = parseFloat(b.total) || 0;
    const leftA = Math.max(0, totalA - currentInstallments(a, totalA)) * (parseFloat(a.amount) || 0);
    const leftB = Math.max(0, totalB - currentInstallments(b, totalB)) * (parseFloat(b.amount) || 0);
    return leftB - leftA;
  });
  const loansBalance = loans.reduce((s, l) => s + (l.remaining || 0), 0);
  const loansMonthly = loans.reduce((s, l) => s + (l.monthly || 0), 0);
  const paymentsLeft = payments.reduce((s, p) => { const total = parseFloat(p.total) || 0; return s + Math.max(0, total - currentInstallments(p, total)) * (parseFloat(p.amount) || 0); }, 0);

  return (
    <div>
      {onSelectMonth && <MonthTabs month={month} onSelectMonth={onSelectMonth} />}

      {(loans.length > 0 || payments.length > 0) && (
        <div className={styles.statStrip}>
          {loans.length > 0 && <div className={styles.stat}><div className={styles.statValue}>{fmt(loansBalance)}</div><div className={styles.statLabel}>יתרת הלוואות</div></div>}
          {payments.length > 0 && <div className={styles.stat}><div className={styles.statValue}>{fmt(paymentsLeft)}</div><div className={styles.statLabel}>יתרת תשלומים</div></div>}
        </div>
      )}
      <div className={styles.section}>
        <CollapsibleSection title={<><span className={styles.iconChip + ' ' + styles.iconLoans}>{ICONS.loans}</span>הלוואות<span className={styles.countBadge}>{loans.length}</span>{loansMonthly > 0 ? ` · ${fmt(loansMonthly)} לחודש` : ''}</>}>
        {!loans.length && <div className={styles.sectionEmpty}>אין הלוואות רשומות</div>}
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם ההלוואה" aria-label="שם ההלוואה" value={loanForm.name} onChange={e => setLoanForm({ ...loanForm, name: e.target.value })} />
          <input className={styles.input} placeholder="גורם מלווה" aria-label="גורם מלווה" value={loanForm.lender} onChange={e => setLoanForm({ ...loanForm, lender: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="החזר חודשי" aria-label="החזר חודשי להלוואה" value={loanForm.monthly} onChange={e => setLoanForm({ ...loanForm, monthly: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="יתרה" aria-label="יתרת ההלוואה" value={loanForm.remaining} onChange={e => setLoanForm({ ...loanForm, remaining: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום מקורי" aria-label="סכום ההלוואה המקורי" value={loanForm.original} onChange={e => setLoanForm({ ...loanForm, original: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="ריבית שנתית %" aria-label="ריבית שנתית באחוזים" value={loanForm.rate} onChange={e => setLoanForm({ ...loanForm, rate: e.target.value })} />
          <Button onClick={submitLoan}>{editingLoanId != null ? 'שמור' : 'הוסף הלוואה'}</Button>
          {editingLoanId != null && <Button variant="ghost" onClick={resetLoanForm}>ביטול</Button>}
        </div>
        {[['הלוואות ארוכות טווח (18+ חודשים לסיום)', longTermLoans], ['הלוואות קצרות טווח (מתחת ל-18 חודשים לסיום)', shortTermLoans], ['לא ניתן לסווג (חסרה יתרה/ריבית)', unclassifiedLoans]].map(([groupLabel, groupLoans]) => groupLoans.length ? (
          <div key={groupLabel}>
            <div className={styles.sectionEmpty} style={{ fontWeight: 700, color: 'var(--text)', textAlign: 'right', padding: '10px 2px 4px' }}>{groupLabel}</div>
            <div className={styles.grid}>
              {groupLoans.map((l, i) => {
                const pct = l.original ? Math.min(100, Math.max(0, Math.round(((l.original - (l.remaining || 0)) / l.original) * 100))) : null;
                const payoff = loanPayoffLabel(l);
                const danger = payoff?.danger;
                return (
                  <div key={l.id} className={`${styles.row} ${styles.rowCard}${pct !== null ? ` ${styles.rowStacked} ${styles.rowWide}` : ''}${danger ? ' ' + styles.rowDanger : ''}`} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }} role="button" tabIndex={0} onClick={() => startEditLoan(l)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditLoan(l))}>
                    <div className={styles.rowMain}>
                      <div>
                        <div className={styles.name}>{l.name || 'הלוואה'}</div>
                        <div className={styles.meta}>{l.lender ? l.lender + ' · ' : ''}{l.remaining !== undefined ? 'יתרה ' + fmt(l.remaining) + (l.original ? ' מתוך ' + fmt(l.original) : '') : ''}</div>
                      </div>
                      <div className={styles.rowActions}>
                        <div className={styles.amount}>{fmt(l.monthly || 0)}</div>
                        <DeleteButton onClick={e => { e.stopPropagation(); removeItem(save, 'loans', l.id, `${l.name || 'ההלוואה'} נמחקה`); }} />
                      </div>
                    </div>
                    {pct !== null && (
                      <div className={styles.loanBarRow}>
                        <div className={styles.loanBar} role="progressbar" aria-label="אחוז שנפרע" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                          <div className={styles.loanBarFill + (pct >= 70 ? ' ' + styles.loanBarFillGood : '')} style={{ transform: `scaleX(${pct / 100})` }} />
                        </div>
                        <div className={styles.loanBarPct}>{pct}%</div>
                      </div>
                    )}
                    {payoff && <div className={payoff.danger ? styles.payoffDanger : styles.payoffLabel}>{payoff.text}</div>}
                    {l.previousMonthly != null && (
                      <div className={styles.payoffLabel} style={{ color: 'var(--green)' }}>
                        מחזור: היה {fmt(l.previousMonthly)}/חודש ← עכשיו {fmt(l.monthly || 0)}/חודש
                        {l.previousMonthly > (l.monthly || 0) ? ` (חיסכון ${fmt(l.previousMonthly - (l.monthly || 0))})` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null)}
      </CollapsibleSection>
      </div>

      <div className={styles.sectionsGrid}>
      <div className={styles.section}>
        <CollapsibleSection title={<><span className={styles.iconChip + ' ' + styles.iconFixed}>{ICONS.calc}</span>מחשבון שפיצר</>}>
        <div className={styles.form}>
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום הלוואה" aria-label="סכום הלוואה" value={spForm.principal} onChange={e => setSpForm({ ...spForm, principal: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="ריבית שנתית %" aria-label="ריבית שנתית" value={spForm.rate} onChange={e => setSpForm({ ...spForm, rate: e.target.value })} />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="תקופה בחודשים" aria-label="תקופה בחודשים" value={spForm.months} onChange={e => setSpForm({ ...spForm, months: e.target.value })} />
          <Button onClick={calcSpitzer}>חשב</Button>
        </div>
        {spResult && (
          <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div>החזר חודשי: <b>{fmt(spResult.pmt)}</b> · ריבית כוללת: <b>{fmt(spResult.totalInterest)}</b></div>
            <Button variant="ghost" onClick={spitzerToLoan}>+ הוסף כהלוואה</Button>
          </div>
        )}
      </CollapsibleSection>
      </div>

      <div className={styles.section}>
        <CollapsibleSection title={<><span className={styles.iconChip + ' ' + styles.iconFixed}>{ICONS.merge}</span>סימולציית מחזור / איחוד</>}>
        {!loans.length && !payments.length && !(overdraft.balance > 0) && <div className={styles.sectionEmpty}>אין הלוואות, תשלומים או מינוס למחזור</div>}
        {(loans.length > 0 || payments.length > 0 || overdraft.balance > 0) && (
          <>
            <div className={styles.form}>
              <input className={styles.input} placeholder="שם ההלוואה החדשה" aria-label="שם ההלוואה החדשה" value={consolForm.name} onChange={e => setConsolForm({ ...consolForm, name: e.target.value })} />
              <input className={styles.input} type="number" inputMode="decimal" placeholder="ריבית מוצעת %" aria-label="ריבית מוצעת" value={consolForm.rate} onChange={e => setConsolForm({ ...consolForm, rate: e.target.value })} />
              <input className={styles.input} type="number" inputMode="numeric" placeholder="תקופה מוצעת (חודשים)" aria-label="תקופה מוצעת" value={consolForm.months} onChange={e => setConsolForm({ ...consolForm, months: e.target.value })} />
              <Button onClick={() => calcConsolidation(loans, payments)}>חשב חיסכון</Button>
            </div>
            <div className={styles.consolTableWrap}>
              <table className={styles.consolTable}>
                <thead>
                  <tr><th>שם</th><th>סכום</th><th>החזר חודשי</th></tr>
                </thead>
                <tbody>
                  <tr className={styles.consolGroupRow}><td colSpan={3}>הלוואה חדשה</td></tr>
                  <tr>
                    <td>{consolForm.name.trim() || 'הלוואה מאוחדת'}</td>
                    <td>{consolResult ? fmt(consolResult.currentRemaining) : '—'}</td>
                    <td>{consolResult ? fmt(consolResult.newMonthly) : '—'}</td>
                  </tr>
                  {loans.length > 0 && <tr className={styles.consolGroupRow}><td colSpan={3}>הלוואות קיימות</td></tr>}
                  {loans.map(l => (
                    <tr key={l.id}>
                      <td>
                        <label className={styles.consolCheckLabel}>
                          <input type="checkbox" checked={!!consolChecked[l.id]} onChange={() => toggleConsol(l.id)} />
                          {l.name}
                        </label>
                      </td>
                      <td>{fmt(l.remaining || 0)}</td>
                      <td>{fmt(l.monthly || 0)}</td>
                    </tr>
                  ))}
                  {payments.length > 0 && <tr className={styles.consolGroupRow}><td colSpan={3}>תשלומים בכרטיס אשראי</td></tr>}
                  {payments.map(p => {
                    const { left, value } = paymentRemainingValue(p);
                    if (left <= 0) return null;
                    return (
                      <tr key={p.id}>
                        <td>
                          <label className={styles.consolCheckLabel}>
                            <input type="checkbox" checked={!!consolPaymentsChecked[p.id]} onChange={() => toggleConsolPayment(p.id)} />
                            {p.name || 'תשלום'}
                          </label>
                        </td>
                        <td>{fmt(value)}</td>
                        <td>{fmt(p.amount || 0)}</td>
                      </tr>
                    );
                  })}
                  {overdraft.balance > 0 && (
                    <>
                      <tr className={styles.consolGroupRow}><td colSpan={3}>מינוס בבנק</td></tr>
                      <tr>
                        <td>
                          <label className={styles.consolCheckLabel}>
                            <input type="checkbox" checked={consolOverdraftChecked} onChange={() => setConsolOverdraftChecked(v => !v)} />
                            יתרת מינוס
                          </label>
                        </td>
                        <td>{fmt(overdraft.balance)}</td>
                        <td>—</td>
                      </tr>
                    </>
                  )}
                </tbody>
                {consolResult && (
                  <tfoot>
                    <tr>
                      <td>יתרה מההלוואה</td>
                      {/* the consolidated loan is sized to exactly cover the selected remaining balances, so this is always 0 */}
                      <td colSpan={2}>{fmt(0)}</td>
                    </tr>
                    <tr>
                      <td>{consolResult.diff >= 0 ? 'חיסכון בהחזר חודשי' : 'עלות נוספת בהחזר חודשי'}</td>
                      <td colSpan={2} style={{ color: consolResult.diff >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(Math.abs(consolResult.diff))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {consolResult && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Button onClick={() => commitConsolidation(loans, payments)}>בצע מחזור</Button>
              </div>
            )}
          </>
        )}
        <div className={styles.form} style={{ marginTop: 'var(--space-4)' }}>
          {editingOverdraft ? (
            <>
              <input className={styles.input} type="number" inputMode="decimal" placeholder="יתרת מינוס בבנק" aria-label="יתרת מינוס בבנק" value={overdraftDraft} onChange={e => setOverdraftDraft(e.target.value)} />
              <Button onClick={saveOverdraft}>שמור</Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => { setOverdraftDraft(String(overdraft.balance || '')); setEditingOverdraft(true); }}>
              {overdraft.balance > 0 ? `עדכן יתרת מינוס (${fmt(overdraft.balance)})` : '+ הוסף יתרת מינוס בבנק'}
            </Button>
          )}
        </div>
      </CollapsibleSection>
      </div>

      </div>

      <div className={styles.section}>
        <CollapsibleSection title={<><span className={styles.iconChip + ' ' + styles.iconPayments}>{ICONS.payments}</span>תשלומים בכרטיס אשראי<span className={styles.countBadge}>{payments.length}</span>{paymentsLeft > 0 ? ` · ${fmt(paymentsLeft)} נותרו` : ''}</>}>
        {!payments.length && <div className={styles.sectionEmpty}>אין תשלומים בכרטיס אשראי</div>}
        <PaymentsTimeline payments={payments} />
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם העסקה" aria-label="שם העסקה" value={paymentForm.name} onChange={e => setPaymentForm({ ...paymentForm, name: e.target.value })} />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="סה״כ תשלומים" aria-label="סך כל התשלומים" value={paymentForm.total} onChange={e => setPaymentForm({ ...paymentForm, total: e.target.value })} />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="תשלומים שנותרו" aria-label="תשלומים שנותרו" value={paymentForm.current} onChange={e => setPaymentForm({ ...paymentForm, current: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום לתשלום" aria-label="סכום לתשלום" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
          <Button onClick={submitPayment}>{editingPaymentId != null ? 'שמור' : 'הוסף תשלום'}</Button>
          {editingPaymentId != null && <Button variant="ghost" onClick={resetPaymentForm}>ביטול</Button>}
        </div>
        {payments.length ? (
          <div className={styles.grid}>
            {payments.map((p, i) => {
              const total = parseFloat(p.total) || 0;
              const cur = currentInstallments(p, total);
              const left = Math.max(0, total - cur);
              const done = total > 0 && left <= 0;
              const paidPct = total > 0 ? Math.min(100, Math.max(0, Math.round((cur / total) * 100))) : null;
              const showBar = paidPct !== null && !done;
              return (
                <div key={p.id} className={`${styles.row} ${styles.rowCard}${showBar ? ' ' + styles.rowStacked : ''}${done ? ' ' + styles.rowDone : ''}`} style={{ animationDelay: Math.min(i * 0.022, 0.12) + 's' }} role="button" tabIndex={0} onClick={() => startEditPayment(p)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEditPayment(p))}>
                  <div className={styles.rowMain}>
                    <div>
                      <div className={styles.name}>{p.name || 'תשלום'}{done && <span className={styles.doneBadge}><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg> הושלם</span>}</div>
                      <div className={styles.meta}>{total ? `נותרו ${left} מתוך ${total} תשלומים` : ''}</div>
                    </div>
                    <div className={styles.rowActions}>
                      <div className={styles.amount}>{fmt(left * (parseFloat(p.amount) || 0))}</div>
                      <DeleteButton onClick={e => { e.stopPropagation(); removeItem(save, 'payments', p.id, `${p.name || 'התשלום'} נמחק`); }} />
                    </div>
                  </div>
                  {showBar && (
                    <div className={styles.loanBarRow}>
                      <div className={styles.loanBar} role="progressbar" aria-label="אחוז ששולם" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100}>
                        <div className={styles.loanBarFill} style={{ transform: `scaleX(${paidPct / 100})` }} />
                      </div>
                      <div className={styles.loanBarPct}>{paidPct}%</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </CollapsibleSection>
      </div>
    </div>
  );
}
