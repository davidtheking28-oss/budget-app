import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import styles from './Dashboard.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Dashboard({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);
  if (loading || !data) return null;

  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth());
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = income - expense;

  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <div className={styles.glow + ' ' + styles.glowGreen}></div>
        <div className={styles.label}>הכנסות החודש</div>
        <div className={styles.value + ' ' + styles.income}>{fmt(income)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.glow + ' ' + styles.glowRed}></div>
        <div className={styles.label}>הוצאות החודש</div>
        <div className={styles.value + ' ' + styles.expense}>{fmt(expense)}</div>
      </div>
      <div className={styles.card + ' ' + styles.cardMain}>
        <div className={styles.glow + ' ' + styles.glowGold}></div>
        <div className={styles.label}>מאזן</div>
        <div className={styles.value + ' ' + styles.net + (net < 0 ? ' ' + styles.expense : '')}>{fmt(net)}</div>
      </div>
    </div>
  );
}
