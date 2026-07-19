import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Goals.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Goals({ clientUserId, advisorId }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [months, setMonths] = useState('');
  const [txCard, setTxCard] = useState(null);
  const [amount, setAmount] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div className={styles.grid}>
        <Skeleton height="90px" radius="14px" />
        <Skeleton height="90px" radius="14px" />
      </div>
    );
  }

  const goals = data.goals || [];
  const transactions = data.transactions || [];

  async function addGoal() {
    const t = parseFloat(target);
    if (!name.trim()) { toast('תן שם ליעד', 'error'); return; }
    if (!t || t <= 0) { toast('הזן סכום יעד תקין', 'error'); return; }
    const m = Math.max(0, parseInt(months, 10) || 0);
    const goal = { id: Date.now(), name: name.trim(), target: t, months: m, saved: 0 };
    await save({ goals: [...goals, goal] });
    toast('יעד נוצר', 'success');
    setName(''); setTarget(''); setMonths('');
  }

  async function deleteGoal(id) {
    const rest = goals.filter(g => g.id !== id);
    const restTx = transactions.filter(t => !(t.goalTx && t.goalId === id));
    await save({ goals: rest, transactions: restTx });
    toast('יעד נמחק', 'success');
  }

  function openTx(id, dir) { setTxCard({ id, dir }); setAmount(''); }
  function closeTx() { setTxCard(null); setAmount(''); }

  async function confirmTx() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('הזן סכום', 'error'); return; }
    const g = goals.find(x => x.id === txCard.id);
    if (!g) return;
    const today = new Date().toISOString().split('T')[0];
    let nextGoals, nextTx;
    if (txCard.dir === 'withdraw') {
      const actual = Math.min(amt, g.saved || 0);
      nextGoals = goals.map(x => x.id === g.id ? { ...x, saved: Math.max(0, (x.saved || 0) - actual) } : x);
      nextTx = actual > 0
        ? [{ id: 'goal|' + g.id + '|' + Date.now(), type: 'income', cat: 'אחר', desc: 'משיכה מיעד: ' + g.name, amount: actual, date: today, recurring: false, goalTx: true, goalId: g.id }, ...transactions]
        : transactions;
      toast('נמשך מהחיסכון', 'success');
    } else {
      nextGoals = goals.map(x => x.id === g.id ? { ...x, saved: Math.min(x.target, (x.saved || 0) + amt) } : x);
      nextTx = [{ id: 'goal|' + g.id + '|' + Date.now(), type: 'expense', cat: 'חיסכון ליעד', desc: 'חיסכון: ' + g.name, amount: amt, date: today, recurring: false, goalTx: true, goalId: g.id }, ...transactions];
      toast('החיסכון עודכן', 'success');
    }
    await save({ goals: nextGoals, transactions: nextTx });
    closeTx();
  }

  const totalSaved = goals.reduce((s, g) => s + (g.saved || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + (g.target || 0), 0);

  return (
    <div>
      <div className={styles.form}>
        <input className={styles.input} placeholder="שם היעד" value={name} onChange={e => setName(e.target.value)} />
        <input className={styles.input} type="number" inputMode="decimal" placeholder="סכום יעד" value={target} onChange={e => setTarget(e.target.value)} />
        <input className={styles.input} type="number" inputMode="numeric" placeholder="חודשים" value={months} onChange={e => setMonths(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGoal()} />
        <Button onClick={addGoal}>+ יעד חדש</Button>
      </div>

      {!goals.length ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="12" cy="12" r="0.8" fill="currentColor" />
            </svg>
          </div>
          עדיין אין יעדי חיסכון
        </div>
      ) : (
        <>
          <div className={styles.rollup}>{`${goals.length} יעדים פעילים · נחסכו ${fmt(totalSaved)} מתוך ${fmt(totalTarget)}`}</div>
          <div className={styles.grid}>
            {goals.map((g, i) => {
              const pct = g.target ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
              const expanded = txCard?.id === g.id;
              return (
                <div key={g.id} className={styles.item} style={{ animationDelay: Math.min(i * 0.05, 0.3) + 's' }}>
                  <div className={styles.top}>
                    <div className={styles.name}>{g.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={styles.amounts}>{fmt(g.saved || 0)} / {fmt(g.target || 0)}</div>
                      <DeleteButton title="מחק יעד" onClick={() => deleteGoal(g.id)} />
                    </div>
                  </div>
                  <div className={styles.bar}>
                    <div className={styles.fill} style={{ width: pct + '%' }}>
                      {pct >= 12 && <span className={styles.fillPct}>{pct}%</span>}
                    </div>
                    {pct < 12 && <span className={styles.pctOutside} style={{ insetInlineStart: `calc(${pct}% + 6px)` }}>{pct}%</span>}
                  </div>
                  {g.months > 0 && <div className={styles.meta}>יעד ל-{g.months} חודשים</div>}
                  {expanded ? (
                    <div className={styles.txRow}>
                      <input
                        className={styles.txInput}
                        type="number"
                        inputMode="decimal"
                        placeholder="סכום"
                        autoFocus
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && confirmTx()}
                      />
                      <Button variant={txCard.dir === 'withdraw' ? 'ghost' : 'primary'} onClick={confirmTx}>{txCard.dir === 'withdraw' ? 'משוך' : 'הוסף'}</Button>
                      <Button variant="ghost" onClick={closeTx}>ביטול</Button>
                    </div>
                  ) : (
                    <div className={styles.txActions}>
                      <button className={styles.txBtn} onClick={() => openTx(g.id, 'add')}>+ הוסף לחיסכון</button>
                      {g.saved > 0 && <button className={styles.txBtnNeutral} onClick={() => openTx(g.id, 'withdraw')}>− משוך</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
