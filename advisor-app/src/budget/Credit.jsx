import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import { addItem, updateItem, removeItem } from './itemHelpers.js';
import PaymentsTimeline from './PaymentsTimeline.jsx';
import { monthSummary } from './budgetMath.js';
import styles from './Subscriptions.module.css';

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');
const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

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
  payments: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>
};

export default function Credit({ clientUserId, advisorId, year, month }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);

  const [loanForm, setLoanForm] = useState({ name: '', lender: '', monthly: '', remaining: '', original: '', rate: '' });
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ name: '', total: '', current: '', amount: '' });
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [spForm, setSpForm] = useState({ principal: '', rate: '', months: '' });
  const [spResult, setSpResult] = useState(null);
  const [consolChecked, setConsolChecked] = useState({});
  const [consolForm, setConsolForm] = useState({ rate: '', months: '' });
  const [consolResult, setConsolResult] = useState(null);
  const [mtgForm, setMtgForm] = useState({ ratio: '40', rate: '', years: '' });
  const [mtgResult, setMtgResult] = useState(null);

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
  function calcConsolidation(loans) {
    const ids = Object.keys(consolChecked).filter(id => consolChecked[id]);
    if (ids.length < 2) { toast('בחר לפחות 2 הלוואות לאיחוד', 'error'); return; }
    const picked = loans.filter(l => ids.includes(String(l.id)));
    const currentMonthly = picked.reduce((s, l) => s + (l.monthly || 0), 0);
    const currentRemaining = picked.reduce((s, l) => s + (l.remaining || 0), 0);
    const rate = parseFloat(consolForm.rate) || 0;
    const months = parseInt(consolForm.months) || 0;
    if (!months) { toast('נדרשת תקופה מוצעת', 'error'); return; }
    const newMonthly = pmtSpitzer(currentRemaining, rate, months);
    setConsolResult({ currentMonthly, newMonthly, diff: currentMonthly - newMonthly });
  }
  function calcMortgage(disposable) {
    const ratio = parseFloat(mtgForm.ratio) || 40;
    const rate = parseFloat(mtgForm.rate) || 0;
    const years = parseInt(mtgForm.years) || 0;
    if (!years) { toast('נדרשת תקופה בשנים', 'error'); return; }
    const maxPmt = disposable * ratio / 100;
    const maxPrincipal = spitzerPrincipalFromPmt(maxPmt, rate, years * 12);
    setMtgResult({ disposable, maxPmt, maxPrincipal });
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

  const disposable = Math.max(0, monthSummary(data, year, month).net);
  const loans = [...(data.loans || [])].sort((a, b) => (b.remaining || 0) - (a.remaining || 0));
  const loanMonthsLeft = l => loanPayoffMonths(l.remaining, l.monthly, l.rate);
  const longTermLoans = loans.filter(l => { const n = loanMonthsLeft(l); return n === Infinity || n >= 18; });
  const shortTermLoans = loans.filter(l => { const n = loanMonthsLeft(l); return n !== null && n !== Infinity && n < 18; });
  const unclassifiedLoans = loans.filter(l => loanMonthsLeft(l) === null);
  const payments = [...(data.payments || [])].sort((a, b) => {
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
      {(loans.length > 0 || payments.length > 0) && (
        <div className={styles.statStrip}>
          {loans.length > 0 && <div className={styles.stat}><div className={styles.statValue}>{fmt(loansBalance)}</div><div className={styles.statLabel}>יתרת הלוואות</div></div>}
          {payments.length > 0 && <div className={styles.stat}><div className={styles.statValue}>{fmt(paymentsLeft)}</div><div className={styles.statLabel}>יתרת תשלומים</div></div>}
        </div>
      )}
      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconLoans}>{ICONS.loans}</span>הלוואות<span className={styles.countBadge}>{loans.length}</span>{loansMonthly > 0 ? ` · ${fmt(loansMonthly)} לחודש` : ''}</div>
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
                        <DeleteButton onClick={e => { e.stopPropagation(); removeItem(save, 'loans', l.id); }} />
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
                  </div>
                );
              })}
            </div>
          </div>
        ) : null)}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>🧮 מחשבון שפיצר</div>
        <div className={styles.form}>
          <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום הלוואה" aria-label="סכום הלוואה" value={spForm.principal} onChange={e => setSpForm({ ...spForm, principal: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="ריבית שנתית %" aria-label="ריבית שנתית" value={spForm.rate} onChange={e => setSpForm({ ...spForm, rate: e.target.value })} />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="תקופה בחודשים" aria-label="תקופה בחודשים" value={spForm.months} onChange={e => setSpForm({ ...spForm, months: e.target.value })} />
          <Button onClick={calcSpitzer}>חשב</Button>
        </div>
        {spResult && (
          <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div>החזר חודשי: <b>{fmt(spResult.pmt)}</b> · ריבית כוללת: <b>{fmt(spResult.totalInterest)}</b></div>
            <Button variant="ghost" onClick={spitzerToLoan}>➕ הוסף כהלוואה</Button>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>🔀 סימולציית איחוד הלוואות</div>
        {!loans.length && <div className={styles.sectionEmpty}>אין הלוואות לאיחוד</div>}
        {loans.length ? (
          <div className={styles.list}>
            {loans.map(l => (
              <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', padding: '6px 0' }}>
                <input type="checkbox" checked={!!consolChecked[l.id]} onChange={() => toggleConsol(l.id)} />
                {l.name} · {fmt(l.monthly || 0)}/חודש
              </label>
            ))}
          </div>
        ) : null}
        <div className={styles.form}>
          <input className={styles.input} type="number" inputMode="decimal" placeholder="ריבית מוצעת %" aria-label="ריבית מוצעת" value={consolForm.rate} onChange={e => setConsolForm({ ...consolForm, rate: e.target.value })} />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="תקופה מוצעת (חודשים)" aria-label="תקופה מוצעת" value={consolForm.months} onChange={e => setConsolForm({ ...consolForm, months: e.target.value })} />
          <Button onClick={() => calcConsolidation(loans)}>חשב חיסכון</Button>
        </div>
        {consolResult && (
          <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div>החזר חודשי מאוחד: <b>{fmt(consolResult.newMonthly)}</b></div>
            <div>{consolResult.diff >= 0 ? 'חיסכון' : 'עלות נוספת'} לחודש: <b style={{ color: consolResult.diff >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(Math.abs(consolResult.diff))}</b></div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>🏠 מחשבון משכנתא / יכולת החזר</div>
        <div className={styles.form}>
          <input className={styles.input} type="number" inputMode="decimal" placeholder="אחוז מקסימלי מההכנסה הפנויה" aria-label="אחוז מקסימלי" value={mtgForm.ratio} onChange={e => setMtgForm({ ...mtgForm, ratio: e.target.value })} />
          <input className={styles.input} type="number" inputMode="decimal" placeholder="ריבית שנתית מוצעת %" aria-label="ריבית שנתית מוצעת" value={mtgForm.rate} onChange={e => setMtgForm({ ...mtgForm, rate: e.target.value })} />
          <input className={styles.input} type="number" inputMode="numeric" placeholder="תקופה (שנים)" aria-label="תקופה בשנים" value={mtgForm.years} onChange={e => setMtgForm({ ...mtgForm, years: e.target.value })} />
          <Button onClick={() => calcMortgage(disposable)}>חשב</Button>
        </div>
        {mtgResult && (
          <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>הכנסה פנויה חודשית מוערכת: {fmt(mtgResult.disposable)}</div>
            <div>החזר מקסימלי מומלץ: <b>{fmt(mtgResult.maxPmt)}</b></div>
            <div>משכנתא נתמכת: <b>{fmt(mtgResult.maxPrincipal)}</b></div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span className={styles.iconChip + ' ' + styles.iconPayments}>{ICONS.payments}</span>תשלומים בכרטיס אשראי<span className={styles.countBadge}>{payments.length}</span>{paymentsLeft > 0 ? ` · ${fmt(paymentsLeft)} נותרו` : ''}</div>
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
                      <DeleteButton onClick={e => { e.stopPropagation(); removeItem(save, 'payments', p.id); }} />
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
      </div>
    </div>
  );
}
