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
        <select className={styles.select} value={type} onChange={e => { setType(e.target.value); setCat(e.target.value === 'expense' ? EXPENSE_CATS[0] : INCOME_CATS[0]); }}>
          <option value="expense">הוצאה</option>
          <option value="income">הכנסה</option>
        </select>
        <select className={styles.select} value={cat} onChange={e => setCat(e.target.value)}>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} placeholder="תיאור" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <input className={styles.input} type="number" placeholder="סכום" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTx()} />
        <Button onClick={addTx}>הוסף</Button>
      </div>
      {!monthTx.length && <div className={styles.empty}>אין תנועות החודש</div>}
      <div className={styles.list}>
        {monthTx.map((t, i) => (
          <div key={t.id} className={styles.row} style={{ animationDelay: Math.min(i * 0.03, 0.3) + 's' }}>
            <div>
              <div>{t.desc}</div>
              <div className={styles.meta}>{t.cat} · {t.date}</div>
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
    </div>
  );
}
