import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientList } from './useClientList.js';
import { usePendingInvites } from './usePendingInvites.js';
import { isStale, relativeTime } from './useClientFreshness.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import { toast } from '../toast.js';
import styles from './ClientList.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

function HealthBadge({ score }) {
  if (score === null) return null;
  const tone = score >= 75 ? styles.healthGood : score >= 45 ? styles.healthWarn : styles.healthBad;
  return (
    <span className={styles.healthBadge + ' ' + tone} title={`ציון בריאות פיננסית: ${score} מתוך 100`}>
      {score}
    </span>
  );
}

// Clients arrive in roster order, which buries the ones that need attention.
// Rank by urgency, then by the weakest health score.
function urgencyRank(c) {
  return (c.hasOverage ? 4 : 0)
    + (c.openTasks > 0 ? 2 : 0)
    + (c.updatedAt && isStale(c.updatedAt) ? 1 : 0);
}

function byUrgency(a, b) {
  const diff = urgencyRank(b) - urgencyRank(a);
  if (diff !== 0) return diff;
  return (a.healthScore ?? 101) - (b.healthScore ?? 101);
}

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');

function RemainingStat({ value }) {
  const display = useCountUp(value ?? 0);
  if (value === null) return null;
  const over = value < 0;
  return (
    <div className={styles.remainingStat + (over ? ' ' + styles.remainingStatOver : '')}>
      <div className={styles.remainingStatValue}>{fmt(Math.abs(display))}</div>
      <div className={styles.remainingStatLabel}>{over ? 'מעבר לתקציב' : 'נותר החודש'}</div>
    </div>
  );
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

const INVITE_ERROR_MESSAGES = {
  self: 'לא ניתן להזמין את עצמך',
  rate_limited: 'יותר מדי הזמנות, נסה שוב בעוד 10 דקות',
  not_advisor: 'החשבון הזה לא מוגדר כחשבון יועץ',
  invalid_email: 'כתובת אימייל לא תקינה',
  already_linked: 'הלקוח כבר מחובר אליך',
  already_invited: 'כבר קיימת הזמנה פתוחה לכתובת הזו'
};

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const { invites: pendingInvites, reload: reloadInvites } = usePendingInvites(advisorId);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
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
    if (data === 'self') { toast('אתה מחובר כרגע עם חשבון הלקוח עצמו - התחבר לפלטפורמה עם חשבון היועץ שלך', 'error'); return; }
    if (data === 'rate_limited') { toast('יותר מדי ניסיונות, נסה שוב בעוד 10 דקות', 'error'); return; }
    if (data === 'not_advisor') { toast('החשבון הזה לא מוגדר כחשבון יועץ', 'error'); return; }
    if (data !== 'ok') { toast('קוד לא תקין, פג תוקפו או שכבר נוצל', 'error'); return; }
    toast('הלקוח חובר בהצלחה', 'success');
    reload();
    setCode('');
  }

  async function inviteByEmail() {
    const trimmed = email.trim();
    if (!trimmed) { toast('הזן כתובת אימייל', 'error'); return; }
    setInvitingEmail(true);
    const { data, error } = await supabase.rpc('invite_client_by_email', { p_email: trimmed });
    setInvitingEmail(false);
    if (error) { console.error('invite_client_by_email', error); toast('שגיאה בשליחת ההזמנה, נסה שוב', 'error'); return; }
    if (data !== 'ok') { toast(INVITE_ERROR_MESSAGES[data] || 'שגיאה בשליחת ההזמנה', 'error'); return; }
    toast('ההזמנה נשלחה', 'success');
    reloadInvites();
    setEmail('');
  }

  async function removeInvite(id) {
    const { error } = await supabase.from('advisor_clients').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בביטול ההזמנה', 'error'); return; }
    toast('ההזמנה בוטלה', 'success');
    reloadInvites();
  }

  async function removeClient(id) {
    const { error } = await supabase.from('advisor_clients').delete().eq('id', id).eq('advisor_id', advisorId);
    setConfirmingId(null);
    if (error) { toast('שגיאה בניתוק הלקוח', 'error'); return; }
    toast('הלקוח נותק', 'success');
    reload();
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
          <Button onClick={claimCode} disabled={submitting}>הוסף לקוח</Button>
          <input
            className={styles.addInput}
            type="email"
            name="invite-email"
            autoComplete="off"
            style={{ textTransform: 'none', width: 'min(220px, 100%)' }}
            aria-label="הזמן לקוח באימייל"
            placeholder="הזמן לקוח באימייל"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && inviteByEmail()}
          />
          <Button onClick={inviteByEmail} disabled={invitingEmail}>הזמן</Button>
        </div>
      </div>

      {pendingInvites.length > 0 && (
        <div className={styles.grid} style={{ marginTop: 12, marginBottom: 20 }}>
          {pendingInvites.map(inv => (
            <div key={inv.id} className={styles.card} style={{ opacity: 0.75, cursor: 'default', borderStyle: 'dashed' }}>
              <div className={styles.initial} aria-hidden="true">✉</div>
              <div className={styles.info}>
                <div className={styles.email}>
                  <span className={styles.emailText}>{inv.client_email}</span>
                </div>
                <div className={styles.chips}>
                  <div className={styles.staleChip}>
                    {inv.client_id ? 'ממתין לאישור הלקוח' : 'ממתין להרשמה לאפליקציה'}
                  </div>
                </div>
              </div>
              <button type="button" className={styles.removeBtn} style={{ opacity: 1, position: 'static', marginInlineStart: 'auto' }} title="בטל הזמנה" aria-label="בטל הזמנה" onClick={() => removeInvite(inv.id)}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

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
          {[...clients].sort(byUrgency).map((c, i) => {
            const urgent = c.hasOverage || c.openTasks > 0;
            const confirming = confirmingId === c.id;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                className={styles.card + (urgent ? ' ' + styles.cardWide : '') + (mountedRef.current ? ' ' + styles.cardNoAnim : '')}
                style={mountedRef.current ? undefined : { animationDelay: Math.min(i * 0.022, 0.12) + 's' }}
                onClick={() => onSelect(c.client_id, c.client_email)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.client_id, c.client_email); } }}
              >
                <div className={styles.initial} aria-hidden="true">{initials(c.client_email)}</div>
                <div className={styles.info}>
                  <div className={styles.email}>
                    <HealthBadge score={c.healthScore} />
                    <span className={styles.emailText}>{c.client_email}</span>
                  </div>
                  <div className={styles.chips}>
                    {c.hasOverage && <div className={styles.overageChip}>חריגת תקציב</div>}
                    {c.openTasks > 0 && <div className={styles.taskChip}>{c.openTasks} משימות פתוחות</div>}
                    {c.updatedAt && isStale(c.updatedAt) && (
                      <div className={styles.staleChip}>לא עודכן {relativeTime(c.updatedAt)}</div>
                    )}
                  </div>
                </div>
                <RemainingStat value={c.remaining} />
                {confirming ? (
                  <div className={styles.confirmRemoveGroup}>
                    <button type="button" className={styles.confirmRemoveBtn} onClick={e => { e.stopPropagation(); removeClient(c.id); }}>
                      לאשר ניתוק?
                    </button>
                    <button type="button" className={styles.cancelRemoveBtn} onClick={e => { e.stopPropagation(); setConfirmingId(null); }}>
                      ביטול
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.removeBtn} title="נתק לקוח" aria-label="נתק לקוח" onClick={e => { e.stopPropagation(); setConfirmingId(c.id); }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
