import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import AddForm from '../components/AddForm.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import ActionMenu from '../components/ActionMenu.jsx';
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
  const [showAsset, setShowAsset] = useState(false);
  const [showLoan, setShowLoan] = useState(false);

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

  const sortedAssets = [...assets].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const sortedLoans = [...loans].sort((a, b) => (b.remaining || 0) - (a.remaining || 0));
  const barMax = Math.max(totalAssets, totalLiabilities, 1);

  return (
    <div>
      <section className={styles.hero}>
        <div className={styles.heroLabel}>שווי נקי</div>
        <div className={styles.heroValue + ' ' + (netWorth < 0 ? styles.kpiNeg : styles.kpiPos)}>{fmt(netWorth)}</div>
        <div className={styles.heroSub}>
          <span className={styles.kpiPos}>נכסים {fmt(totalAssets)}</span>
          <span aria-hidden="true"> · </span>
          <span className={styles.kpiNeg}>התחייבויות {fmt(totalLiabilities)}</span>
        </div>
        <div className={styles.bars}>
          <div className={styles.barCol}>
            <div className={styles.barTrack}><div className={styles.barFillPos} style={{ height: (totalAssets / barMax) * 100 + '%' }} /></div>
            <div className={styles.barLabel}>נכסים</div>
          </div>
          <div className={styles.barCol}>
            <div className={styles.barTrack}><div className={styles.barFillNeg} style={{ height: (totalLiabilities / barMax) * 100 + '%' }} /></div>
            <div className={styles.barLabel}>התחייבויות</div>
          </div>
        </div>
      </section>

      <div className={styles.cols}>
        <section className={styles.cardPos}>
          <header className={styles.cardHead}>
            <h3 className={styles.cardTitle}><span className={styles.dotPos} aria-hidden="true" />נכסים</h3>
            <span className={styles.kpiPos + ' ' + styles.cardTotal}>{fmt(totalAssets)}</span>
          </header>
          {sortedAssets.length ? (
            <ul className={styles.list}>
              {sortedAssets.map(a => (
                <li key={a.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.assetName}>{a.name}</div>
                    <div className={styles.rowMeta}>{a.category || 'אחר'}{totalAssets > 0 ? ' · ' + Math.round(((a.amount || 0) / totalAssets) * 100) + '%' : ''}</div>
                  </div>
                  <span className={styles.num}>{fmt(a.amount)}</span>
                  <ActionMenu><DeleteButton onClick={() => removeItem(save, 'assets', a.id, `${a.name} נמחק`)} /></ActionMenu>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>עוד לא הוספת נכסים. לחץ להוספה.</div>
          )}
          <div className={styles.cardFoot}>
            {showAsset ? (
              <AddForm open className={styles.form} onEscape={() => setShowAsset(false)}>
                <input className={styles.input} placeholder="שם הנכס" aria-label="שם הנכס" value={name} onChange={e => setName(e.target.value)} />
                <select aria-label="סוג הנכס" className={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
                  {ASSET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="סכום" aria-label="סכום הנכס" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
                <Button onClick={submit}>הוסף</Button>
                <Button variant="ghost" onClick={() => setShowAsset(false)}>ביטול</Button>
              </AddForm>
            ) : (
              <button type="button" className={styles.addBtn} onClick={() => setShowAsset(true)}>+ הוספת נכס</button>
            )}
          </div>
        </section>

        <section className={styles.cardNeg}>
          <header className={styles.cardHead}>
            <h3 className={styles.cardTitle}><span className={styles.dotNeg} aria-hidden="true" />התחייבויות</h3>
            <span className={styles.kpiNeg + ' ' + styles.cardTotal}>{fmt(totalLiabilities)}</span>
          </header>
          {sortedLoans.length ? (
            <ul className={styles.list}>
              {sortedLoans.map(l => (
                <li key={l.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.assetName}>{l.name}</div>
                    <div className={styles.rowMeta}>{l.monthly > 0 ? 'החזר חודשי ' + fmt(l.monthly) : 'ללא החזר חודשי'}</div>
                  </div>
                  <span className={styles.num + ' ' + styles.kpiNeg}>{fmt(l.remaining)}</span>
                  <ActionMenu><DeleteButton onClick={() => removeItem(save, 'loans', l.id, `${l.name} נמחקה`)} /></ActionMenu>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>עוד לא הוספת התחייבויות. לחץ להוספה.</div>
          )}
          <div className={styles.cardFoot}>
            {showLoan ? (
              <AddForm open className={styles.form} onEscape={() => setShowLoan(false)}>
                <input className={styles.input} placeholder="שם ההתחייבות" aria-label="שם ההתחייבות" value={loanName} onChange={e => setLoanName(e.target.value)} />
                <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="יתרה" aria-label="יתרת ההתחייבות" value={loanRemaining} onChange={e => setLoanRemaining(e.target.value)} />
                <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="החזר חודשי" aria-label="החזר חודשי להתחייבות" value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLoan()} />
                <Button onClick={submitLoan}>הוסף</Button>
                <Button variant="ghost" onClick={() => setShowLoan(false)}>ביטול</Button>
              </AddForm>
            ) : (
              <button type="button" className={styles.addBtn} onClick={() => setShowLoan(true)}>+ הוספת התחייבות</button>
            )}
          </div>
          <div className={styles.note}>הלוואות שנוספו כאן מופיעות גם בטאב «הלוואות ואשראי», שם אפשר להגדיר ריבית ומלווה.</div>
        </section>
      </div>
    </div>
  );
}
