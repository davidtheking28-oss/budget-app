import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientList } from './useClientList.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import { toast } from '../toast.js';
import styles from './ClientList.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

function HealthDot({ score }) {
  if (score === null) return null;
  const color = score >= 75 ? 'var(--green)' : score >= 45 ? 'var(--yellow)' : 'var(--red)';
  return <span className={styles.healthDot} style={{ background: color }} role="img" aria-label={`ציון בריאות: ${score}`} title={`ציון בריאות: ${score}`} />;
}

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');

function RemainingChip({ value }) {
  const display = useCountUp(value ?? 0);
  if (value === null) return null;
  if (value < 0) return <div className={styles.remaining + ' ' + styles.remainingOver}>{fmt(Math.abs(display))} מעבר לתקציב</div>;
  return <div className={styles.remaining}>{fmt(display)} נותר</div>;
}

function StatMain({ value }) {
  const display = useCountUp(value);
  return <div className={styles.statMainValue}>{Math.round(display)}</div>;
}

function StatSecondary({ label, value, tone }) {
  const display = useCountUp(value);
  return (
    <div className={styles.statSecondary}>
      <span className={styles.statSecondaryValue + (tone ? ' ' + styles[tone] : '')}>{Math.round(display)}</span>
      <span className={styles.statSecondaryLabel}>{label}</span>
    </div>
  );
}

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const codeInputRef = useRef(null);
  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; }, []);

  async function claimCode() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { toast('הזן קוד', 'error'); return; }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('claim_advisor_invite', { p_code: trimmed });
    setSubmitting(false);
    if (error) { console.error('claim_advisor_invite', error); toast('שגיאה בחיבור, נסה שוב', 'error'); return; }
    if (!data) { toast('קוד לא תקין או שכבר נוצל', 'error'); return; }
    toast('הלקוח חובר בהצלחה', 'success');
    reload();
    setCode('');
  }

  if (error) return <ErrorState onRetry={reload} />;

  if (loading) {
    return (
      <div>
        <Skeleton height="64px" radius="14px" style={{ marginBottom: 36 }} />
        <div className={styles.grid}>
          {[0, 1, 2].map(i => (
            <div key={i} className={styles.card}>
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
  const urgent = clients
    .filter(c => c.hasOverage || c.openTasks > 0)
    .sort((a, b) => (b.hasOverage - a.hasOverage) || (b.openTasks - a.openTasks))
    .slice(0, 4);

  return (
    <div>
      <div className={styles.statBar}>
        <div className={styles.statMain}>
          <StatMain value={clients.length} />
          <div className={styles.statMainLabel}>לקוחות פעילים</div>
        </div>
        <div className={styles.statDivider}></div>
        <StatSecondary label="חריגות תקציב החודש" value={overageCount} tone={overageCount > 0 ? 'statRed' : undefined} />
        <StatSecondary label="משימות פתוחות" value={openTasksTotal} tone={openTasksTotal > 0 ? 'statGold' : undefined} />
      </div>

      {urgent.length > 0 && (
        <div className={styles.urgentPanel}>
          <div className={styles.urgentTitle}>דורש טיפול היום</div>
          <div className={styles.urgentList}>
            {urgent.map(c => (
              <button type="button" key={c.id} className={styles.urgentRow} onClick={() => onSelect(c.client_id, c.client_email)}>
                <span className={styles.urgentDot + ' ' + (c.hasOverage ? styles.urgentDotRed : styles.urgentDotGold)} aria-hidden="true" />
                <span className={styles.urgentEmail}>{c.client_email}</span>
                <span className={styles.urgentReason}>
                  {c.hasOverage ? 'חריגת תקציב' : ''}
                  {c.hasOverage && c.openTasks > 0 ? ' · ' : ''}
                  {c.openTasks > 0 ? `${c.openTasks} משימות פתוחות` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>הלקוחות שלי <span className={styles.kbdHint}>{navigator.platform.startsWith('Mac') ? '⌘K' : 'Ctrl+K'} לחיפוש מהיר</span></h2>
        <div className={styles.addForm}>
          <input
            ref={codeInputRef}
            className={styles.addInput}
            name="invite-code"
            autoComplete="off"
            dir="ltr"
            style={{ textAlign: 'center', letterSpacing: '2px' }}
            aria-label="קוד הזמנה מהלקוח"
            placeholder="קוד הזמנה מהלקוח"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && claimCode()}
          />
          <Button className={styles.addButton} onClick={claimCode} disabled={submitting}>הוסף לקוח</Button>
        </div>
      </div>

      {!clients.length ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
            </svg>
          </div>
          <div className={styles.emptyTitle}>עדיין אין לקוחות מחוברים</div>
          <div className={styles.emptyText}>בקש מהלקוח ליצור קוד הזמנה בהגדרות האפליקציה שלו, ואז הדבק אותו כאן</div>
          <Button className={styles.emptyCta} onClick={() => codeInputRef.current?.focus()}>חבר לקוח ראשון</Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {clients.map((c, i) => {
            const urgent = c.hasOverage || c.openTasks > 0;
            return (
              <button
                type="button"
                key={c.id}
                className={styles.card + (urgent ? ' ' + styles.cardWide : '') + (mountedRef.current ? ' ' + styles.cardNoAnim : '')}
                style={mountedRef.current ? undefined : { animationDelay: Math.min(i * 0.04, 0.3) + 's' }}
                onClick={() => onSelect(c.client_id, c.client_email)}
              >
                <div className={styles.initial} aria-hidden="true">{initials(c.client_email)}</div>
                <div className={styles.info}>
                  <div className={styles.email}><HealthDot score={c.healthScore} /><span className={styles.emailText}>{c.client_email}</span></div>
                  <div className={styles.chips}>
                    <RemainingChip value={c.remaining} />
                    {c.hasOverage && <div className={styles.overageChip}>חריגת תקציב</div>}
                    {c.openTasks > 0 && <div className={styles.taskChip}>{c.openTasks} משימות פתוחות</div>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
