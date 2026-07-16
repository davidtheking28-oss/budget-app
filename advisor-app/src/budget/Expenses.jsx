import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { EXPENSE_CATS, INCOME_CATS } from '../categories.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Expenses.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Expenses({ clientUserId, advisorId, year, month }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [type, setType] = useState('expense');
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [openCats, setOpenCats] = useState(() => new Set());

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
    g.total += t.type === 'income' ? t.amount : -t.amount;
  });
  groups.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  async function addTx() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('הזן סכום תקין', 'error'); return; }
    const today = new Date();
    const isCurrent = year === today.getFullYear() && month === today.getMonth();
    const txDate = isCurrent ? today.toISOString().slice(0, 10) : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const tx = {
      id: Date.now() + Math.random(),
      type,
      cat,
      desc: desc.trim() || cat,
      amount: amt,
      date: txDate,
      recurring: false,
      fixed: false
    };
    await save({ transactions: [tx, ...(data.transactions || [])] });
    toast(type === 'income' ? 'הכנסה נוספה' : 'הוצאה נוספה', 'success');
    setDesc('');
    setAmount('');
  }

  async function removeTx(id) {
    const removed = (data.transactions || []).find(t => t.id === id);
    const rest = (data.transactions || []).filter(t => t.id !== id);
    await save({ transactions: rest });
    toast('נמחק', 'success', { label: 'בטל', onClick: () => save({ transactions: [removed, ...rest] }) });
  }

  const cats = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  return (
    <div>
      <div className={styles.form}>
        <select className={styles.select} aria-label="סוג תנועה" value={type} onChange={e => { setType(e.target.value); setCat(e.target.value === 'expense' ? EXPENSE_CATS[0] : INCOME_CATS[0]); }}>
          <option value="expense">הוצאה</option>
          <option value="income">הכנסה</option>
        </select>
        <select className={styles.select} aria-label="קטגוריה" value={cat} onChange={e => setCat(e.target.value)}>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} aria-label="תיאור" placeholder="תיאור" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <input className={styles.input} type="number" inputMode="decimal" aria-label="סכום" placeholder="סכום" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
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
                  <span>{g.cat}</span>
                  <span className={styles.groupCount}>{g.items.length}</span>
                </div>
                <div style={{ color: g.total >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {g.total >= 0 ? '+' : '-'}{fmt(Math.abs(g.total))}
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
                        <div style={{ color: t.type === 'income' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                          {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
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
