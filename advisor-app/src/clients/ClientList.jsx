import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientList } from './useClientList.js';
import { usePendingInvites } from './usePendingInvites.js';
import PipelineTable from './PipelineTable.jsx';
import { isStale, relativeTime } from './useClientFreshness.js';
import { formatDateTime } from '../budget/monthUtils.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import { toast } from '../toast.js';
import { initials } from '../clientIdentity.js';
import styles from './ClientList.module.css';
import { fmt } from '../format.js';

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
    + (c.hasFailedUpload ? 4 : 0)
    + (c.hasDeclinedMeeting ? 3 : 0)
    + (c.openTasks > 0 ? 2 : 0)
    + (c.updatedAt && isStale(c.updatedAt) ? 1 : 0);
}

function byUrgency(a, b) {
  const diff = urgencyRank(b) - urgencyRank(a);
  if (diff !== 0) return diff;
  return (a.healthScore ?? 101) - (b.healthScore ?? 101);
}

function RemainingStat({ value }) {
  const display = useCountUp(value ?? 0);
  if (value === null) {
    return (
      <div className={styles.remainingStat + ' ' + styles.remainingStatEmpty}>
        <div className={styles.remainingStatLabel}>אין עדיין נתונים</div>
      </div>
    );
  }
  const over = value < 0;
  return (
    <div className={styles.remainingStat + (over ? ' ' + styles.remainingStatOver : '')}>
      <div className={styles.remainingStatValue}>{fmt(Math.abs(display))}</div>
      <div className={styles.remainingStatLabel}>{over ? 'מעבר לתקציב' : 'נותר החודש'}</div>
    </div>
  );
}

const ICON_USERS = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ICON_ALERT = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

const ICON_CHECKLIST = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

function StatMain({ value }) {
  const display = useCountUp(value);
  return <div className={styles.statMainValue}>{Math.round(display)}</div>;
}

function StatSecondary({ label, value, tone, icon, format }) {
  const display = useCountUp(value);
  return (
    <div className={styles.statSecondary}>
      <span className={styles.statIcon + (tone ? ' ' + styles[tone] : '')}>{icon}</span>
      <div className={styles.statSecondaryBody}>
        <span className={styles.statSecondaryValue + (tone ? ' ' + styles[tone] : '')}>{format ? format(display) : Math.round(display)}</span>
        <span className={styles.statSecondaryLabel}>{label}</span>
      </div>
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
  const emailInputRef = useRef(null);
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
      <div className={styles.page}>
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
  const overageAmountTotal = clients.reduce((s, c) => s + (c.overageAmount || 0), 0);
  const openTasksTotal = clients.reduce((s, c) => s + c.openTasks, 0);

  return (
    <div className={styles.page}>
      {/* A brand-new advisor has nothing to count, and three zeroes are the first
          thing they would otherwise see. Let the empty state be the whole page. */}
      {clients.length > 0 && (
        <div className={styles.statBar}>
          <div className={styles.statMain}>
            <span className={styles.statIcon + ' ' + styles.statAccentIcon}>{ICON_USERS}</span>
            <div className={styles.statSecondaryBody}>
              <StatMain value={clients.length} />
              <div className={styles.statMainLabel}>לקוחות פעילים</div>
            </div>
          </div>
          <div className={styles.statDivider}></div>
          <StatSecondary label="חריגות תקציב החודש" value={overageCount} tone={overageCount > 0 ? 'statRed' : undefined} icon={ICON_ALERT} />
          {overageAmountTotal > 0 && (
            <StatSecondary label="סה״כ חריגה בכסף" value={overageAmountTotal} tone="statRed" icon={ICON_ALERT} format={fmt} />
          )}
          <StatSecondary label="משימות פתוחות" value={openTasksTotal} tone={openTasksTotal > 0 ? 'statGold' : undefined} icon={ICON_CHECKLIST} />
        </div>
      )}

      <PipelineTable advisorId={advisorId} />

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>הלקוחות שלי {clients.length > 0 && <span className={styles.kbdHint}>{navigator.platform.startsWith('Mac') ? '⌘K' : 'Ctrl+K'} לחיפוש מהיר</span>}</h2>
        <div className={styles.addForm}>
          <input
            ref={codeInputRef}
            className={styles.addInput + ' ' + styles.addInputCode}
            name="invite-code"
            autoComplete="off"
            dir="ltr"
            aria-label="קוד הזמנה מהלקוח"
            placeholder="קוד הזמנה מהלקוח"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && claimCode()}
          />
          <Button variant="ghost" onClick={claimCode} disabled={submitting}>הוסף לקוח</Button>
          <input
            ref={emailInputRef}
            className={styles.addInput + ' ' + styles.addInputEmail}
            type="email"
            name="invite-email"
            autoComplete="off"
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
        <div className={styles.pendingGroup}>
          <div className={styles.pendingHead}>הזמנות ממתינות <span className={styles.pendingCount}>{pendingInvites.length}</span></div>
          <div className={styles.grid + ' ' + styles.pendingGrid}>
            {pendingInvites.map(inv => (
              <div key={inv.id} className={styles.card + ' ' + styles.pendingCard}>
                <div className={styles.initial + ' ' + styles.pendingInitial} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                </div>
                <div className={styles.info}>
                  <div className={styles.email}>
                    <span className={styles.emailText}>{inv.client_email}</span>
                  </div>
                  <div className={styles.chips}>
                    <div className={styles.pendingChip + ' ' + (inv.client_id ? styles.pendingChipAccept : styles.pendingChipSignup)}>
                      {inv.client_id ? 'ממתין לאישור הלקוח' : 'ממתין להרשמה לאפליקציה'}
                    </div>
                  </div>
                </div>
                <button type="button" className={styles.removeBtn + ' ' + styles.pendingRemoveBtn} title="בטל הזמנה" aria-label={`בטל את ההזמנה ל-${inv.client_email}`} onClick={() => removeInvite(inv.id)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
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
          <div className={styles.emptyTitle}>אין עדיין לקוחות מחוברים</div>
          <div className={styles.emptyText}>שלח הזמנה לכתובת האימייל של הלקוח, או בקש ממנו ליצור קוד הזמנה בהגדרות האפליקציה שלו והדבק אותו כאן</div>
          <Button className={styles.emptyCta} onClick={() => emailInputRef.current?.focus()}>הזמן לקוח ראשון</Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {[...clients].sort(byUrgency).map((c, i) => {
            // Only real red-flag signals earn the full-width row — open tasks alone are
            // common enough that treating them as "wide" collapsed the grid to a single
            // stretched column for nearly every client, instead of an actual multi-column grid.
            const urgent = c.hasOverage || c.hasFailedUpload || c.hasDeclinedMeeting;
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
                <div className={styles.initial} aria-hidden="true">
                  {initials(c.client_email)}
                  {(c.hasOverage || c.hasFailedUpload || c.hasDeclinedMeeting) && <span className={styles.alertDot} title="דורש טיפול" />}
                </div>
                <div className={styles.info}>
                  <div className={styles.email}>
                    <HealthBadge score={c.healthScore} />
                    <span className={styles.emailText}>{c.client_email}</span>
                  </div>
                  <div className={styles.chips}>
                    {c.hasOverage && <div className={styles.overageChip}>חריגת תקציב</div>}
                    {c.hasFailedUpload && <div className={styles.uploadErrorChip}>העלאה נכשלה</div>}
                    {c.hasDeclinedMeeting && <div className={styles.overageChip}>פגישה נדחתה</div>}
                    {c.nextMeetingAt && <div className={styles.nextMeetingChip}>פגישה הבאה: {formatDateTime(c.nextMeetingAt)}</div>}
                    {c.lastMeetingAt && <div className={styles.staleChip}>פגישה אחרונה {relativeTime(c.lastMeetingAt)}</div>}
                    {c.totalTasks > 0 && <div className={styles.staleChip}>בוצעו {c.doneTasks}/{c.totalTasks} משימות</div>}
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
