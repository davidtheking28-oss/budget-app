import { useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { CHART_PALETTE } from '../categories.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import DeleteButton from '../components/DeleteButton.jsx';
import { toast } from '../toast.js';
import styles from './Assets.module.css';

ChartJS.register(ArcElement, Tooltip);

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const ASSET_CATS = ['עו״ש', 'קרן פנסיה', 'קרן השתלמות', 'קופת גמל', 'תיק השקעות', 'נדל״ן', 'חיסכון', 'אחר'];

function addAsset(save, item) {
  return save(cur => ({ assets: [...(cur.assets || []), { id: Date.now() + Math.random(), ...item }] }));
}
function removeAsset(save, id) {
  return save(cur => ({ assets: (cur.assets || []).filter(a => a.id !== id) }));
}

export default function Assets({ clientUserId, advisorId }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(ASSET_CATS[0]);
  const [amount, setAmount] = useState('');

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
    const ok = await addAsset(save, { name: name.trim(), category, amount: amt });
    if (ok === false) return;
    toast('נכס נוסף', 'success');
    setName('');
    setAmount('');
  }

  const byCat = {};
  assets.forEach(a => { byCat[a.category] = (byCat[a.category] || 0) + (parseFloat(a.amount) || 0); });
  const catLabels = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  const catColors = catLabels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

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
            <input className={styles.input} placeholder="שם הנכס" value={name} onChange={e => setName(e.target.value)} />
            <select className={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
              {ASSET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className={styles.input + ' ' + styles.amountInput} type="number" inputMode="decimal" placeholder="סכום" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
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
                    <DeleteButton onClick={() => removeAsset(save, a.id)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>אין עדיין נכסים רשומים</div>
          )}
        </div>
      </div>
    </div>
  );
}
