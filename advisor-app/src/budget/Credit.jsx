import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import AddForm from '../components/AddForm.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import ActionMenu from '../components/ActionMenu.jsx';
import EditButton from '../components/EditButton.jsx';
import { toast } from '../toast.js';
import { addItem, updateItem, removeItem } from './itemHelpers.js';
import { localISODate, formatDate } from './monthUtils.js';
import CreditCards from './CreditCards.jsx';
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

const EMPTY_LOAN = { name: '', monthly: '', remaining: '', original: '', rate: '', asOf: '' };
const EMPTY_PAYMENT = { card: '', name: '', total: '', current: '', amount: '' };

function StatusToggle({ hidden, name, onToggle }) {
  return (
    <button type="button" className={styles.statusBtn} aria-pressed={!hidden} aria-label={(hidden ? 'הצג בחישוב · ' : 'הסתר מהחישוב · ') + name} title={hidden ? 'מוסתר מהחישוב' : 'נכלל בחישוב'} onClick={e => { e.stopPropagation(); onToggle(); }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        {hidden && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}

export default function Credit({ clientUserId, advisorId, focus }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [editingPaymentId, setEditingPaymentId] = useState(null);

  function resetLoanForm() { setLoanForm(EMPTY_LOAN); setEditingLoanId(null); }
  async function submitLoan() {
    const monthly = parseFloat(loanForm.monthly) || 0;
    if (!loanForm.name.trim() || !monthly) { toast('נדרשים שם החוב והחזר חודשי', 'error'); return; }
    const patch = {
      name: loanForm.name.trim(),
      monthly,
      remaining: parseFloat(loanForm.remaining) || 0,
      original: parseFloat(loanForm.original) || 0,
      rate: parseFloat(loanForm.rate) || 0,
      asOf: loanForm.asOf || localISODate()
    };
    const ok = editingLoanId != null ? await updateItem(save, 'loans', editingLoanId, patch) : await addItem(save, 'loans', patch);
    if (!ok) return;
    toast(editingLoanId != null ? 'ההלוואה עודכנה' : 'הלוואה נוספה', 'success');
    resetLoanForm();
  }
  function startEditLoan(l) { setEditingLoanId(l.id); setLoanForm({ name: l.name || '', monthly: l.monthly || '', remaining: l.remaining || '', original: l.original || '', rate: l.rate || '', asOf: l.asOf || '' }); }

  function resetPaymentForm() { setPaymentForm(EMPTY_PAYMENT); setEditingPaymentId(null); }
  async function submitPayment() {
    const total = parseFloat(paymentForm.total) || 0;
    const amount = parseFloat(paymentForm.amount) || 0;
    if (!paymentForm.name.trim() || !total || !amount) { toast('נדרשים שם העסק, מספר תשלומים וסכום', 'error'); return; }
    const current = paymentForm.current === '' ? 0 : Math.max(0, Math.min(total, parseFloat(paymentForm.current) || 0));
    const now = new Date();
    const patch = { card: paymentForm.card, name: paymentForm.name.trim(), total, current, amount, currentAnchor: monthKey(now.getFullYear(), now.getMonth()) };
    const ok = editingPaymentId != null ? await updateItem(save, 'payments', editingPaymentId, patch) : await addItem(save, 'payments', patch);
    if (!ok) return;
    toast(editingPaymentId != null ? 'העסקה עודכנה' : 'העסקה נוספה', 'success');
    resetPaymentForm();
  }
  function startEditPayment(p) { const total = parseFloat(p.total) || 0; setEditingPaymentId(p.id); setPaymentForm({ card: p.card || '', name: p.name || '', total: p.total || '', current: currentInstallments(p, total), amount: p.amount || '' }); }

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="60px" radius="8px" style={{ marginBottom: 10 }} />
        <Skeleton height="60px" radius="8px" />
      </div>
    );
  }

  if (focus === 'cards') return <CreditCards settings={data.settings} save={save} />;

  const cards = data.settings?.creditCards || [];
  const loans = (data.loans || []).filter(l => !l.closed);
  const activeLoans = loans.filter(l => !l.hidden);
  const loansMonthly = activeLoans.reduce((s, l) => s + (l.monthly || 0), 0);
  const loansBalance = activeLoans.reduce((s, l) => s + (l.remaining || 0), 0);
  const loansLeft = activeLoans.reduce((s, l) => { const n = loanPayoffMonths(l.remaining, l.monthly, l.rate); return s + (n && n !== Infinity ? n * l.monthly : l.remaining || 0); }, 0);

  const payments = (data.payments || []).filter(p => !p.closed).filter(p => { const t = parseFloat(p.total) || 0; return !(t > 0 && t - currentInstallments(p, t) <= 0); });
  const activePayments = payments.filter(p => !p.hidden);
  const paymentsMonthly = activePayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const paymentsLeft = activePayments.reduce((s, p) => { const t = parseFloat(p.total) || 0; return s + Math.max(0, t - currentInstallments(p, t)) * (parseFloat(p.amount) || 0); }, 0);

  if (focus === 'payments') {
    return (
      <div className={styles.section}>
        <CollapsibleSection title={<>עסקאות בתשלומים<span className={styles.countBadge}>{payments.length}</span></>}>
          <p className={styles.summaryLine}>החזר חודשי {fmt(paymentsMonthly)} · נותר לשלם {fmt(paymentsLeft)}</p>
          <p className={styles.sectionEmpty} style={{ textAlign: 'right' }}>"תשלום נוכחי" מתקדם לבד חודש-חודש, והעסקה נעלמת כשהיא נגמרת.</p>
          {payments.length > 0 && (
            <div className={styles.loanTableWrap} role="region" aria-label="טבלת עסקאות בתשלומים, גלול לצפייה בכל השורות" tabIndex={0}>
              <table className={styles.loanTable}>
                <thead><tr><th>מספר כרטיס</th><th>שם העסק</th><th>מס׳ תשלומים</th><th>תשלום נוכחי</th><th>נכון לתאריך</th><th>סכום תשלום</th><th>מצב</th><th><span className={styles.srOnly}>פעולות</span></th></tr></thead>
                <tbody>
                  {payments.map(p => {
                    const total = parseFloat(p.total) || 0;
                    return (
                      <tr key={p.id} className={styles.loanTr + (p.hidden ? ' ' + styles.rowHidden : '')} onClick={() => startEditPayment(p)}>
                        <td>{p.card ? `•••• ${p.card}` : '—'}</td>
                        <td><div className={styles.name}>{p.name || 'עסקה'}</div></td>
                        <td>{total || '—'}</td>
                        <td>{total ? currentInstallments(p, total) : '—'}</td>
                        <td>{formatDate(localISODate())}</td>
                        <td className={styles.loanMonthly}>{fmt(parseFloat(p.amount) || 0)}</td>
                        <td><StatusToggle hidden={!!p.hidden} name={p.name || 'עסקה'} onToggle={() => updateItem(save, 'payments', p.id, { hidden: !p.hidden })} /></td>
                        <td className={styles.loanActions}>
                          <ActionMenu><EditButton title={`ערוך · ${p.name || 'העסקה'}`} onClick={e => { e.stopPropagation(); startEditPayment(p); }} /><DeleteButton title={`מחק · ${p.name || 'העסקה'}`} onClick={e => { e.stopPropagation(); removeItem(save, 'payments', p.id, `${p.name || 'העסקה'} נמחקה`); }} /></ActionMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <AddForm label="הוספת עסקה" open={editingPaymentId != null} className={styles.form}>
            <label className={styles.formField}>מספר כרטיס<select className={styles.input} aria-label="מספר כרטיס" value={paymentForm.card} onChange={e => setPaymentForm({ ...paymentForm, card: e.target.value })}>
              <option value="">מספר כרטיס</option>
              {[...new Set([...cards.map(c => c.last4).filter(Boolean), paymentForm.card].filter(Boolean))].map(n => <option key={n} value={n}>•••• {n}</option>)}
            </select></label>
            <label className={styles.formField}>שם העסק<input className={styles.input} placeholder="שם העסק" aria-label="שם העסק" value={paymentForm.name} onChange={e => setPaymentForm({ ...paymentForm, name: e.target.value })} /></label>
            <label className={styles.formField}>מספר תשלומים<input className={styles.input} type="number" inputMode="numeric" placeholder="מס׳ תשלומים" aria-label="מספר תשלומים" value={paymentForm.total} onChange={e => setPaymentForm({ ...paymentForm, total: e.target.value })} /></label>
            <label className={styles.formField}>תשלום נוכחי<input className={styles.input} type="number" inputMode="numeric" placeholder="תשלום נוכחי" aria-label="תשלום נוכחי" value={paymentForm.current} onChange={e => setPaymentForm({ ...paymentForm, current: e.target.value })} /></label>
            <label className={styles.formField}>סכום תשלום<input className={styles.input} type="number" inputMode="decimal" placeholder="סכום תשלום" aria-label="סכום תשלום" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></label>
            <Button onClick={submitPayment}>{editingPaymentId != null ? 'שמור' : 'הוספת עסקה'}</Button>
            {editingPaymentId != null && <Button variant="ghost" onClick={resetPaymentForm}>ביטול</Button>}
          </AddForm>
        </CollapsibleSection>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <CollapsibleSection title={<>חובות והלוואות<span className={styles.countBadge}>{loans.length}</span></>}>
        <p className={styles.summaryLine}>החזר חודשי {fmt(loansMonthly)} · יתרת קרן {fmt(loansBalance)} · נותר לשלם {fmt(loansLeft)}</p>
        <p className={styles.sectionEmpty} style={{ textAlign: 'right' }}>ההחזר של ההלוואות הפעילות נכלל בחישוב, והעין מסתירה הלוואה מהחישוב.</p>
        {loans.length > 0 && (
          <div className={styles.loanTableWrap} role="region" aria-label="טבלת הלוואות, גלול לצפייה בכל השורות" tabIndex={0}>
            <table className={styles.loanTable}>
              <thead><tr><th>שם החוב</th><th>סכום מקורי</th><th>יתרת קרן</th><th>נכון לתאריך</th><th>ריבית %</th><th>תשלומים שנותרו</th><th>החזר חודשי</th><th>מצב</th><th><span className={styles.srOnly}>פעולות</span></th></tr></thead>
              <tbody>
                {loans.map(l => {
                  const left = loanPayoffMonths(l.remaining, l.monthly, l.rate);
                  return (
                    <tr key={l.id} className={styles.loanTr + (l.hidden ? ' ' + styles.rowHidden : '')} onClick={() => startEditLoan(l)}>
                      <td><div className={styles.name}>{l.name || 'הלוואה'}</div>{l.lender && <div className={styles.meta}>{l.lender}</div>}</td>
                      <td>{l.original ? fmt(l.original) : '—'}</td>
                      <td>{l.remaining ? fmt(l.remaining) : '—'}</td>
                      <td>{l.asOf ? formatDate(l.asOf) : '—'}</td>
                      <td>{l.rate || '—'}</td>
                      <td>{left === null ? '—' : left === Infinity ? '∞' : left}</td>
                      <td className={styles.loanMonthly}>{fmt(l.monthly || 0)}</td>
                      <td><StatusToggle hidden={!!l.hidden} name={l.name || 'הלוואה'} onToggle={() => updateItem(save, 'loans', l.id, { hidden: !l.hidden })} /></td>
                      <td className={styles.loanActions}>
                        <ActionMenu><EditButton title={`ערוך · ${l.name || 'ההלוואה'}`} onClick={e => { e.stopPropagation(); startEditLoan(l); }} /><DeleteButton title={`מחק · ${l.name || 'ההלוואה'}`} onClick={e => { e.stopPropagation(); removeItem(save, 'loans', l.id, `${l.name || 'ההלוואה'} נמחקה`); }} /></ActionMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <AddForm label="הוספת הלוואה" open={editingLoanId != null} className={styles.form}>
          <label className={styles.formField}>שם החוב<input className={styles.input} placeholder="שם החוב" aria-label="שם החוב" value={loanForm.name} onChange={e => setLoanForm({ ...loanForm, name: e.target.value })} /></label>
          <label className={styles.formField}>סכום מקורי<input className={styles.input} type="number" inputMode="decimal" placeholder="סכום מקורי" aria-label="סכום מקורי" value={loanForm.original} onChange={e => setLoanForm({ ...loanForm, original: e.target.value })} /></label>
          <label className={styles.formField}>יתרת קרן<input className={styles.input} type="number" inputMode="decimal" placeholder="יתרת קרן" aria-label="יתרת קרן" value={loanForm.remaining} onChange={e => setLoanForm({ ...loanForm, remaining: e.target.value })} /></label>
          <label className={styles.formField}>נכון לתאריך<input className={styles.input} type="date" aria-label="נכון לתאריך" value={loanForm.asOf} onChange={e => setLoanForm({ ...loanForm, asOf: e.target.value })} /></label>
          <label className={styles.formField}>ריבית שנתית באחוזים<input className={styles.input} type="number" inputMode="decimal" placeholder="ריבית %" aria-label="ריבית שנתית באחוזים" value={loanForm.rate} onChange={e => setLoanForm({ ...loanForm, rate: e.target.value })} /></label>
          <label className={styles.formField}>החזר חודשי<input className={styles.input} type="number" inputMode="decimal" placeholder="החזר חודשי" aria-label="החזר חודשי" value={loanForm.monthly} onChange={e => setLoanForm({ ...loanForm, monthly: e.target.value })} /></label>
          <Button onClick={submitLoan}>{editingLoanId != null ? 'שמור' : 'הוספת הלוואה'}</Button>
          {editingLoanId != null && <Button variant="ghost" onClick={resetLoanForm}>ביטול</Button>}
        </AddForm>
      </CollapsibleSection>
    </div>
  );
}
