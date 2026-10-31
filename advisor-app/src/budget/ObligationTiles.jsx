import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import Subscriptions, { monthlyEquivalent } from './Subscriptions.jsx';
import Modal from '../business/Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { fmt } from '../format.js';
import styles from './ObligationTiles.module.css';

const monthlyOf = (list, field, divisor = 1) => list.reduce((sum, x) => sum + (x[field] || 0) / divisor, 0);

export default function ObligationTiles({ clientUserId, advisorId, keys }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId, advisorId);
  const [open, setOpen] = useState(null);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) return <Skeleton height="120px" radius="18px" />;

  const subsMonthly = (data.subscriptions || []).reduce((sum, x) => sum + (x.active ? monthlyEquivalent(x.cycle, x.amount || 0) : 0), 0);
  const all = {
    insurances: { title: 'ביטוחים', value: monthlyOf(data.insurances || [], 'monthly'), count: (data.insurances || []).length, note: 'לחודש' },
    annual: { title: 'הוצאות שנתיות', value: monthlyOf(data.annualExpenses || [], 'annual', 12), count: (data.annualExpenses || []).length, note: 'לחודש · חלקי 12' },
    subs: { title: 'מנויים', value: subsMonthly, count: (data.subscriptions || []).length, note: 'לחודש' },
    education: { title: 'חינוך', value: monthlyOf(data.education || [], 'monthly'), count: (data.education || []).length, note: 'לחודש' },
    grooming: { title: 'קוסמטיקה', value: monthlyOf(data.grooming || [], 'monthly'), count: (data.grooming || []).length, note: 'לחודש' },
    events: { title: 'מתנות', value: monthlyOf(data.events || [], 'annual', 12), count: (data.events || []).length, note: 'לחודש · חלקי 12' }
  };
  const tiles = keys.map(key => ({ key, ...all[key] }));
  const current = tiles.find(t => t.key === open);

  return (
    <>
      <div className={styles.grid}>
        {tiles.map(t => (
          <button key={t.key} type="button" className={styles.tile} onClick={() => setOpen(t.key)}>
            <span className={styles.title}>{t.title}</span>
            <span className={styles.value}>{fmt(t.value)}</span>
            <span className={styles.meta}>{t.count} רשומות · {t.note}</span>
          </button>
        ))}
      </div>
      <p className={styles.hint}>לחיצה על מחשבון פותחת אותו בחלון, והסכום שלו נשלף לתצוגה הראשית.</p>
      {current && (
        <Modal title={current.title} onClose={() => setOpen(null)} wide>
          <Subscriptions clientUserId={clientUserId} advisorId={advisorId} only={current.key} />
        </Modal>
      )}
    </>
  );
}
