import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { usePendingInvites } from '../clients/usePendingInvites.js';
import { useClientList } from '../clients/useClientList.js';
import { INVITE_ERROR_MESSAGES } from '../clients/inviteMessages.js';
import { toast } from '../toast.js';
import Skeleton from '../components/Skeleton.jsx';
import { formatDate } from '../budget/monthUtils.js';
import styles from './Business.module.css';

export default function ClientApprovals({ advisorId }) {
  const { invites, loading, reload } = usePendingInvites(advisorId);
  const { clients, loading: clientsLoading } = useClientList(advisorId);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);

  if (loading || clientsLoading) return <Skeleton height="220px" radius="18px" />;

  const waitingApproval = invites.filter(i => i.client_id);
  const waitingSignup = invites.filter(i => !i.client_id);
  const visible = invites.filter(i => !search.trim() || (i.client_email || '').toLowerCase().includes(search.trim().toLowerCase()));

  async function invite() {
    const trimmed = email.trim();
    if (!trimmed) { toast('הזן כתובת אימייל', 'error'); return; }
    setSending(true);
    const { data, error } = await supabase.rpc('invite_client_by_email', { p_email: trimmed });
    setSending(false);
    if (error) { toast('שגיאה בשליחת ההזמנה, נסה שוב', 'error'); return; }
    if (data !== 'ok') { toast(INVITE_ERROR_MESSAGES[data] || 'שגיאה בשליחת ההזמנה', 'error'); return; }
    toast('ההזמנה נשלחה', 'success');
    setEmail('');
    reload();
  }

  async function cancel(id) {
    setConfirmingId(null);
    const { error } = await supabase.from('advisor_clients').delete().eq('id', id).eq('advisor_id', advisorId);
    if (error) { toast('שגיאה בביטול ההזמנה', 'error'); return; }
    toast('ההזמנה בוטלה', 'success');
    reload();
  }

  return (
    <div className={styles.stack}>
      <div className={styles.grid3}>
        <div className={styles.stat}><div className={styles.statLabel}>ממתינים לאישור</div><div className={styles.statValue}>{waitingApproval.length}</div><div className={styles.statNote}>נרשמו ולא אישרו את ההזמנה</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>ממתינים להרשמה</div><div className={styles.statValue}>{waitingSignup.length}</div><div className={styles.statNote}>הוזמנו ועוד לא נרשמו</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>לקוחות פעילים</div><div className={styles.statValue}>{clients.length}</div><div className={styles.statNote}>מחוברים אליך כרגע</div></div>
      </div>

      <section className={styles.card}>
        <div className={styles.toolbar}>
          <input className={styles.input + ' ' + styles.inputGrow} type="email" dir="ltr" placeholder="הזמן לקוח באימייל" aria-label="הזמן לקוח באימייל" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && invite()} />
          <button type="button" className={styles.btn} onClick={invite} disabled={sending}>שלח הזמנה</button>
        </div>
      </section>

      <div className={styles.toolbar}>
        <h2 className={styles.sectionHeading}>הזמנות פתוחות</h2>
        <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש לפי מייל..." aria-label="חיפוש הזמנה" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <section className={styles.card}>
        {visible.length === 0 ? <div className={styles.emptyState}><span>אין הזמנות פתוחות</span></div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>אימייל</th><th>נשלח</th><th>סטטוס</th><th><span className={styles.srOnly}>פעולות</span></th></tr></thead>
              <tbody>
                {visible.map(i => (
                  <tr key={i.id}>
                    <td dir="ltr" className={styles.rowMeta}>{i.client_email}</td>
                    <td className={styles.num}>{formatDate(i.created_at.slice(0, 10))}</td>
                    <td><span className={styles.tag}>{i.client_id ? 'ממתין לאישור הלקוח' : 'ממתין להרשמה לאפליקציה'}</span></td>
                    <td>
                      {confirmingId === i.id ? (
                        <div className={styles.toolbar}>
                          <button type="button" className={styles.btnGhost} onClick={() => cancel(i.id)}>לאשר ביטול?</button>
                          <button type="button" className={styles.btnGhost} onClick={() => setConfirmingId(null)}>חזרה</button>
                        </div>
                      ) : <button type="button" className={styles.btnGhost} aria-label={'בטל הזמנה: ' + i.client_email} onClick={() => setConfirmingId(i.id)}>בטל הזמנה</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
