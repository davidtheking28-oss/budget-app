import { useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { stableColor } from '../categories.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import { addItem, removeItem } from './itemHelpers.js';
import styles from './Assets.module.css';
import { fmt } from '../format.js';

ChartJS.register(ArcElement, Tooltip);

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
  const loans = data.loans || [];
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

  const byCat = {};
  assets.forEach(a => { byCat[a.category] = (byCat[a.category] || 0) + (parseFloat(a.amount) || 0); });
  const catLabels = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const catColors = catLabels.map(l => stableColor(l, ASSET_CATS));

  const chartData = {
    labels: catLabels,
    datasets: [{ data: catLabels.map(l => byCat[l]), backgroundColor: catColors, borderWidth: 0, hoverOffset: 6 }]
  };
  const chartOptions = {
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.raw)}` } } },
    cutout: '68%',
    maintainAspectRatio: false
  };

  return (
    <div>
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>סך הכל נכסים</div>
          <div className={styles.kpiValue}>{fmt(totalAssets)}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>סך הכל התחייבויות</div>
          <div className={styles.kpiValue + ' ' + styles.kpiNeg}>{fmt(totalLiabilities)}</div>
        </div>
        <div className={styles.kpi + ' ' + styles.kpiMain}>
          <div className={styles.kpiLabel}>שווי נקי</div>
          <div className={styles.kpiValue + ' ' + (netWorth >= 0 ? styles.kpiPos : styles.kpiNeg)}>{fmt(netWorth)}</div>
        </div>
      </div>

      <div className={styles.split}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>חלוקת הנכסים</div>
          {assets.length ? (
            <div className={styles.donutRow}>
              <div className={styles.donutWrap}>
                <Pie data={chartData} options={chartOptions} />
                <div className={styles.donutCenter}>
                  <div className={styles.donutTotal}>{fmt(totalAssets)}</div>
                  <div className={styles.donutTotalLabel}>סה״כ נכסים</div>
                </div>
              </div>
              <div className={styles.legend}>
                {catLabels.map((l, i) => (
                  <div key={l} className={styles.legendRow}>
                    <span className={styles.legendDot} style={{ background: catColors[i] }} />
                    <span className={styles.legendLabel}>{l}</span>
                    <span className={styles.legendPct}>{Math.round((byCat[l] / totalAssets) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.empty}>עדיין לא הוגדרו נכסים</div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>שווי נכסים</div>
          <div className={styles.form}>
            <input className={styles.input} placeholder="שם הנכס" aria-label="שם הנכס" value={name} onChange={e => setName(e.target.value)} />
            <select aria-label="סוג הנכס" className={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
              {ASSET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="סכום" aria-label="סכום הנכס" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
            <Button onClick={submit}>הוסף</Button>
          </div>
          {assets.length ? (
            <div className={styles.list}>
              {[...assets].sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(a => (
                <div key={a.id} className={styles.row}>
                  <div>
                    <div className={styles.assetName}>{a.name}</div>
                    <div className={styles.assetCat}>{a.category}</div>
                  </div>
                  <div className={styles.rowActions}>
                    <span className={styles.assetAmt}>{fmt(a.amount)}</span>
                    <DeleteButton onClick={() => removeItem(save, 'assets', a.id)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>אין עדיין נכסים רשומים</div>
          )}
        </div>
      </div>

      <div className={styles.card + ' ' + styles.cardStandalone}>
        <div className={styles.cardTitle}>התחייבויות</div>
        <div className={styles.form}>
          <input className={styles.input} placeholder="שם ההתחייבות" aria-label="שם ההתחייבות" value={loanName} onChange={e => setLoanName(e.target.value)} />
          <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="יתרה" aria-label="יתרת ההתחייבות" value={loanRemaining} onChange={e => setLoanRemaining(e.target.value)} />
          <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="החזר חודשי" aria-label="החזר חודשי להתחייבות" value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLoan()} />
          <Button onClick={submitLoan}>הוסף</Button>
        </div>
        {loans.length ? (
          <div className={styles.list}>
            {[...loans].sort((a, b) => (b.remaining || 0) - (a.remaining || 0)).map(l => (
              <div key={l.id} className={styles.row}>
                <div>
                  <div className={styles.assetName}>{l.name}</div>
                  <div className={styles.assetCat}>
                    {l.monthly > 0 ? `החזר חודשי ${fmt(l.monthly)}` : 'ללא החזר חודשי'}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <span className={styles.assetAmt + ' ' + styles.kpiNeg}>{fmt(l.remaining)}</span>
                  <DeleteButton onClick={() => removeItem(save, 'loans', l.id)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>אין עדיין התחייבויות רשומות</div>
        )}
        <div className={styles.note}>הלוואות שנוספו כאן מופיעות גם בטאב «מנויים והלוואות», שם אפשר להגדיר ריבית ומלווה.</div>
      </div>
    </div>
  );
}
