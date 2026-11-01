import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientList } from './useClientList.js';
import { usePendingInvites } from './usePendingInvites.js';
import { usePipeline } from './usePipeline.js';
import { useProspects } from './useProspects.js';
import PipelineModal from './PipelineModal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import { toast } from '../toast.js';
import styles from './ClientList.module.css';
import ClientsTable from '../business/ClientsTable.jsx';

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const { invites: pendingInvites, reload: reloadInvites } = usePendingInvites(advisorId);
  const { leads, loading: leadsLoading, addLead, setStage: setLeadStage, deleteLead } = usePipeline(advisorId);
  const { loading: prospectsLoading, error: prospectsError } = useProspects(advisorId);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [confirmingInviteId, setConfirmingInviteId] = useState(null);


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
          <div className={styles.emptyText}>שלח ללקוח את קישור ההרשמה ממסך "אישור לקוחות". אחרי שיירשם ותאשר אותו, הוא יופיע כאן</div>
        </div>
      ) : (
        <ClientsTable advisorId={advisorId} onOpen={r => onSelect(r.client_id, r.client_email)} onRemove={removeClient} />
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
        <span>הזמנות</span><span>{pendingInvites.length} הזמנות ממתינות <span aria-hidden="true">{secondaryOpen ? '−' : '+'}</span></span>
      </button>
      <div id="client-secondary" hidden={!secondaryOpen}>
      {leads.length > 0 && <Button variant="ghost" onClick={() => setPipelineOpen(true)}>לקוחות חדשים בטיפול ({leads.length})</Button>}
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionTitle}>חיבור לקוחות והזמנות {clients.length > 0 && <span className={styles.kbdHint}>{navigator.platform.startsWith('Mac') ? '⌘K' : 'Ctrl+K'} לחיפוש מהיר</span>}</h2>
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
