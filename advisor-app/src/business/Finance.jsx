import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { chartTheme } from '../categories.js';
import { useBizRecords } from './useBizRecords.js';
import { BUSINESS_TYPES, EXPENSE_CATEGORIES, financeMonth, financeRange, expenseBreakdown, percentLabel, ymKey, todayIso, num, previousPeriod, VAT_RATE, INCOME_TAX_RATE, NATIONAL_INSURANCE_RATE } from './bizMath.js';
import MonthPicker, { monthName, MONTH_NAMES, yearOptions } from './MonthPicker.jsx';
import Modal from './Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { fmt } from '../format.js';
import { icons } from './BusinessNav.jsx';
import styles from './Business.module.css';
import layout from './Finance.module.css';
import { formatDate } from '../budget/monthUtils.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const BUSINESS_TYPE_KEY = 'advisor_business_type';

function readBusinessType() {
  try { return localStorage.getItem(BUSINESS_TYPE_KEY) || BUSINESS_TYPES[0]; } catch { return BUSINESS_TYPES[0]; }
}

const periodLabel = period => `${monthName(Number(period.slice(5, 7)) - 1)} ${period.slice(0, 4)}`;
const money = value => fmt(Math.round(value));

function BusinessTypeBar({ value, onChange }) {
  return (
    <div className={styles.toolbar}>
      <span className={styles.cardSub}>סוג העסק</span>
      <div className={styles.segment} role="group" aria-label="סוג העסק">
        {BUSINESS_TYPES.map(t => <button key={t} type="button" className={value === t ? styles.segBtnOn : styles.segBtn} aria-pressed={value === t} onClick={() => onChange(t)}>{t}</button>)}
      </div>
      <span className={styles.iconBtn} role="img" aria-label={`מע״מ ${VAT_RATE * 100}% לעוסק מורשה בלבד, מס הכנסה ${INCOME_TAX_RATE * 100}% וביטוח לאומי ${NATIONAL_INSURANCE_RATE * 100}% מהרווח התפעולי`} title={`מע״מ ${VAT_RATE * 100}% לעוסק מורשה בלבד · מס ${INCOME_TAX_RATE * 100}% · ב״ל ${NATIONAL_INSURANCE_RATE * 100}% מהרווח התפעולי`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-base)' }}>i</span>
    </div>
  );
}

function IncomeModal({ period, incomes, onAdd, onUpdate, onRemove, onClose }) {
  const [form, setForm] = useState({ amount: '', clearing: '', desc: '', date: period === ymKey(new Date().getFullYear(), new Date().getMonth()) ? todayIso() : period + '-01', receipt: true });
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  async function submit(e) {
    e.preventDefault();
    if (savingRef.current) return;
    if (!(num(form.amount) > 0)) { setFormError({ field: 'amount', message: 'הזן סכום גדול מאפס' }); e.currentTarget.querySelector('[data-amount]').focus(); return; }
    if (!form.date.startsWith(period)) { setFormError({ field: 'date', message: 'התאריך חייב להיות בחודש שנבחר' }); e.currentTarget.querySelector('[type=date]').focus(); return; }
    setFormError(null);
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await onAdd({ type: 'income', amount: num(form.amount), clearing: num(form.clearing), desc: form.desc.trim(), date: form.date, receipt: form.receipt }, period);
      if (!saved) { setFormError({ field: 'save', message: 'השמירה נכשלה. הנתונים שהזנת נשארו בטופס — אפשר לנסות שוב.' }); return; }
      setForm(prev => ({ ...prev, amount: '', clearing: '', desc: '' }));
    } finally { savingRef.current = false; setSaving(false); }
  }
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(100);
  const filtered = incomes.filter(entry => [entry.desc, entry.category, entry.date, entry.amount].some(value => String(value ?? '').toLocaleLowerCase('he').includes(search.trim().toLocaleLowerCase('he'))));

  return (
    <Modal title={`הכנסות · ${periodLabel(period)}`} onClose={onClose} wide>
      <section className={layout.records}>
      <div className={layout.sectionHead}><h3 className={layout.heading}>רשומות בחודש</h3><span className={layout.recordCount}>{incomes.length} רשומות</span></div>
      <input type="search" className={styles.input} aria-label="חיפוש בהכנסות" placeholder="חיפוש לפי תיאור, תאריך או סכום" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(100); }} />
      {incomes.length === 0 ? <div className={styles.empty}>עוד לא הוזנו הכנסות לחודש הזה.</div> : (
        <ul className={styles.rowList + ' ' + layout.entries}>
          {filtered.slice(0, visibleCount).map(e => (
            <li key={e.id} className={styles.rowItem + ' ' + layout.entry}>
              <div className={styles.rowMain}><div className={styles.rowTitle}>{e.desc || 'הכנסה'}</div><div className={styles.rowMeta}><time className={layout.date} dateTime={e.date}>{formatDate(e.date)}</time>{e.clearing ? ` · סליקה ${money(e.clearing)}` : ''}</div></div>
              <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={!!e.receipt} onChange={ev => onUpdate(e.id, { receipt: ev.target.checked })} />קבלה</label>
              <input className={styles.input + ' ' + styles.numInput + ' ' + layout.amount} key={e.amount} inputMode="decimal" aria-label={'סכום ההכנסה: ' + (e.desc || e.category || '')} defaultValue={e.amount} onBlur={ev => { const v = num(ev.target.value); if (v > 0 && v !== num(e.amount)) onUpdate(e.id, { amount: v }); else ev.target.value = e.amount; }} />
              <DeleteButton title="מחק הכנסה" onClick={() => onRemove(e.id, 'ההכנסה נמחקה')} />
            </li>
          ))}
        </ul>
      )}
      {filtered.length > visibleCount && <button type="button" className={styles.btnGhost} onClick={() => setVisibleCount(count => count + 100)}>הצג עוד הכנסות</button>}
      {search.trim() && filtered.length === 0 && <div className={styles.empty}>לא נמצאו תוצאות לחיפוש</div>}
      </section>
      <form className={styles.addForm + ' ' + styles.financeForm + ' ' + layout.entryForm} onSubmit={submit}>
        <h3 className={layout.formHeading}>הוספת רשומה</h3>
        <label className={styles.fieldLabel}>סכום ההכנסה<input className={styles.input + ' ' + styles.numInput} data-amount aria-invalid={formError?.field === 'amount'} aria-describedby={formError?.field === 'amount' ? 'finance-form-error' : undefined} inputMode="decimal" placeholder="סכום" aria-label="סכום ההכנסה" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} /></label>
        <label className={styles.fieldLabel}>עלות סליקה וניכיון<input className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="עלות סליקה" aria-label="עלות סליקה וניכיון" value={form.clearing} onChange={e => setForm(prev => ({ ...prev, clearing: e.target.value }))} /></label>
        <label className={styles.fieldLabel}>תיאור ההכנסה<input className={styles.input + ' ' + styles.inputGrow} placeholder="תיאור" aria-label="תיאור ההכנסה" value={form.desc} onChange={e => setForm(prev => ({ ...prev, desc: e.target.value }))} /></label>
        <label className={styles.fieldLabel}>תאריך<input className={styles.input} type="date" aria-invalid={formError?.field === 'date'} aria-describedby={formError?.field === 'date' ? 'finance-form-error' : undefined} aria-label="תאריך" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} /></label>
        <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={form.receipt} onChange={e => setForm(prev => ({ ...prev, receipt: e.target.checked }))} />יש קבלה</label>
        {formError && <p id="finance-form-error" className={styles.fieldError} role="alert">{formError.message}</p>}
        <div className={styles.formActions}>        <button type="submit" className={styles.btn} disabled={saving}>{saving ? 'שומר…' : 'הוסף הכנסה'}</button></div>
      </form>
    </Modal>
  );
}

function FixedModal({ period, fixed, onAdd, onChangeAmount, onEnd, onClose }) {
  const [form, setForm] = useState({ amount: '', category: 'ללא קטגוריה', desc: '' });
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  async function submit(e) {
    e.preventDefault();
    if (savingRef.current) return;
    if (!(num(form.amount) > 0)) { setFormError({ field: 'amount', message: 'הזן סכום גדול מאפס' }); e.currentTarget.querySelector('[data-amount]').focus(); return; }
    setFormError(null);
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await onAdd({ type: 'expense', fixed: true, amount: num(form.amount), category: form.category, desc: form.desc.trim(), startPeriod: period }, period);
      if (!saved) { setFormError({ field: 'save', message: 'השמירה נכשלה. הנתונים שהזנת נשארו בטופס — אפשר לנסות שוב.' }); return; }
      setForm(prev => ({ ...prev, amount: '', desc: '' }));
    } finally { savingRef.current = false; setSaving(false); }
  }
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(100);
  const filtered = fixed.filter(entry => [entry.desc, entry.category, entry.date, entry.amount].some(value => String(value ?? '').toLocaleLowerCase('he').includes(search.trim().toLocaleLowerCase('he'))));

  return (
    <Modal title={`הוצאות קבועות · ${periodLabel(period)}`} onClose={onClose} wide>
      <section className={layout.records}>
      <div className={layout.sectionHead}><h3 className={layout.heading}>רשומות בחודש</h3><span className={layout.recordCount}>{fixed.length} רשומות</span></div>
      <input type="search" className={styles.input} aria-label="חיפוש בהוצאות קבועות" placeholder="חיפוש לפי תיאור, תאריך או סכום" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(100); }} />
      {fixed.length === 0 ? <div className={styles.empty}>עוד לא הוגדרו הוצאות לחודש הזה.</div> : (
        <ul className={styles.rowList + ' ' + layout.entries}>
          {filtered.slice(0, visibleCount).map(e => (
            <li key={e.id} className={styles.rowItem + ' ' + layout.entry}>
              <div className={styles.rowMain}><div className={styles.rowTitle}>{e.desc || e.category}</div><div className={styles.rowMeta}>{e.category} · מ-{periodLabel(e.startPeriod)}</div></div>
              <input className={styles.input + ' ' + styles.numInput + ' ' + layout.amount} key={e.amount} inputMode="decimal" aria-label={'סכום חודשי: ' + (e.desc || e.category)} defaultValue={e.amount} onBlur={ev => { if (num(ev.target.value) > 0 && num(ev.target.value) !== num(e.amount)) onChangeAmount(e, num(ev.target.value)); }} />
              <DeleteButton title="הפסק הוצאה קבועה" onClick={() => onEnd(e)} />
            </li>
          ))}
        </ul>
      )}
      {filtered.length > visibleCount && <button type="button" className={styles.btnGhost} onClick={() => setVisibleCount(count => count + 100)}>הצג עוד הוצאות קבועות</button>}
      {search.trim() && filtered.length === 0 && <div className={styles.empty}>לא נמצאו תוצאות לחיפוש</div>}
      </section>
      <form className={styles.addForm + ' ' + styles.financeForm + ' ' + layout.entryForm} onSubmit={submit}>
        <h3 className={layout.formHeading}>הוספת רשומה</h3>
        <label className={styles.fieldLabel}>סכום חודשי<input className={styles.input + ' ' + styles.numInput} data-amount aria-invalid={formError?.field === 'amount'} aria-describedby={formError?.field === 'amount' ? 'finance-form-error' : undefined} inputMode="decimal" placeholder="₪" aria-label="סכום חודשי" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} /></label>
        <label className={styles.fieldLabel}>קטגוריה<select className={styles.select} aria-label="קטגוריה" value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className={styles.fieldLabel}>תיאור ההוצאה<input className={styles.input + ' ' + styles.inputGrow} placeholder="תיאור" aria-label="תיאור ההוצאה" value={form.desc} onChange={e => setForm(prev => ({ ...prev, desc: e.target.value }))} /></label>
        {formError && <p id="finance-form-error" className={styles.fieldError} role="alert">{formError.message}</p>}
        <div className={styles.formActions}>        <button type="submit" className={styles.btn} disabled={saving}>{saving ? 'שומר…' : 'הוסף הוצאה'}</button></div>
      </form>
      <p className={styles.note}>הוצאה קבועה ממשיכה אוטומטית לחודשים הבאים. שינוי, הוספה או מחיקה כאן משפיעים על החודש הזה ועל החודשים שאחריו בלבד.</p>
    </Modal>
  );
}

function VariableModal({ period, variable, onAdd, onUpdate, onRemove, onClose }) {
  const [form, setForm] = useState({ amount: '', category: 'ללא קטגוריה', desc: '', date: period === ymKey(new Date().getFullYear(), new Date().getMonth()) ? todayIso() : period + '-01', receipt: false });
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  async function submit(e) {
    e.preventDefault();
    if (savingRef.current) return;
    if (!(num(form.amount) > 0)) { setFormError({ field: 'amount', message: 'הזן סכום גדול מאפס' }); e.currentTarget.querySelector('[data-amount]').focus(); return; }
    if (!form.date.startsWith(period)) { setFormError({ field: 'date', message: 'התאריך חייב להיות בחודש שנבחר' }); e.currentTarget.querySelector('[type=date]').focus(); return; }
    setFormError(null);
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await onAdd({ type: 'expense', amount: num(form.amount), category: form.category, desc: form.desc.trim(), date: form.date, receipt: form.receipt }, period);
      if (!saved) { setFormError({ field: 'save', message: 'השמירה נכשלה. הנתונים שהזנת נשארו בטופס — אפשר לנסות שוב.' }); return; }
      setForm(prev => ({ ...prev, amount: '', desc: '' }));
    } finally { savingRef.current = false; setSaving(false); }
  }
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(100);
  const filtered = variable.filter(entry => [entry.desc, entry.category, entry.date, entry.amount].some(value => String(value ?? '').toLocaleLowerCase('he').includes(search.trim().toLocaleLowerCase('he'))));

  return (
    <Modal title={`הוצאות משתנות · ${periodLabel(period)}`} onClose={onClose} wide>
      <section className={layout.records}>
      <div className={layout.sectionHead}><h3 className={layout.heading}>רשומות בחודש</h3><span className={layout.recordCount}>{variable.length} רשומות</span></div>
      <input type="search" className={styles.input} aria-label="חיפוש בהוצאות משתנות" placeholder="חיפוש לפי תיאור, תאריך או סכום" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(100); }} />
      {variable.length === 0 ? <div className={styles.empty}>עוד לא הוזנו הוצאות לחודש הזה.</div> : (
        <ul className={styles.rowList + ' ' + layout.entries}>
          {filtered.slice(0, visibleCount).map(e => (
            <li key={e.id} className={styles.rowItem + ' ' + layout.entry}>
              <div className={styles.rowMain}><div className={styles.rowTitle}>{e.desc || e.category}</div><div className={styles.rowMeta}>{e.category} · <time className={layout.date} dateTime={e.date}>{formatDate(e.date)}</time></div></div>
              <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={!!e.receipt} onChange={ev => onUpdate(e.id, { receipt: ev.target.checked })} />קבלה</label>
              <input className={styles.input + ' ' + styles.numInput + ' ' + layout.amount} key={e.amount} inputMode="decimal" aria-label={'סכום ההוצאה: ' + (e.desc || e.category || '')} defaultValue={e.amount} onBlur={ev => { const v = num(ev.target.value); if (v > 0 && v !== num(e.amount)) onUpdate(e.id, { amount: v }); else ev.target.value = e.amount; }} />
              <DeleteButton title="מחק הוצאה" onClick={() => onRemove(e.id, 'ההוצאה נמחקה')} />
            </li>
          ))}
        </ul>
      )}
      {filtered.length > visibleCount && <button type="button" className={styles.btnGhost} onClick={() => setVisibleCount(count => count + 100)}>הצג עוד הוצאות משתנות</button>}
      {search.trim() && filtered.length === 0 && <div className={styles.empty}>לא נמצאו תוצאות לחיפוש</div>}
      </section>
      <form className={styles.addForm + ' ' + styles.financeForm + ' ' + layout.entryForm} onSubmit={submit}>
        <h3 className={layout.formHeading}>הוספת רשומה</h3>
        <label className={styles.fieldLabel}>סכום ההוצאה<input className={styles.input + ' ' + styles.numInput} data-amount aria-invalid={formError?.field === 'amount'} aria-describedby={formError?.field === 'amount' ? 'finance-form-error' : undefined} inputMode="decimal" placeholder="₪" aria-label="סכום ההוצאה" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} /></label>
        <label className={styles.fieldLabel}>קטגוריה<select className={styles.select} aria-label="קטגוריה" value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className={styles.fieldLabel}>תיאור ההוצאה<input className={styles.input + ' ' + styles.inputGrow} placeholder="תיאור" aria-label="תיאור ההוצאה" value={form.desc} onChange={e => setForm(prev => ({ ...prev, desc: e.target.value }))} /></label>
        <label className={styles.fieldLabel}>תאריך<input className={styles.input} type="date" aria-invalid={formError?.field === 'date'} aria-describedby={formError?.field === 'date' ? 'finance-form-error' : undefined} aria-label="תאריך" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} /></label>
        <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={form.receipt} onChange={e => setForm(prev => ({ ...prev, receipt: e.target.checked }))} />יש קבלה</label>
        {formError && <p id="finance-form-error" className={styles.fieldError} role="alert">{formError.message}</p>}
        <div className={styles.formActions}>        <button type="submit" className={styles.btn} disabled={saving}>{saving ? 'שומר…' : 'הוסף הוצאה'}</button></div>
      </form>
    </Modal>
  );
}

const openFinanceMonth = (period, modal) => {
  try { sessionStorage.setItem('advisor_finance_open', JSON.stringify({ period, modal })); } catch { /* navigation hint only */ }
};
const readFinanceOpen = () => {
  try {
    const raw = sessionStorage.getItem('advisor_finance_open');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const clearFinanceOpen = () => {
  try { sessionStorage.removeItem('advisor_finance_open'); } catch { /* navigation hint only */ }
};
const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

function MonthView({ entries, ops, businessType, ym, onYm, initialModal }) {
  const [modal, setModal] = useState(initialModal || null);
  const period = ymKey(ym.year, ym.month);
  const m = financeMonth(entries, period, businessType);
  const breakdown = expenseBreakdown([...m.fixed, ...m.variable]);
  const vatPercent = businessType === 'עוסק מורשה' ? VAT_RATE * 100 : 0;
  const shareOfIncome = v => (m.income > 0 ? Math.min(1, Math.max(0, v / m.income)) : 0);
  const IncomeBar = ({ value }) => m.income > 0 ? <span className={styles.progress}><span className={styles.progressFill} style={{ width: shareOfIncome(value) * 100 + '%' }} /></span> : null;

  async function endFixed(e) {
    if (e.startPeriod === period) await ops.remove(e.id, 'ההוצאה הוסרה');
    else await ops.update(e.id, { endPeriod: previousPeriod(period) });
  }

  async function changeFixedAmount(e, amount) {
    if (e.startPeriod === period) { await ops.update(e.id, { amount }); return; }
    await ops.update(e.id, { endPeriod: previousPeriod(period) });
    await ops.add({ type: 'expense', fixed: true, amount, category: e.category, desc: e.desc, startPeriod: period }, period);
  }

  return (
    <div className={styles.stack}>
      <div className={layout.monthControls}>
        <BusinessTypeBar value={businessType} onChange={ops.setBusinessType} />
        <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => onYm({ year, month })} />
      </div>
      <section className={layout.monthSummary} aria-label="סיכום החודש">
        <div className={layout.netFact}>
          <span className={styles.cardSub}>{periodLabel(period)} · רווח נטו משוער</span>
          <strong className={layout.netValue + ' ' + (m.net < 0 ? styles.statNeg : m.net > 0 ? styles.statPos : '')}>{money(m.net)}</strong>
        </div>
        {[
          { label: 'רווח תפעולי', value: money(m.operating), tone: m.operating < 0 ? styles.statNeg : '' },
          { label: 'אחוז רווחיות', value: percentLabel(m.margin) },
          { label: 'קבלות חסרות', value: String(m.missingReceipts), tone: m.missingReceipts ? styles.statNeg : '' }
        ].map(fact => <div key={fact.label} className={layout.fact}><span className={styles.cardSub}>{fact.label}</span><strong className={layout.factValue + ' ' + (fact.tone || '')}>{fact.value}</strong></div>)}
      </section>
      <section aria-label="פרטי החודש" className={layout.monthActions}>
        <button type="button" className={layout.action} onClick={() => setModal('income')}>
          <span className={layout.actionIcon} aria-hidden="true">{icons.coins}</span>
          <span className={layout.actionTitle}>הכנסות</span>
          <strong className={layout.actionValue}>{money(m.income)}</strong>
          <IncomeBar value={m.afterClearing} />
          <span className={layout.actionNote}>{m.incomes.length ? <>סליקה {money(m.clearing)} · אחרי ניכיון {money(m.afterClearing)}</> : 'הוסף את ההכנסה הראשונה'}<span className={layout.actionCue} aria-hidden="true">←</span></span>
        </button>
        <button type="button" className={layout.action} onClick={() => setModal('fixed')}>
          <span className={layout.actionIcon} aria-hidden="true">{icons.table}</span>
          <span className={layout.actionTitle}>הוצאות קבועות</span>
          <strong className={layout.actionValue}>{money(m.fixedTotal)}</strong>
          <IncomeBar value={m.fixedTotal} />
          <span className={layout.actionNote}>{m.fixed.length ? <>{m.fixed.length} הוצאות{m.income > 0 ? ` · ${percentLabel(shareOfIncome(m.fixedTotal))} מההכנסות` : ''}</> : 'הוסף הוצאה קבועה'}<span className={layout.actionCue} aria-hidden="true">←</span></span>
        </button>
        <button type="button" className={layout.action} onClick={() => setModal('variable')}>
          <span className={layout.actionIcon} aria-hidden="true">{icons.table}</span>
          <span className={layout.actionTitle}>הוצאות משתנות</span>
          <strong className={layout.actionValue}>{money(m.variableTotal)}</strong>
          <IncomeBar value={m.variableTotal} />
          <span className={layout.actionNote}>{m.variable.length ? <>{m.variable.length} הוצאות{m.income > 0 ? ` · ${percentLabel(shareOfIncome(m.variableTotal))} מההכנסות` : ''}</> : 'הוסף הוצאה משתנה'}<span className={layout.actionCue} aria-hidden="true">←</span></span>
        </button>
        <div className={layout.action}>
          <span className={layout.actionIcon} aria-hidden="true">{icons.percent}</span>
          <span className={layout.actionTitle}>מיסים משוערים</span>
          <strong className={layout.actionValue}>{money(m.taxes)}</strong>
          <IncomeBar value={m.taxes} />
          <span className={layout.actionNote}>מע״מ {vatPercent}% · מס {INCOME_TAX_RATE * 100}% · ב״ל {NATIONAL_INSURANCE_RATE * 100}%</span>
        </div>
      </section>
      {breakdown.length === 0 ? <section className={layout.emptyBreakdown} aria-label="פילוח הוצאות"><h3 className={styles.cardTitle}>פילוח הוצאות</h3><p>הפילוח יופיע כאן לאחר הוספת הוצאות לחודש הזה.</p></section> : <section className={styles.card + ' ' + layout.breakdown}>
        <div className={styles.cardHead}><div><h3 className={styles.cardTitle}>פילוח הוצאות</h3><p className={styles.cardSub}>כמה הוצאתי ועל מה</p></div><strong className={layout.factValue}>{money(m.expenses)}</strong></div>
        {(
          <ul className={layout.breakdownList}>
            {breakdown.map(b => (
              <li key={b.category} className={layout.breakdownRow}>
                <div className={styles.rowMain}><div className={styles.rowTitle}>{b.category}</div><div className={styles.progress} style={{ marginTop: 6 }}><div className={styles.progressFill} style={{ width: (b.share || 0) * 100 + '%' }} /></div></div>
                <span className={styles.num}>{money(b.value)}</span><span className={styles.rowMeta}>{percentLabel(b.share)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>}
      <details className={layout.calculation}>
        <summary>פירוט חישוב החודש</summary>
          <ul className={styles.rowList}>
            {[
              ['הכנסות', m.income], ['עלות ניכיון / סליקה', -m.clearing], ['הכנסות אחרי ניכיון', m.afterClearing],
              [`מע״מ (${vatPercent}%)`, -m.vat], ['הכנסות אחרי מע״מ', m.afterVat],
              ['הוצאות קבועות', -m.fixedTotal], ['הוצאות משתנות', -m.variableTotal], ['סך ההוצאות', -m.expenses],
              ['רווח תפעולי', m.operating], ['מס הכנסה משוער', -m.incomeTax], ['ביטוח לאומי משוער', -m.nationalInsurance]
            ].map(([label, value]) => (
              <li key={label} className={styles.rowItem}><div className={styles.rowMain}>{label}</div><span className={styles.num}>{money(value)}</span></li>
            ))}
            <li className={styles.rowItem}><div className={styles.rowMain}><div className={styles.rowTitle}>רווח נטו משוער</div><div className={styles.rowMeta}>כמה באמת נשאר לך החודש</div></div><span className={layout.ledgerNet + ' ' + (m.net < 0 ? styles.statNeg : m.net > 0 ? styles.statPos : '')}>{money(m.net)}</span></li>
          </ul>
      </details>
      <p className={styles.note}>המספרים הם הערכה בלבד לצורכי ניהול שוטף, ואינם תחליף לייעוץ מס או להנהלת חשבונות.</p>

      {modal === 'income' && <IncomeModal period={period} incomes={m.incomes} onAdd={ops.add} onUpdate={ops.update} onRemove={ops.remove} onClose={() => setModal(null)} />}
      {modal === 'fixed' && <FixedModal period={period} fixed={m.fixed} onAdd={ops.add} onChangeAmount={changeFixedAmount} onEnd={endFixed} onClose={() => setModal(null)} />}
      {modal === 'variable' && <VariableModal period={period} variable={m.variable} onAdd={ops.add} onUpdate={ops.update} onRemove={ops.remove} onClose={() => setModal(null)} />}
    </div>
  );
}

function RangeView({ entries, businessType, scope, from, to, title, controls, ops, onNavigate }) {
  const range = financeRange(entries, from, to, businessType);
  const [expMonth, setExpMonth] = useState('');
  const [showAllMonths, setShowAllMonths] = useState(false);
  const activeMonths = range.rows.filter(row => row.incomes.length || row.fixed.length || row.variable.length);
  const visibleMonths = showAllMonths ? range.rows : activeMonths;
  const [expCategory, setExpCategory] = useState('');
  const CT = chartTheme();
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || CT.green;
  const expenseRows = range.rows.flatMap(r => [...r.fixed, ...r.variable].map(e => ({ ...e, row: r.period, key: e.id + r.period })))
    .filter(e => !expMonth || e.row === expMonth)
    .filter(e => !expCategory || (e.category || 'ללא קטגוריה') === expCategory);
  const expenseTotal = expenseRows.reduce((s, e) => s + num(e.amount), 0);
  const chartData = {
    labels: range.rows.map(r => `${monthName(Number(r.period.slice(5, 7)) - 1)} ${r.period.slice(2, 4)}`),
    datasets: [
      { label: 'הכנסות', data: range.rows.map(r => Math.round(r.income)), backgroundColor: CT.green, borderRadius: 4 },
      { label: 'רווח נטו', data: range.rows.map(r => Math.round(r.net)), backgroundColor: accent, borderRadius: 4 }
    ]
  };
  const chartOptions = { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: CT.text2, font: { family: CT.font } } } }, scales: { x: { reverse: true, ticks: { color: CT.text2 }, grid: { display: false } }, y: { ticks: { color: CT.text2 }, grid: { color: CT.border } } } };
  const empty = range.rows.every(r => r.income === 0 && r.expenses === 0);

  return (
    <div className={styles.stack}>
      <div className={layout.monthControls}>
        <BusinessTypeBar value={businessType} onChange={ops.setBusinessType} />
        {controls}
      </div>
      <section className={layout.monthSummary} aria-label="סיכום התקופה">
        <div className={layout.netFact}>
          <span className={styles.cardSub}>{title} · רווח נטו משוער</span>
          <strong className={layout.netValue + ' ' + (range.net < 0 ? styles.statNeg : range.net > 0 ? styles.statPos : '')}>{money(range.net)}</strong>
        </div>
        {[
          { label: 'הכנסה כוללת', value: money(range.income) },
          { label: 'הוצאה כוללת', value: money(range.expenses) },
          { label: 'אחוז רווחיות', value: percentLabel(range.margin) }
        ].map(fact => <div key={fact.label} className={layout.fact}><span className={styles.cardSub}>{fact.label}</span><strong className={layout.factValue}>{fact.value}</strong></div>)}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><div><h3 className={styles.cardTitle}>הכנסות מול רווח נטו</h3><p className={styles.cardSub}>{periodLabel(from)} ועד {periodLabel(to)}</p></div></div>
        {empty ? <div className={layout.reportEmpty}>אין עדיין הכנסות או הוצאות בתקופה שנבחרה.</div> : <div className={layout.rangeChart}><Bar aria-label={`סיכום כספי: ${chartData.datasets.map(series => `${series.label}: ${series.data.map(money).join(' · ')}`).join(' · ')}`} data={chartData} options={chartOptions} /></div>}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h3 className={styles.cardTitle}>פירוט לפי חודש</h3><span className={styles.cardSub} role="status">{activeMonths.length} חודשים עם פעילות מתוך {range.rows.length}</span></div>
        {activeMonths.length < range.rows.length && <label className={styles.reportToolbar}><input type="checkbox" className={styles.check} checked={showAllMonths} onChange={e => setShowAllMonths(e.target.checked)} />הצג גם חודשים ללא פעילות</label>}
        {!visibleMonths.length && <p className={layout.reportEmpty}>אין פעילות בתקופה שנבחרה</p>}
        <div className={styles.tableWrap + ' ' + styles.reportScroll} tabIndex={0} role="region" aria-label="פירוט כספי חודשי — גלול לצפייה בכל העמודות">
          <table className={styles.table + ' ' + styles.reportTable + ' ' + layout.rangeTable}>
            <thead><tr><th>חודש</th><th>הכנסות</th><th>סך הוצאות</th><th>מע״מ</th><th>רווח תפעולי</th><th>רווח נטו</th><th>קבלות חסרות</th><th><span className={styles.srOnly}>פעולות</span></th></tr></thead>
            <tbody>
              {[...visibleMonths].reverse().map(r => (
                <tr key={r.period}>
                  <td>{periodLabel(r.period)}</td>
                  <td className={styles.num}>{money(r.income)}</td><td className={styles.num}>{money(r.expenses)}</td><td className={styles.num}>{money(r.vat)}</td>
                  <td className={styles.num}>{money(r.operating)}</td><td className={styles.num + ' ' + (r.net < 0 ? styles.statNeg : r.net > 0 ? styles.statPos : '')}>{money(r.net)}</td><td className={styles.num}>{r.missingReceipts}</td>
                  <td>
                    <div className={styles.toolbar} style={{ flexWrap: 'nowrap', gap: 2 }}>
                      <button type="button" className={styles.iconBtn} style={{ width: 30, height: 30, borderColor: 'transparent' }} aria-label={'עריכת ' + periodLabel(r.period)} title="עריכה" onClick={() => { openFinanceMonth(r.period, 'income'); onNavigate?.('fin-month'); }}><svg {...svgProps}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg></button>
                      <button type="button" className={styles.iconBtn} style={{ width: 30, height: 30, borderColor: 'transparent' }} aria-label={'צפייה ב' + periodLabel(r.period)} title="צפייה" onClick={() => { openFinanceMonth(r.period, null); onNavigate?.('fin-month'); }}><svg {...svgProps}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div><h3 className={styles.cardTitle}>ניתוח הוצאות</h3><p className={styles.cardSub}>{expenseRows.length} הוצאות · {money(expenseTotal)}</p></div>
          <div className={styles.toolbar}>
            <select className={styles.select} aria-label="חודש" value={expMonth} onChange={e => setExpMonth(e.target.value)}>
              <option value="">כל החודשים</option>
              {[...range.rows].reverse().map(r => <option key={r.period} value={r.period}>{periodLabel(r.period)}</option>)}
            </select>
            <select className={styles.select} aria-label="קטגוריה" value={expCategory} onChange={e => setExpCategory(e.target.value)}>
              <option value="">כל הקטגוריות</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {expenseRows.length === 0 ? <div className={layout.reportEmpty}>{expMonth || expCategory ? <>לא נמצאו הוצאות בסינון הזה.<button type="button" className={styles.btnGhost} onClick={() => { setExpMonth(''); setExpCategory(''); }}>נקה סינון</button></> : 'אין עדיין הוצאות בתקופה שנבחרה.'}</div> : (
          <ul className={styles.rowList}>
            {expenseRows.map(e => (
              <li key={e.key} className={styles.rowItem}>
                <div className={styles.rowMain}><div className={styles.rowTitle}>{e.desc || e.category}</div><div className={styles.rowMeta}>{e.category || 'ללא קטגוריה'} · {periodLabel(e.row)}{e.fixed ? ' · קבועה' : ''}</div></div>
                <span className={styles.num + ' ' + styles.statNeg}>{money(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className={styles.note}>{scope === 'custom' ? 'הנתונים הפיננסיים נשמרים לפי חודשים שלמים. הטווח נבחר בחודשים, לא בימים.' : 'המספרים הם הערכה בלבד לצורכי ניהול שוטף, ואינם תחליף לייעוץ מס או להנהלת חשבונות.'}</p>
    </div>
  );
}

export default function Finance({ advisorId, scope, onNavigate }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'finance_entry');
  const now = new Date();
  const currentPeriod = ymKey(now.getFullYear(), now.getMonth());
  const [openHint] = useState(readFinanceOpen);
  useEffect(() => { clearFinanceOpen(); }, []);
  const [ym, setYm] = useState(() => (openHint?.period ? { year: Number(openHint.period.slice(0, 4)), month: Number(openHint.period.slice(5, 7)) - 1 } : { year: now.getFullYear(), month: now.getMonth() }));
  const [year, setYear] = useState(now.getFullYear());
  const [custom, setCustom] = useState({ fromYear: now.getFullYear() - 1, fromMonth: 0, toYear: now.getFullYear(), toMonth: now.getMonth() });
  const [businessType, setBusinessType] = useState(readBusinessType);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="260px" radius="18px" />;

  const entries = records.map(r => ({ id: r.id, period: r.period, ...r.data }));
  const pickType = value => {
    setBusinessType(value);
    try { localStorage.setItem(BUSINESS_TYPE_KEY, value); } catch { /* preference only */ }
  };
  const ops = { add, update, remove, setBusinessType: pickType };

  if (scope === 'month') return <MonthView entries={entries} ops={ops} businessType={businessType} ym={ym} onYm={setYm} initialModal={openHint?.modal} />;

  if (scope === 'year') {
    const to = year === now.getFullYear() ? currentPeriod : `${year}-12`;
    return <RangeView key="year" entries={entries} ops={ops} businessType={businessType} scope={scope} onNavigate={onNavigate} from={`${year}-01`} to={to} title={String(year)} controls={<MonthPicker year={year} month={0} withMonth={false} onChange={y => setYear(y)} />} />;
  }

  if (scope === 'full') {
    const periods = entries.map(e => e.startPeriod || e.period).filter(Boolean).sort();
    const from = periods[0] && periods[0] < currentPeriod ? periods[0] : `${now.getFullYear()}-01`;
    return <RangeView key="full" entries={entries} ops={ops} businessType={businessType} scope={scope} onNavigate={onNavigate} from={from} to={currentPeriod} title={`מאז ${periodLabel(from)}`} />;
  }

  const from = ymKey(custom.fromYear, custom.fromMonth);
  const toRaw = ymKey(custom.toYear, custom.toMonth);
  const to = toRaw < from ? from : toRaw;
  const setField = key => e => setCustom(prev => ({ ...prev, [key]: parseInt(e.target.value, 10) }));
  const controls = (
    <div className={styles.toolbar}>
      <span className={styles.cardSub}>מ-</span>
      <select className={styles.select} aria-label="מחודש" value={custom.fromMonth} onChange={setField('fromMonth')}>{MONTH_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
      <select className={styles.select} aria-label="משנה" value={custom.fromYear} onChange={setField('fromYear')}>{yearOptions().map(y => <option key={y} value={y}>{y}</option>)}</select>
      <span className={styles.cardSub}>עד</span>
      <select className={styles.select} aria-label="עד חודש" value={custom.toMonth} onChange={setField('toMonth')}>{MONTH_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
      <select className={styles.select} aria-label="עד שנה" value={custom.toYear} onChange={setField('toYear')}>{yearOptions().map(y => <option key={y} value={y}>{y}</option>)}</select>
    </div>
  );
  return <RangeView key="custom" entries={entries} ops={ops} businessType={businessType} scope={scope} onNavigate={onNavigate} from={from} to={to} title={`${periodLabel(from)} עד ${periodLabel(to)}`} controls={controls} />;
}
