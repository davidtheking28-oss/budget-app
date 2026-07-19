import { useEffect, useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { EXPENSE_CATS } from '../categories.js';
import { getCategoryIcon } from '../categoryIcons.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Expenses.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Expenses({ clientUserId, advisorId, year, month }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [openCats, setOpenCats] = useState(() => new Set());

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
    await save({ transactions: [tx, ...(data.transactions || [])] });
    toast('הוצאה נוספה', 'success');
    setDesc('');
    setAmount('');
    setDate('');
  }

  async function removeTx(id) {
    const removed = (data.transactions || []).find(t => t.id === id);
    const rest = (data.transactions || []).filter(t => t.id !== id);
    await save({ transactions: rest });
    toast('נמחק', 'success', { label: 'בטל', onClick: () => save({ transactions: [removed, ...rest] }) });
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
        <Button onClick={addTx}>הוסף</Button>
      </div>
      {!monthTx.length && <div className={styles.empty}>אין תנועות החודש</div>}
      <div className={styles.list}>
        {groups.map((g, i) => {
          const open = openCats.has(g.cat);
          return (
            <div key={g.cat} className={styles.group}>
              <button
                type="button"
                className={styles.groupHeader}
                style={{ animationDelay: Math.min(i * 0.03, 0.3) + 's' }}
                onClick={() => toggleCat(g.cat)}
                aria-expanded={open}
              >
                <div className={styles.groupLeft}>
                  <svg className={styles.chevron + (open ? ' ' + styles.chevronOpen : '')} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  <span className={styles.catIcon}>{getCategoryIcon(g.cat)}</span>
                  <span>{g.cat}</span>
                  <span className={styles.groupCount}>{g.items.length}</span>
                </div>
                <div style={{ color: 'var(--red)', fontWeight: 700 }}>
                  {fmt(g.total)}
                </div>
              </button>
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
    </div>
  );
}
