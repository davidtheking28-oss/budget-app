import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientList } from './useClientList.js';
import { usePendingInvites } from './usePendingInvites.js';
import { usePipeline } from './usePipeline.js';
import { useProspects } from './useProspects.js';
import { Card, Row } from '../components/Rows.jsx';
import PipelineModal from './PipelineModal.jsx';
import { formatDate, localISODate } from '../budget/monthUtils.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import { toast } from '../toast.js';
import styles from './ClientList.module.css';
import ClientsTable from '../business/ClientsTable.jsx';
import { INVITE_ERROR_MESSAGES } from './inviteMessages.js';

const OPEN_PROSPECT_STATUSES = ['new', 'contacted', 'followup', 'meeting'];
const TEMP_LABELS = { hot: 'חם', warm: 'פושר', cold: 'קר' };

function overdueText(followUpAt, today) {
  const days = Math.round((Date.parse(today) - Date.parse(followUpAt)) / 86400000);
  if (days <= 0) return 'להיום';
  return days === 1 ? 'באיחור של יום' : `באיחור של ${days} ימים`;
}

export default function ClientList({ advisorId, onSelect, inviteDraft, onDraftUsed, onOpenProspects }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const { invites: pendingInvites, reload: reloadInvites } = usePendingInvites(advisorId);
  const { leads, loading: leadsLoading, addLead, setStage: setLeadStage, deleteLead } = usePipeline(advisorId);
  const { prospects, loading: prospectsLoading, error: prospectsError, updateProspect } = useProspects(advisorId);
  const [linkedProspectId, setLinkedProspectId] = useState(null);
  const draftHandled = useRef(null);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [confirmingInviteId, setConfirmingInviteId] = useState(null);
  const codeInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => { if (addOpen) setSecondaryOpen(true); }, [addOpen]);
  useEffect(() => { if (addOpen && secondaryOpen) emailInputRef.current?.focus(); }, [addOpen, secondaryOpen, loading]);

  useEffect(() => {
    if (!inviteDraft || draftHandled.current === inviteDraft) return;
    draftHandled.current = inviteDraft;
    setAddOpen(true);
    setEmail(inviteDraft.email);
    setLinkedProspectId(inviteDraft.prospectId);
    if (!inviteDraft.email) toast('לפרט אימייל כדי להזמין את הלקוח', 'info');
    onDraftUsed();
  }, [inviteDraft, onDraftUsed]);

  async function claimCode() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { toast('הזן קוד', 'error'); return; }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('claim_advisor_invite', { p_code: trimmed });
    setSubmitting(false);
    if (error) { console.error('claim_advisor_invite', error); toast('שגיאה בחיבור, נסה שוב', 'error'); return; }
    if (data === 'self') { toast('החשבון המחובר כרגע הוא חשבון הלקוח עצמו - יש להתחבר לפלטפורמה עם חשבון היועץ', 'error'); return; }
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
    if (linkedProspectId != null) { updateProspect(linkedProspectId, { status: 'converted' }); setLinkedProspectId(null); }
  }

  async function removeInvite(id) {
    setConfirmingInviteId(null);
    const { error } = await supabase.from('advisor_clients').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בביטול ההזמנה', 'error'); return; }
    toast('ההזמנה בוטלה', 'success');
    reloadInvites();
  }

  async function removeClient(id) {
    const { error } = await supabase.from('advisor_clients').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בניתוק הלקוח', 'error'); return; }
    toast('הלקוח נותק', 'success');
    reload();
  }

  if (error) return <ErrorState onRetry={reload} />;

  if (loading || (prospectsLoading && !prospectsError)) {
    return (
      <div>
        <Skeleton height="64px" radius="14px" style={{ marginBottom: 36 }} />
        {[0, 1, 2].map(i => (
          <Skeleton key={i} height="64px" radius="10px" style={{ marginBottom: 12 }} />
        ))}
      </div>
    );
  }

  const todayISO = localISODate();
  const dueProspects = prospects
    .filter(p => OPEN_PROSPECT_STATUSES.includes(p.status) && p.follow_up_at && p.follow_up_at <= todayISO)
    .sort((a, b) => a.follow_up_at.localeCompare(b.follow_up_at));

  return (
    <div>
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
          <Button className={styles.emptyCta} onClick={() => { setAddOpen(true); emailInputRef.current?.focus(); }}>הזמן לקוח ראשון</Button>
        </div>
      ) : (
        <ClientsTable advisorId={advisorId} onAdd={() => { setAddOpen(true); setSecondaryOpen(true); setTimeout(() => emailInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50); }} onOpen={r => onSelect(r.client_id, r.client_email)} onRemove={removeClient} />
      )}

      {pipelineOpen && (
        <PipelineModal
          leads={leads}
          loading={leadsLoading}
          addLead={addLead}
          setStage={setLeadStage}
          deleteLead={deleteLead}
          onClose={() => setPipelineOpen(false)}
        />
      )}

      <section className={styles.secondarySection} inert={pipelineOpen ? '' : undefined}>
      <button type="button" className={styles.secondaryToggle} aria-expanded={secondaryOpen} aria-controls="client-secondary" onClick={() => setSecondaryOpen(v => !v)}>
        <span>הזמנות ומעקב</span><span>{pendingInvites.length} הזמנות ממתינות · {dueProspects.length} מעקבים להיום <span aria-hidden="true">{secondaryOpen ? '−' : '+'}</span></span>
      </button>
      <div id="client-secondary" hidden={!secondaryOpen}>
      {leads.length > 0 && <Button variant="ghost" onClick={() => setPipelineOpen(true)}>לקוחות חדשים בטיפול ({leads.length})</Button>}
      {dueProspects.length > 0 && (
        <div className={styles.followCard}>
          <Card title="פולואפים להיום">
            {dueProspects.map(p => (
              <div key={p.id} className={styles.followRow}>
                <button type="button" className={styles.followRowBtn} onClick={onOpenProspects} aria-label={`${p.name} - פתח בדף המתעניינים`} />
                <Row
                  name={<>{p.name}<span className={styles.followTemp + ' ' + styles[p.temperature || 'warm']}>{TEMP_LABELS[p.temperature] || TEMP_LABELS.warm}</span></>}
                  sub={[p.source, p.contacted_at && `פנה ב-${formatDate(p.contacted_at)}`].filter(Boolean).join(' · ')}
                >
                  <div className={styles.followSide}>
                    {p.phone && <a className={styles.followPhone} href={`tel:${p.phone}`} dir="ltr">{p.phone}</a>}
                    <span className={styles.followLate}>{overdueText(p.follow_up_at, todayISO)}</span>
                  </div>
                </Row>
              </div>
            ))}
            <Button variant="ghost" className={styles.followLink} onClick={onOpenProspects}>לדף המתעניינים</Button>
          </Card>
        </div>
      )}
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionTitle}>חיבור לקוחות והזמנות {clients.length > 0 && <span className={styles.kbdHint}>{navigator.platform.startsWith('Mac') ? '⌘K' : 'Ctrl+K'} לחיפוש מהיר</span>}</h2>
          <Button onClick={() => setAddOpen(o => !o)} aria-expanded={addOpen}>לקוח חדש +</Button>
        </div>
        {addOpen && <div className={styles.addForm}>
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
        </div>}
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
                    <span className={styles.emailText} title={inv.client_email}>{inv.client_email}</span>
                  </div>
                  <div className={styles.chips}>
                    <div className={styles.pendingChip + ' ' + (inv.client_id ? styles.pendingChipAccept : styles.pendingChipSignup)}>
                      {inv.client_id ? 'ממתין לאישור הלקוח' : 'ממתין להרשמה לאפליקציה'}
                    </div>
                  </div>
                </div>
                {confirmingInviteId === inv.id ? (
                  <div className={styles.rowConfirmGroup}>
                    <button type="button" className={styles.confirmRemoveBtn} onClick={() => removeInvite(inv.id)}>
                      לאשר ביטול?
                    </button>
                    <button type="button" className={styles.cancelRemoveBtn} onClick={() => setConfirmingInviteId(null)}>
                      ביטול
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.removeBtn + ' ' + styles.pendingRemoveBtn} title="בטל הזמנה" aria-label={`בטל את ההזמנה ל-${inv.client_email}`} onClick={() => setConfirmingInviteId(inv.id)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


      </div>
      </section>
    </div>
  );
}
