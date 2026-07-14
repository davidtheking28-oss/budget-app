import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { EXPENSE_CATS, INCOME_CATS } from '../categories.js';
import styles from './Expenses.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Expenses({ clientUserId }) {
  const { data, loading, save } = useClientBudget(clientUserId);
  const [type, setType] = useState('expense');
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  if (loading || !data) return null;

  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth())
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  async function addTx() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const tx = {
      id: Date.now() + Math.random(),
      type,
      cat,
      desc: desc.trim() || cat,
      amount: amt,
      date: now.toISOString().slice(0, 10),
      recurring: false,
      fixed: false
    };
    await save({ transactions: [tx, ...(data.transactions || [])] });
    setDesc('');
    setAmount('');
  }

  async function removeTx(id) {
    await save({ transactions: (data.transactions || []).filter(t => t.id !== id) });
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
        <input className={styles.input} placeholder="תיאור" value={desc} onChange={e => setDesc(e.target.value)} />
        <input className={styles.input} type="number" placeholder="סכום" value={amount} onChange={e => setAmount(e.target.value)} />
        <button className={styles.button} onClick={addTx}>הוסף</button>
      </div>
      <div className={styles.list}>
        {monthTx.map(t => (
          <div key={t.id} className={styles.row}>
            <div>
              <div>{t.desc}</div>
              <div className={styles.meta}>{t.cat} · {t.date}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: t.type === 'income' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </div>
              <button className={styles.del} onClick={() => removeTx(t.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
