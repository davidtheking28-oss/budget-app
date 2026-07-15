import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientList } from './useClientList.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import { toast } from '../toast.js';
import styles from './ClientList.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

function RemainingChip({ value }) {
  const display = useCountUp(value ?? 0);
  if (value === null) return null;
  if (value < 0) return <div className={styles.remaining + ' ' + styles.remainingOver}>{fmt(Math.abs(display))} מעבר לתקציב</div>;
  return <div className={styles.remaining}>{fmt(display)} נותר</div>;
}

function Kpi({ label, value, tone }) {
  const display = useCountUp(value);
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue + (tone ? ' ' + styles[tone] : '')}>{Math.round(display)}</div>
    </div>
  );
}

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading, reload } = useClientList(advisorId);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function claimCode() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { toast('הזן קוד', 'error'); return; }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('claim_advisor_invite', { p_code: trimmed });
    setSubmitting(false);
    if (error || !data) { toast('קוד לא תקין או שכבר נוצל', 'error'); return; }
    toast('הלקוח חובר בהצלחה', 'success');
    reload();
    setCode('');
  }

  if (loading) {
    return (
      <div>
        <div className={styles.kpis}>
          <Skeleton height="96px" radius="16px" />
          <Skeleton height="96px" radius="16px" />
          <Skeleton height="96px" radius="16px" />
        </div>
        <div className={styles.list}>
          {[0, 1, 2].map(i => (
            <div key={i} className={styles.row}>
              <Skeleton width="42px" height="42px" radius="50%" />
              <Skeleton width="160px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const overageCount = clients.filter(c => c.hasOverage).length;
  const openTasksTotal = clients.reduce((s, c) => s + c.openTasks, 0);

  return (
    <div>
      <div className={styles.kpis}>
        <Kpi label="לקוחות פעילים" value={clients.length} />
        <Kpi label="חריגות תקציב החודש" value={overageCount} tone={overageCount > 0 ? 'kpiRed' : 'kpiGreen'} />
        <Kpi label="משימות פתוחות" value={openTasksTotal} tone={openTasksTotal > 0 ? 'kpiGold' : undefined} />
      </div>

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>הלקוחות שלי</h2>
        <div className={styles.addForm}>
          <input
            className={styles.addInput}
            placeholder="קוד הזמנה מהלקוח"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && claimCode()}
          />
          <button className={styles.addButton} onClick={claimCode} disabled={submitting}>+ הוסף לקוח</button>
        </div>
      </div>

      {!clients.length ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark}></div>
          אין עדיין לקוחות מחוברים — בקש מהלקוח ליצור קוד הזמנה בהגדרות האפליקציה שלו
        </div>
      ) : (
        <div className={styles.list}>
          {clients.map((c, i) => (
            <div
              key={c.id}
              className={styles.row}
              style={{ animationDelay: (i * 0.04) + 's' }}
              onClick={() => onSelect(c.client_id, c.client_email)}
            >
              <div className={styles.avatar}>{initials(c.client_email)}</div>
              <div className={styles.info}>
                <div className={styles.email}>{c.client_email}</div>
                <div className={styles.chips}>
                  <RemainingChip value={c.remaining} />
                  {c.hasOverage && <div className={styles.overageChip}>חריגת תקציב</div>}
                  {c.openTasks > 0 && <div className={styles.taskChip}>{c.openTasks} משימות פתוחות</div>}
                </div>
              </div>
              <div className={styles.arrow}>כניסה לתקציב ←</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
