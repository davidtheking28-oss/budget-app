import { useState } from 'react';
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
import { toast } from '../toast.js';
import { icons } from './BusinessNav.jsx';
import styles from './Business.module.css';

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
  async function submit(e) {
    e.preventDefault();
    if (!(num(form.amount) > 0)) { toast('הזן סכום תקין', 'error'); return; }
    if (!form.date.startsWith(period)) { toast('התאריך חייב להיות בחודש שנבחר', 'error'); return; }
    await onAdd({ type: 'income', amount: num(form.amount), clearing: num(form.clearing), desc: form.desc.trim(), date: form.date, receipt: form.receipt }, period);
    setForm(prev => ({ ...prev, amount: '', clearing: '', desc: '' }));
  }
  return (
    <Modal title={`הכנסות · ${periodLabel(period)}`} onClose={onClose} wide>
      {incomes.length === 0 ? <div className={styles.empty}>עוד לא הוזנו הכנסות לחודש הזה.</div> : (
        <ul className={styles.rowList}>
          {incomes.map(e => (
            <li key={e.id} className={styles.rowItem}>
              <div className={styles.rowMain}><div className={styles.rowTitle}>{e.desc || 'הכנסה'}</div><div className={styles.rowMeta}>{e.date}{e.clearing ? ` · סליקה ${money(e.clearing)}` : ''}</div></div>
              <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={!!e.receipt} onChange={ev => onUpdate(e.id, { receipt: ev.target.checked })} />קבלה</label>
              <span className={styles.num + ' ' + styles.statPos}>{money(e.amount)}</span>
              <DeleteButton title="מחק הכנסה" onClick={() => onRemove(e.id, 'ההכנסה נמחקה')} />
            </li>
          ))}
        </ul>
      )}
      <form className={styles.addForm} onSubmit={submit}>
        <input className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="סכום" aria-label="סכום ההכנסה" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} />
        <input className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="עלות סליקה" aria-label="עלות סליקה וניכיון" value={form.clearing} onChange={e => setForm(prev => ({ ...prev, clearing: e.target.value }))} />
        <input className={styles.input + ' ' + styles.inputGrow} placeholder="תיאור" aria-label="תיאור ההכנסה" value={form.desc} onChange={e => setForm(prev => ({ ...prev, desc: e.target.value }))} />
        <input className={styles.input} type="date" aria-label="תאריך" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} />
        <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={form.receipt} onChange={e => setForm(prev => ({ ...prev, receipt: e.target.checked }))} />יש קבלה</label>
        <button type="submit" className={styles.btn}>הוסף הכנסה</button>
      </form>
    </Modal>
  );
}

function FixedModal({ period, fixed, onAdd, onChangeAmount, onEnd, onClose }) {
  const [form, setForm] = useState({ amount: '', category: 'ללא קטגוריה', desc: '' });
  async function submit(e) {
    e.preventDefault();
    if (!(num(form.amount) > 0)) { toast('הזן סכום תקין', 'error'); return; }
    await onAdd({ type: 'expense', fixed: true, amount: num(form.amount), category: form.category, desc: form.desc.trim(), startPeriod: period }, period);
    setForm(prev => ({ ...prev, amount: '', desc: '' }));
  }
  return (
    <Modal title={`הוצאות קבועות · ${periodLabel(period)}`} onClose={onClose} wide>
      {fixed.length === 0 ? <div className={styles.empty}>עוד לא הוגדרו הוצאות לחודש הזה.</div> : (
        <ul className={styles.rowList}>
          {fixed.map(e => (
            <li key={e.id} className={styles.rowItem}>
              <div className={styles.rowMain}><div className={styles.rowTitle}>{e.desc || e.category}</div><div className={styles.rowMeta}>{e.category} · מ-{periodLabel(e.startPeriod)}</div></div>
              <input className={styles.input + ' ' + styles.numInput} inputMode="decimal" aria-label={'סכום חודשי: ' + (e.desc || e.category)} defaultValue={e.amount} onBlur={ev => { if (num(ev.target.value) > 0 && num(ev.target.value) !== num(e.amount)) onChangeAmount(e, num(ev.target.value)); }} />
              <DeleteButton title="הפסק הוצאה קבועה" onClick={() => onEnd(e)} />
            </li>
          ))}
        </ul>
      )}
      <form className={styles.addForm} onSubmit={submit}>
        <input className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="₪" aria-label="סכום חודשי" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} />
        <select className={styles.select} aria-label="קטגוריה" value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <input className={styles.input + ' ' + styles.inputGrow} placeholder="תיאור" aria-label="תיאור ההוצאה" value={form.desc} onChange={e => setForm(prev => ({ ...prev, desc: e.target.value }))} />
        <button type="submit" className={styles.btn}>הוסף הוצאה</button>
      </form>
      <p className={styles.note}>הוצאה קבועה ממשיכה אוטומטית לחודשים הבאים. שינוי, הוספה או מחיקה כאן משפיעים על החודש הזה ועל החודשים שאחריו בלבד.</p>
    </Modal>
  );
}

function VariableModal({ period, variable, onAdd, onUpdate, onRemove, onClose }) {
  const [form, setForm] = useState({ amount: '', category: 'ללא קטגוריה', desc: '', date: period === ymKey(new Date().getFullYear(), new Date().getMonth()) ? todayIso() : period + '-01', receipt: false });
  async function submit(e) {
    e.preventDefault();
    if (!(num(form.amount) > 0)) { toast('הזן סכום תקין', 'error'); return; }
    if (!form.date.startsWith(period)) { toast('התאריך חייב להיות בחודש שנבחר', 'error'); return; }
    await onAdd({ type: 'expense', amount: num(form.amount), category: form.category, desc: form.desc.trim(), date: form.date, receipt: form.receipt }, period);
    setForm(prev => ({ ...prev, amount: '', desc: '' }));
  }
  return (
    <Modal title={`הוצאות משתנות · ${periodLabel(period)}`} onClose={onClose} wide>
      {variable.length === 0 ? <div className={styles.empty}>עוד לא הוזנו הוצאות לחודש הזה.</div> : (
        <ul className={styles.rowList}>
          {variable.map(e => (
            <li key={e.id} className={styles.rowItem}>
              <div className={styles.rowMain}><div className={styles.rowTitle}>{e.desc || e.category}</div><div className={styles.rowMeta}>{e.category} · {e.date}</div></div>
              <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={!!e.receipt} onChange={ev => onUpdate(e.id, { receipt: ev.target.checked })} />קבלה</label>
              <span className={styles.num + ' ' + styles.statNeg}>{money(e.amount)}</span>
              <DeleteButton title="מחק הוצאה" onClick={() => onRemove(e.id, 'ההוצאה נמחקה')} />
            </li>
          ))}
        </ul>
      )}
      <form className={styles.addForm} onSubmit={submit}>
        <input className={styles.input + ' ' + styles.numInput} inputMode="decimal" placeholder="₪" aria-label="סכום ההוצאה" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))} />
        <select className={styles.select} aria-label="קטגוריה" value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <input className={styles.input + ' ' + styles.inputGrow} placeholder="תיאור" aria-label="תיאור ההוצאה" value={form.desc} onChange={e => setForm(prev => ({ ...prev, desc: e.target.value }))} />
        <input className={styles.input} type="date" aria-label="תאריך" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} />
        <label className={styles.toolbar}><input type="checkbox" className={styles.check} checked={form.receipt} onChange={e => setForm(prev => ({ ...prev, receipt: e.target.checked }))} />יש קבלה</label>
        <button type="submit" className={styles.btn}>הוסף הוצאה</button>
      </form>
    </Modal>
  );
}

function StatTiles({ items }) {
  return (
    <div className={styles.tileGrid4} style={{ marginTop: 18 }}>
      {items.map(t => (
        <div key={t.label} className={styles.stat}>
          <div className={styles.statLabel}>{t.label}</div>
          <div className={styles.statValue + (t.tone ? ' ' + styles[t.tone] : '')}>{t.value}</div>
          {t.note && <div className={styles.statNote}>{t.note}</div>}
        </div>
      ))}
    </div>
  );
}

function MonthView({ entries, ops, businessType, ym, onYm }) {
  const [modal, setModal] = useState(null);
  const period = ymKey(ym.year, ym.month);
  const m = financeMonth(entries, period, businessType);
  const breakdown = expenseBreakdown([...m.fixed, ...m.variable]);
  const vatPercent = businessType === 'עוסק מורשה' ? VAT_RATE * 100 : 0;
  const shareOfIncome = v => (m.income > 0 ? Math.min(1, Math.max(0, v / m.income)) : 0);
  const IncomeBar = ({ value }) => <span className={styles.progress}><span className={styles.progressFill} style={{ width: shareOfIncome(value) * 100 + '%' }} /></span>;

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
      <section className={styles.bigCard}>
        <div className={styles.cardHead}>
          <BusinessTypeBar value={businessType} onChange={ops.setBusinessType} />
          <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => onYm({ year, month })} />
        </div>
        <div className={styles.sectionLabel} style={{ marginTop: 0 }}>{periodLabel(period)} · רווח נטו משוער</div>
        <div className={styles.bigNumber + ' ' + (m.net < 0 ? styles.statNeg : '')}>{money(m.net)}</div>
        <StatTiles items={[
          { label: 'הכנסות', value: money(m.income) },
          { label: 'רווח תפעולי', value: money(m.operating), tone: m.operating < 0 ? 'statNeg' : '' },
          { label: 'אחוז רווחיות', value: percentLabel(m.margin) },
          { label: 'קבלות חסרות', value: String(m.missingReceipts), tone: m.missingReceipts ? 'statNeg' : '' }
        ]} />
      </section>

      <div className={styles.sectionLabel}>פרטי החודש</div>
      <div className={styles.grid2}>
      <div className={styles.stack}>
      <div className={styles.grid2}>
        <button type="button" className={styles.linkTile} onClick={() => setModal('income')}>
          <span className={styles.iconTile} aria-hidden="true">{icons.coins}</span>
          <span className={styles.linkTileTitle}>הכנסות</span>
          <span className={styles.linkTileValue}>{money(m.income)}</span>
          <IncomeBar value={m.afterClearing} />
          <span className={styles.rowMeta}>סליקה {money(m.clearing)} · אחרי ניכיון {money(m.afterClearing)}</span>
        </button>
        <button type="button" className={styles.linkTile} onClick={() => setModal('fixed')}>
          <span className={styles.iconTile} aria-hidden="true">{icons.table}</span>
          <span className={styles.linkTileTitle}>הוצאות קבועות</span>
          <span className={styles.linkTileValue}>{money(m.fixedTotal)}</span>
          <IncomeBar value={m.fixedTotal} />
          <span className={styles.rowMeta}>{m.fixed.length} הוצאות · {percentLabel(shareOfIncome(m.fixedTotal))} מההכנסות</span>
        </button>
        <div className={styles.linkTile} style={{ cursor: 'default' }}>
          <span className={styles.iconTile} aria-hidden="true">{icons.percent}</span>
          <span className={styles.linkTileTitle}>מיסים</span>
          <span className={styles.linkTileValue}>{money(m.taxes)}</span>
          <IncomeBar value={m.taxes} />
          <span className={styles.rowMeta}>מע״מ {vatPercent}% · מס {INCOME_TAX_RATE * 100}% · ב״ל {NATIONAL_INSURANCE_RATE * 100}%</span>
        </div>
        <button type="button" className={styles.linkTile} onClick={() => setModal('variable')}>
          <span className={styles.iconTile} aria-hidden="true">{icons.table}</span>
          <span className={styles.linkTileTitle}>הוצאות משתנות</span>
          <span className={styles.linkTileValue}>{money(m.variableTotal)}</span>
          <IncomeBar value={m.variableTotal} />
          <span className={styles.rowMeta}>{m.variable.length} הוצאות · {percentLabel(shareOfIncome(m.variableTotal))} מההכנסות</span>
        </button>
      </div>
        <section className={styles.card}>
          <div className={styles.cardHead}><div><h3 className={styles.cardTitle}>פילוח הוצאות</h3><p className={styles.cardSub}>כמה הוצאתי ועל מה</p></div><span className={styles.statValue}>{money(m.expenses)}</span></div>
          {breakdown.length === 0 ? <div className={styles.empty}>עוד אין הוצאות בחודש הזה</div> : (
            <ul className={styles.rowList}>
              {breakdown.map(b => (
                <li key={b.category} className={styles.rowItem}>
                  <div className={styles.rowMain}><div className={styles.rowTitle}>{b.category}</div><div className={styles.progress} style={{ marginTop: 6 }}><div className={styles.progressFill} style={{ width: (b.share || 0) * 100 + '%' }} /></div></div>
                  <span className={styles.num}>{money(b.value)}</span><span className={styles.rowMeta}>{percentLabel(b.share)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
        <section className={styles.card}>
          <div className={styles.cardHead}><h3 className={styles.cardTitle}>סיכום החודש</h3></div>
          <ul className={styles.rowList}>
            {[
              ['הכנסות', m.income], ['עלות ניכיון / סליקה', -m.clearing], ['הכנסות אחרי ניכיון', m.afterClearing],
              [`מע״מ (${vatPercent}%)`, -m.vat], ['הכנסות אחרי מע״מ', m.afterVat],
              ['הוצאות קבועות', -m.fixedTotal], ['הוצאות משתנות', -m.variableTotal], ['סך ההוצאות', -m.expenses],
              ['רווח תפעולי', m.operating], ['מס הכנסה משוער', -m.incomeTax], ['ביטוח לאומי משוער', -m.nationalInsurance]
            ].map(([label, value]) => (
              <li key={label} className={styles.rowItem}><div className={styles.rowMain}>{label}</div><span className={styles.num}>{money(value)}</span></li>
            ))}
            <li className={styles.rowItem}><div className={styles.rowMain}><div className={styles.rowTitle}>רווח נטו משוער</div><div className={styles.rowMeta}>כמה באמת נשאר לך החודש</div></div><span className={styles.statValue + ' ' + (m.net < 0 ? styles.statNeg : styles.statPos)}>{money(m.net)}</span></li>
          </ul>
        </section>
      </div>
      <p className={styles.note}>המספרים הם הערכה בלבד לצורכי ניהול שוטף, ואינם תחליף לייעוץ מס או להנהלת חשבונות.</p>

      {modal === 'income' && <IncomeModal period={period} incomes={m.incomes} onAdd={ops.add} onUpdate={ops.update} onRemove={ops.remove} onClose={() => setModal(null)} />}
      {modal === 'fixed' && <FixedModal period={period} fixed={m.fixed} onAdd={ops.add} onChangeAmount={changeFixedAmount} onEnd={endFixed} onClose={() => setModal(null)} />}
      {modal === 'variable' && <VariableModal period={period} variable={m.variable} onAdd={ops.add} onUpdate={ops.update} onRemove={ops.remove} onClose={() => setModal(null)} />}
    </div>
  );
}

function RangeView({ entries, businessType, scope, from, to, title, controls, ops }) {
  const range = financeRange(entries, from, to, businessType);
  const [expMonth, setExpMonth] = useState('');
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
      <section className={styles.bigCard}>
        <div className={styles.cardHead}><BusinessTypeBar value={businessType} onChange={ops.setBusinessType} />{controls}</div>
        <div className={styles.sectionLabel} style={{ marginTop: 0 }}>{title} · רווח כולל</div>
        <div className={styles.bigNumber + ' ' + (range.net < 0 ? styles.statNeg : '')}>{money(range.net)}</div>
        <StatTiles items={[
          { label: 'הכנסה כוללת', value: money(range.income) },
          { label: 'הוצאה כוללת', value: money(range.expenses) },
          { label: 'אחוז רווח', value: percentLabel(range.margin) },
          { label: 'קבלות חסרות', value: String(range.missingReceipts), tone: range.missingReceipts ? 'statNeg' : '' }
        ]} />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><div><h3 className={styles.cardTitle}>הכנסות מול רווח נטו</h3><p className={styles.cardSub}>{periodLabel(from)} ועד {periodLabel(to)}</p></div></div>
        {empty ? <div className={styles.empty}>אין עדיין נתונים להצגה</div> : <div className={styles.chartBox}><Bar data={chartData} options={chartOptions} /></div>}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h3 className={styles.cardTitle}>כל החודשים</h3><span className={styles.cardSub}>{range.rows.length} חודשים</span></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>חודש</th><th>הכנסות</th><th>סך הוצאות</th><th>מע״מ</th><th>רווח תפעולי</th><th>רווח נטו</th><th>קבלות חסרות</th></tr></thead>
            <tbody>
              {[...range.rows].reverse().map(r => (
                <tr key={r.period}>
                  <td>{periodLabel(r.period)}</td>
                  <td className={styles.num}>{r.income ? money(r.income) : 'אין'}</td><td className={styles.num}>{r.expenses ? money(r.expenses) : 'אין'}</td><td className={styles.num}>{r.vat ? money(r.vat) : 'אין'}</td>
                  <td className={styles.num}>{r.income || r.expenses ? money(r.operating) : 'אין'}</td><td className={styles.num}>{r.income || r.expenses ? money(r.net) : 'אין'}</td><td className={styles.num}>{r.missingReceipts || 'אין'}</td>
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
        {expenseRows.length === 0 ? <div className={styles.empty}>לא נמצאו הוצאות. נסה לשנות את הסינון.</div> : (
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

export default function Finance({ advisorId, scope }) {
  const { records, loading, error, reload, add, update, remove } = useBizRecords(advisorId, 'finance_entry');
  const now = new Date();
  const currentPeriod = ymKey(now.getFullYear(), now.getMonth());
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
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

  if (scope === 'month') return <MonthView entries={entries} ops={ops} businessType={businessType} ym={ym} onYm={setYm} />;

  if (scope === 'year') {
    const to = year === now.getFullYear() ? currentPeriod : `${year}-12`;
    return <RangeView key="year" entries={entries} ops={ops} businessType={businessType} scope={scope} from={`${year}-01`} to={to} title={String(year)} controls={<MonthPicker year={year} month={0} withMonth={false} onChange={y => setYear(y)} />} />;
  }

  if (scope === 'full') {
    const periods = entries.map(e => e.startPeriod || e.period).filter(Boolean).sort();
    const from = periods[0] && periods[0] < currentPeriod ? periods[0] : `${now.getFullYear()}-01`;
    return <RangeView key="full" entries={entries} ops={ops} businessType={businessType} scope={scope} from={from} to={currentPeriod} title={`מאז ${periodLabel(from)}`} />;
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
  return <RangeView key="custom" entries={entries} ops={ops} businessType={businessType} scope={scope} from={from} to={to} title={`${periodLabel(from)} עד ${periodLabel(to)}`} controls={controls} />;
}
