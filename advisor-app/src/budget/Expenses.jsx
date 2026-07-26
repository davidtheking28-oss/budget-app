import { useEffect, useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx, localISODate } from './monthUtils.js';
import { EXPENSE_CATS, INCOME_CATS, FIXED_CATS, CHART_PALETTE } from '../categories.js';
import ImportSheet from './ImportSheet.jsx';
import { getCategoryIcon } from '../categoryIcons.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Expenses.module.css';

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');

export default function Expenses({ clientUserId, advisorId, year, month }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [txType, setTxType] = useState('expense');
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [openCats, setOpenCats] = useState(() => new Set());
  const [openSuper, setOpenSuper] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  function pickType(t) {
    setTxType(t);
    setCat(t === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[0]);
  }

  const today = new Date();
  const isCurrent = year === today.getFullYear() && month === today.getMonth();
  const defaultDate = isCurrent ? localISODate(today) : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  useEffect(() => { setDate(''); }, [year, month]);

  function toggleCat(c) {
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  }

  function toggleSuper(k) {
    setOpenSuper(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="56px" radius="10px" style={{ marginBottom: 8 }} />
        <Skeleton height="56px" radius="10px" />
      </div>
    );
  }

  const allMonthTx = getMonthTx(data.transactions, year, month)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const incomeTx = allMonthTx.filter(t => t.type === 'income');
  const expenseTx = allMonthTx.filter(t => t.type !== 'income');
  const incomeTotal = incomeTx.reduce((s, t) => s + t.amount, 0);
  const expenseTotal = expenseTx.reduce((s, t) => s + t.amount, 0);
  const netFlow = incomeTotal - expenseTotal;

  function buildGroups(list) {
    const out = [];
    const index = {};
    list.forEach(t => {
      if (!(t.cat in index)) {
        index[t.cat] = out.length;
        out.push({ cat: t.cat, items: [], total: 0 });
      }
      const g = out[index[t.cat]];
      g.items.push(t);
      g.total += t.amount;
    });
    return out.sort((a, b) => b.total - a.total);
  }

  const expenseGroups = buildGroups(expenseTx);
  const incomeGroups = buildGroups(incomeTx);

  const allSuperGroups = [
    { key: 'income', label: 'הכנסות', tone: 'income', groups: incomeGroups },
    { key: 'variable', label: 'הוצאות משתנות', groups: expenseGroups.filter(g => !FIXED_CATS.includes(g.cat)) },
    { key: 'fixed', label: 'הוצאות קבועות', groups: expenseGroups.filter(g => FIXED_CATS.includes(g.cat)) }
  ];
  const superGroups = allSuperGroups
    .filter(sg => sg.groups.length && (filter === 'all' || filter === sg.key))
    .map(sg => ({ ...sg, total: sg.groups.reduce((s, g) => s + g.total, 0) }));

  const FILTERS = [
    { key: 'all', label: 'הכל' },
    { key: 'income', label: 'הכנסות' },
    { key: 'variable', label: 'משתנות' },
    { key: 'fixed', label: 'קבועות' }
  ];

  async function addTx() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('הזן סכום תקין', 'error'); return; }
    const tx = {
      id: Date.now() + Math.random(),
      type: txType,
      cat,
      desc: desc.trim() || cat,
      amount: amt,
      date: date || defaultDate,
      recurring: false,
      fixed: false
    };
    setAdding(true);
    await save(cur => ({ transactions: [tx, ...(cur.transactions || [])] }));
    setAdding(false);
    toast(txType === 'income' ? 'הכנסה נוספה' : 'הוצאה נוספה', 'success');
    setDesc('');
    setAmount('');
    setDate('');
  }

  async function importRows(rows) {
    const newTx = rows.map(r => ({
      id: Date.now() + Math.random(),
      type: r.amount < 0 ? 'expense' : 'income',
      cat: r.amount < 0 ? EXPENSE_CATS[EXPENSE_CATS.length - 1] : INCOME_CATS[INCOME_CATS.length - 1],
      desc: r.desc,
      amount: Math.abs(r.amount),
      date: r.date,
      recurring: false,
      fixed: false
    }));
    const ok = await save(cur => ({ transactions: [...newTx, ...(cur.transactions || [])] }));
    if (ok === false) return;
    toast(`${newTx.length} תנועות יובאו`, 'success');
    setImportOpen(false);
  }

  async function removeTx(id) {
    let removed;
    await save(cur => {
      const curTx = cur.transactions || [];
      removed = curTx.find(t => t.id === id);
      return { transactions: curTx.filter(t => t.id !== id) };
    });
    toast('נמחק', 'success', { label: 'בטל', onClick: () => save(cur => ({ transactions: [removed, ...(cur.transactions || [])] })) });
  }

  function exportCsv() {
    // Export the whole month's flow, not the current filter, and keep the
    // income/expense type so the amounts are not ambiguous.
    const rows = [['תאריך', 'סוג', 'קטגוריה', 'תיאור', 'סכום']];
    allMonthTx.forEach(t => rows.push([t.date, t.type === 'income' ? 'הכנסה' : 'הוצאה', t.cat, t.desc, t.amount]));
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-${year}-${String(month + 1).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.typeToggle}>
          <button type="button" className={styles.typeBtn + (txType === 'income' ? ' ' + styles.typeBtnIncome : '')} onClick={() => pickType('income')}>+ הכנסה</button>
          <button type="button" className={styles.typeBtn + (txType === 'expense' ? ' ' + styles.typeBtnExpense : '')} onClick={() => pickType('expense')}>+ הוצאה</button>
        </div>
        <div className={styles.toolbarActions}>
          <Button variant="ghost" onClick={() => setImportOpen(true)}>ייבוא מקובץ</Button>
          <Button variant="ghost" onClick={exportCsv} disabled={!allMonthTx.length}>ייצוא ל-CSV</Button>
        </div>
      </div>
      <div className={styles.form}>
        <select className={styles.select} aria-label="קטגוריה" value={cat} onChange={e => setCat(e.target.value)}>
          {(txType === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} aria-label="תיאור" placeholder="תיאור" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <input className={styles.input} type="number" inputMode="decimal" aria-label="סכום" placeholder="סכום" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <input className={styles.input} type="date" aria-label="תאריך" value={date || defaultDate} onChange={e => setDate(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <Button onClick={addTx} disabled={adding}>{txType === 'income' ? 'הוסף הכנסה' : 'הוסף הוצאה'}</Button>
      </div>
      {importOpen && <ImportSheet onClose={() => setImportOpen(false)} onImport={importRows} />}
      {!allMonthTx.length && (
        <div className={styles.empty}>
          <div className={styles.emptyMark}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="12" cy="12" r="0.8" fill="currentColor" />
            </svg>
          </div>
          אין תנועות החודש
        </div>
      )}
      {allMonthTx.length > 0 && (
        <>
          <div className={styles.flowHero}>
            <div className={styles.flowLabel}>התזרים החודש</div>
            <div className={styles.flowValue + ' ' + (netFlow < 0 ? styles.flowNeg : styles.flowPos)}>{fmt(netFlow)}</div>
            <div className={styles.flowSplit}>
              <div className={styles.flowCell}>
                <span className={styles.flowCellLabel}>הכנסות</span>
                <span className={styles.flowCellValue + ' ' + styles.flowPos}>{fmt(incomeTotal)}</span>
              </div>
              <div className={styles.flowCell}>
                <span className={styles.flowCellLabel}>הוצאות</span>
                <span className={styles.flowCellValue + ' ' + styles.flowNeg}>{fmt(expenseTotal)}</span>
              </div>
              <div className={styles.flowCell}>
                <span className={styles.flowCellLabel}>עסקאות</span>
                <span className={styles.flowCellValue}>{allMonthTx.length}</span>
              </div>
            </div>
          </div>

          <div className={styles.filterRow} role="tablist" aria-label="סינון תזרים">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={styles.filterChip + (filter === f.key ? ' ' + styles.filterChipActive : '')}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
      {allMonthTx.length > 0 && !superGroups.length && (
        <div className={styles.filterEmpty}>אין תנועות בסינון הזה</div>
      )}
      <div className={styles.list}>
        {superGroups.map((sg, si) => {
          const sOpen = openSuper.has(sg.key);
          // Income and expenses are separate pools: a share of the expense
          // total is meaningless for an income group.
          const base = sg.key === 'income' ? incomeTotal : expenseTotal;
          const sPct = base ? Math.round((sg.total / base) * 100) : 0;
          return (
            <div key={sg.key} className={styles.superGroup}>
              <button
                type="button"
                className={styles.superHeader}
                style={{ animationDelay: Math.min(si * 0.022, 0.12) + 's' }}
                onClick={() => toggleSuper(sg.key)}
                aria-expanded={sOpen}
              >
                <div className={styles.groupLeft}>
                  <svg className={styles.chevron + (sOpen ? ' ' + styles.chevronOpen : '')} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  <span>{sg.label}</span>
                  <span className={styles.groupCount}>{sg.groups.length}</span>
                </div>
                <div className={styles.groupRight}>
                  <span className={styles.groupPct}>{sPct}%</span>
                  <span className={styles.superTotal + ' ' + (sg.key === 'income' ? styles.flowPos : styles.flowNeg)}>{fmt(sg.total)}</span>
                </div>
              </button>
              {sOpen && (
                <div className={styles.superBody}>
                  {sg.groups.map((g, i) => {
                    const open = openCats.has(g.cat);
                    const pct = base ? Math.round((g.total / base) * 100) : 0;
                    const color = CHART_PALETTE[i % CHART_PALETTE.length];
                    return (
                      <div key={g.cat} className={styles.group}>
                        <button
                          type="button"
                          className={styles.groupHeader}
                          onClick={() => toggleCat(g.cat)}
                          aria-expanded={open}
                        >
                          <div className={styles.groupLeft}>
                            <svg className={styles.chevron + (open ? ' ' + styles.chevronOpen : '')} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                            <span className={styles.catDot} style={{ background: color }} />
                            <span className={styles.catIcon}>{getCategoryIcon(g.cat)}</span>
                            <span>{g.cat}</span>
                            <span className={styles.groupCount}>{g.items.length}</span>
                          </div>
                          <div className={styles.groupRight}>
                            <span className={styles.groupPct}>{pct}%</span>
                            <span style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(g.total)}</span>
                          </div>
                        </button>
                        <div className={styles.groupBar}><div className={styles.groupBarFill} style={{ width: pct + '%', background: color }} /></div>
                        {open && (
                          <div className={styles.groupBody}>
                            {g.items.map(t => (
                              <div key={t.id} className={styles.row}>
                                <div>
                                  <div>{t.desc}</div>
                                  <div className={styles.meta}>{t.date}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ color: 'var(--red)', fontWeight: 700 }}>
                                    {fmt(t.amount)}
                                  </div>
                                  <DeleteButton onClick={() => removeTx(t.id)} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
