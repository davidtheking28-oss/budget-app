import { useEffect, useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { EXPENSE_CATS, FIXED_CATS, CHART_PALETTE } from '../categories.js';
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
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [openCats, setOpenCats] = useState(() => new Set());
  const [openSuper, setOpenSuper] = useState(() => new Set());
  const [adding, setAdding] = useState(false);

  const today = new Date();
  const isCurrent = year === today.getFullYear() && month === today.getMonth();
  const defaultDate = isCurrent ? today.toISOString().slice(0, 10) : `${year}-${String(month + 1).padStart(2, '0')}-01`;

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

  const monthTx = getMonthTx(data.transactions, year, month)
    .filter(t => t.type === 'expense')
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const groups = [];
  const groupIndex = {};
  monthTx.forEach(t => {
    if (!(t.cat in groupIndex)) {
      groupIndex[t.cat] = groups.length;
      groups.push({ cat: t.cat, items: [], total: 0 });
    }
    const g = groups[groupIndex[t.cat]];
    g.items.push(t);
    g.total += t.amount;
  });
  groups.sort((a, b) => b.total - a.total);
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

  const superGroups = [
    { key: 'variable', label: 'הוצאות משתנות', groups: groups.filter(g => !FIXED_CATS.includes(g.cat)) },
    { key: 'fixed', label: 'הוצאות קבועות', groups: groups.filter(g => FIXED_CATS.includes(g.cat)) }
  ].filter(sg => sg.groups.length).map(sg => ({ ...sg, total: sg.groups.reduce((s, g) => s + g.total, 0) }));

  async function addTx() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('הזן סכום תקין', 'error'); return; }
    const tx = {
      id: Date.now() + Math.random(),
      type: 'expense',
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
    toast('הוצאה נוספה', 'success');
    setDesc('');
    setAmount('');
    setDate('');
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
    const rows = [['תאריך', 'קטגוריה', 'תיאור', 'סכום']];
    monthTx.forEach(t => rows.push([t.date, t.cat, t.desc, t.amount]));
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${year}-${String(month + 1).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Button variant="ghost" onClick={exportCsv} disabled={!monthTx.length}>ייצוא ל-CSV</Button>
      </div>
      <div className={styles.form}>
        <select className={styles.select} aria-label="קטגוריה" value={cat} onChange={e => setCat(e.target.value)}>
          {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} aria-label="תיאור" placeholder="תיאור" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <input className={styles.input} type="number" inputMode="decimal" aria-label="סכום" placeholder="סכום" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <input className={styles.input} type="date" aria-label="תאריך" value={date || defaultDate} onChange={e => setDate(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <Button onClick={addTx} disabled={adding}>הוסף</Button>
      </div>
      {!monthTx.length && (
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
      {monthTx.length > 0 && (
        <div className={styles.statStrip}>
          <div className={styles.stat}><div className={styles.statValue}>{fmt(grandTotal)}</div><div className={styles.statLabel}>סה"כ החודש</div></div>
          <div className={styles.stat}><div className={styles.statValue}>{monthTx.length}</div><div className={styles.statLabel}>עסקאות</div></div>
          {groups[0] && <div className={styles.stat}><div className={styles.statValue}>{groups[0].cat}</div><div className={styles.statLabel}>קטגוריה מובילה</div></div>}
        </div>
      )}
      <div className={styles.list}>
        {superGroups.map((sg, si) => {
          const sOpen = openSuper.has(sg.key);
          const sPct = grandTotal ? Math.round((sg.total / grandTotal) * 100) : 0;
          return (
            <div key={sg.key} className={styles.superGroup}>
              <button
                type="button"
                className={styles.superHeader}
                style={{ animationDelay: Math.min(si * 0.05, 0.3) + 's' }}
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
                  <span style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(sg.total)}</span>
                </div>
              </button>
              {sOpen && (
                <div className={styles.superBody}>
                  {sg.groups.map((g, i) => {
                    const open = openCats.has(g.cat);
                    const pct = grandTotal ? Math.round((g.total / grandTotal) * 100) : 0;
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
