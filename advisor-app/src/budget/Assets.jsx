import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import AddForm from '../components/AddForm.jsx';
import Hero from '../components/Hero.jsx';
import { Card, CardGrid } from '../components/Rows.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import { addItem, removeItem } from './itemHelpers.js';
import styles from './Assets.module.css';
import { fmt } from '../format.js';

const ASSET_CATS = ['עו״ש', 'קרן פנסיה', 'קרן השתלמות', 'קופת גמל', 'תיק השקעות', 'נדל״ן', 'חיסכון', 'אחר'];
// Liabilities live in `loans`, the same array the subscriptions tab edits,
// so both screens stay a single source of truth.

export default function Assets({ clientUserId, advisorId }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(ASSET_CATS[0]);
  const [amount, setAmount] = useState('');
  const [loanName, setLoanName] = useState('');
  const [loanRemaining, setLoanRemaining] = useState('');
  const [loanMonthly, setLoanMonthly] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="120px" radius="18px" style={{ marginBottom: 20 }} />
        <Skeleton height="220px" radius="18px" />
      </div>
    );
  }

  const assets = data.assets || [];
  const loans = (data.loans || []).filter(l => !l.closed);
  const totalAssets = assets.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const totalLiabilities = loans.reduce((s, l) => s + (parseFloat(l.remaining) || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  async function submit() {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0) { toast('הזן שם וסכום תקינים', 'error'); return; }
    const ok = await addItem(save, 'assets', { name: name.trim(), category, amount: amt });
    if (ok === false) return;
    toast('נכס נוסף', 'success');
    setName('');
    setAmount('');
  }

  async function submitLoan() {
    const rem = parseFloat(loanRemaining);
    if (!loanName.trim() || !rem || rem <= 0) { toast('הזן שם התחייבות ויתרה תקינה', 'error'); return; }
    const ok = await addItem(save, 'loans', {
      name: loanName.trim(),
      lender: '',
      remaining: rem,
      monthly: parseFloat(loanMonthly) || 0,
      original: rem,
      rate: 0
    });
    if (ok === false) return;
    toast('התחייבות נוספה', 'success');
    setLoanName('');
    setLoanRemaining('');
    setLoanMonthly('');
  }

  return (
    <div>
      <Hero
        label="שווי נקי"
        value={fmt(netWorth)}
        tone={netWorth < 0 ? 'neg' : 'pos'}
        note="נכסים פחות התחייבויות"
        side={[
          { label: 'נכסים', value: fmt(totalAssets) },
          { label: 'התחייבויות', value: fmt(totalLiabilities), tone: 'expense' }
        ]}
      />

      <CardGrid single>
        <Card title="נכסים">
      <AddForm label="הוסף נכס" className={styles.form}>
        <input className={styles.input} placeholder="שם הנכס" aria-label="שם הנכס" value={name} onChange={e => setName(e.target.value)} />
        <select aria-label="סוג הנכס" className={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
          {ASSET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="סכום" aria-label="סכום הנכס" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <Button onClick={submit}>הוסף</Button>
      </AddForm>
          {assets.length ? (
            <div className={styles.tableWrap} role="region" aria-label="טבלת נכסים" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr><th>נכס</th><th>סוג</th><th>שווי</th><th>חלק</th><th></th></tr>
              </thead>
              <tbody>
                {[...assets].sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(a => (
                  <tr key={a.id}>
                    <td className={styles.assetName}>{a.name}</td>
                    <td><span className={styles.tag}>{a.category}</span></td>
                    <td className={styles.num}>{fmt(a.amount)}</td>
                    <td className={styles.num}>{totalAssets > 0 ? Math.round(((a.amount || 0) / totalAssets) * 100) + '%' : '—'}</td>
                    <td><DeleteButton onClick={() => removeItem(save, 'assets', a.id, `${a.name} נמחק`)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className={styles.empty}>אין עדיין נכסים רשומים</div>
          )}
        </Card>
      </CardGrid>

      <CardGrid single>
        <Card title="התחייבויות">
          <AddForm label="הוסף התחייבות" className={styles.form}>
            <input className={styles.input} placeholder="שם ההתחייבות" aria-label="שם ההתחייבות" value={loanName} onChange={e => setLoanName(e.target.value)} />
            <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="יתרה" aria-label="יתרת ההתחייבות" value={loanRemaining} onChange={e => setLoanRemaining(e.target.value)} />
            <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="החזר חודשי" aria-label="החזר חודשי להתחייבות" value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLoan()} />
            <Button onClick={submitLoan}>הוסף</Button>
          </AddForm>
          {loans.length ? (
            <div className={styles.tableWrap} role="region" aria-label="טבלת התחייבויות" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr><th>התחייבות</th><th>החזר חודשי</th><th>יתרה</th><th></th></tr>
              </thead>
              <tbody>
                {[...loans].sort((a, b) => (b.remaining || 0) - (a.remaining || 0)).map(l => (
                  <tr key={l.id}>
                    <td className={styles.assetName}>{l.name}</td>
                    <td className={styles.num}>{l.monthly > 0 ? fmt(l.monthly) : '—'}</td>
                    <td className={styles.num + ' ' + styles.kpiNeg}>{fmt(l.remaining)}</td>
                    <td><DeleteButton onClick={() => removeItem(save, 'loans', l.id, `${l.name} נמחקה`)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className={styles.empty}>אין עדיין התחייבויות רשומות</div>
          )}
          <div className={styles.note}>הלוואות שנוספו כאן מופיעות גם בטאב «הלוואות ואשראי», שם אפשר להגדיר ריבית ומלווה.</div>
        </Card>
      </CardGrid>
    </div>
  );
}
