import { useState } from 'react';
import { useClientList } from '../clients/useClientList.js';
import { useClientDeals } from './useClientDeals.js';
import { percentLabel } from './bizMath.js';
import ClientJourney from './ClientJourney.jsx';
import { journeyProgress, currentStage, nextMeeting, journeyAttention } from './journeyMath.js';
import HeaderAction from './HeaderAction.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { formatDate } from '../budget/monthUtils.js';
import styles from './Business.module.css';

const SERVICE_STATUSES = [
  { key: 'active', label: 'פעיל', tone: 'pillGood' },
  { key: 'frozen', label: 'בהקפאה', tone: 'pillWarn' },
  { key: 'ended', label: 'סיים', tone: '' }
];
const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

function attentionOf(c) {
  const items = [];
  if (c.overdueTasks) items.push(`${c.overdueTasks} משימות באיחור`);
  if (c.waitingDocuments) items.push(`${c.waitingDocuments} מסמכים חסרים`);
  if (c.hasFailedUpload) items.push('העלאת מסמכים נכשלה');
  if (c.hasDeclinedMeeting) items.push('פגישה נדחתה');
  return items;
}

export default function ClientService({ advisorId, onSelect }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const deals = useClientDeals(advisorId);
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [openId, setOpenId] = useState(null);

  if (error) return <ErrorState onRetry={reload} />;
  if (deals.error) return <ErrorState onRetry={deals.reload} />;
  if (loading || deals.loading) return <Skeleton height="220px" radius="18px" />;

  const dealByLink = Object.fromEntries(deals.rows.map(r => [r.id, r]));
  const opened = openId && dealByLink[openId];
  if (opened) return <ClientJourney key={openId} advisorId={advisorId} row={opened} saveDeal={deals.saveDeal} onBack={() => setOpenId(null)} onOpenClient={r => onSelect(r.client_id, r.client_email, { nav: 'crm' })} />;
  const journeyOf = c => dealByLink[c.id]?.deal?.journey;
  const allAttention = c => [...attentionOf(c), ...journeyAttention(journeyOf(c))];
  const statusOf = c => dealByLink[c.id]?.deal?.service_status || 'active';
  const needing = clients.filter(c => allAttention(c).length > 0);
  const activeCount = clients.filter(c => statusOf(c) === 'active').length;
  const endedCount = clients.filter(c => statusOf(c) === 'ended').length;
  const visible = (view === 'attention' ? needing : clients)
    .filter(c => !status || statusOf(c) === status)
    .filter(c => !search.trim() || [c.name, c.client_email].some(v => (v || '').includes(search.trim())));

  return (
    <div className={styles.stack}>
      <HeaderAction targetId="biz-header-sub" fallback={false}><p className={styles.headSub}>{activeCount} לקוחות פעילים בתהליך</p></HeaderAction>
      <section className={styles.bigCard}>
        <div className={styles.grid2 + ' ' + styles.cellGrid}>
          <div className={styles.cell}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true"><svg {...svgProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /></svg></span><span className={styles.statLabel}>לקוחות פעילים</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 'var(--text-stat)' }}>{activeCount}</div>
            <div className={styles.statNote}>בתהליך ליווי כרגע</div>
          </div>
          <div className={styles.cell}>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true"><svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg></span><span className={styles.statLabel}>סיימו את כל התהליך</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 'var(--text-stat)' }}>{endedCount}</div>
            <button type="button" className={styles.linkNote} onClick={() => { setStatus('ended'); setView('all'); }}>עברו לרשימת הלקוחות שסיימו</button>
          </div>
        </div>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="תצוגה">
          <button type="button" className={view === 'all' ? styles.segBtnOn : styles.segBtn} aria-pressed={view === 'all'} onClick={() => setView('all')}>כל הלקוחות {clients.length}</button>
          <button type="button" className={view === 'attention' ? styles.segBtnOn : styles.segBtn} aria-pressed={view === 'attention'} onClick={() => setView('attention')}>דורשים טיפול {needing.length}</button>
        </div>
        <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש לקוח..." aria-label="חיפוש לקוח" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} aria-label="סינון לפי סטטוס" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {SERVICE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <section className={styles.card}>
        {visible.length === 0 ? <div className={styles.emptyState}><span>אין לקוחות בתצוגה הזו</span></div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table + ' ' + styles.denseTable}>
              <thead><tr><th>לקוח</th><th>שלב בתהליך</th><th>הפגישה הבאה</th><th>אחוז התקדמות</th><th>דברים שדורשים טיפול</th><th>סטטוס</th><th><span className={styles.srOnly}>פעולות</span></th></tr></thead>
              <tbody>
                {visible.map(c => {
                  const progress = journeyProgress(journeyOf(c));
                  const attention = allAttention(c);
                  const upcoming = nextMeeting(journeyOf(c));
                  const meetingDate = upcoming?.date || (c.nextMeetingAt ? c.nextMeetingAt.slice(0, 10) : '');
                  const svc = SERVICE_STATUSES.find(s => s.key === statusOf(c));
                  return (
                    <tr key={c.id}>
                      <td className={styles.nameCell}><button type="button" className={styles.sortBtn} title="פתח מסע שירות" onClick={() => setOpenId(c.id)}>{c.name || c.client_email}</button></td>
                      <td><span className={styles.rowMeta}>{currentStage(journeyOf(c))}</span></td>
                      <td>{meetingDate ? <span className={styles.pillBtn + ' ' + styles.pillGood} style={{ cursor: 'default' }}>{formatDate(meetingDate)}</span> : <span className={styles.rowMeta}>{upcoming ? upcoming.title : 'לא נקבעה'}</span>}</td>
                      <td style={{ minWidth: 170 }}>
                        <div className={styles.toolbar} style={{ flexWrap: 'nowrap' }}>
                          <div className={styles.progress} style={{ flex: 1 }}><div className={styles.progressFill} style={{ width: progress.rate * 100 + '%' }} /></div>
                          <span className={styles.num}>{percentLabel(progress.rate)}</span>
                        </div>
                      </td>
                      <td><div className={styles.pills}>{attention.length ? attention.map(a => <span key={a} className={styles.pillBtn + ' ' + styles.pillWarn} style={{ cursor: 'default' }}>{a}</span>) : <span className={styles.rowMeta}>הכול תקין</span>}</div></td>
                      <td>
                        <select className={styles.pillSelect + (svc.tone ? ' ' + styles[svc.tone] : '')} aria-label={'סטטוס לקוח: ' + (c.name || c.client_email)} value={svc.key} onChange={e => deals.saveDeal(dealByLink[c.id], { service_status: e.target.value })}>
                          {SERVICE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </td>
                      <td><button type="button" className={styles.iconBtn} aria-label={'מסע שירות: ' + (c.name || c.client_email)} title="מסע שירות" onClick={() => setOpenId(c.id)}><svg {...svgProps}><path d="M5 12h14M13 6l6 6-6 6" /></svg></button><button type="button" className={styles.iconBtn} aria-label={'פתח לקוח: ' + (c.name || c.client_email)} title="פתח לקוח" onClick={() => onSelect(c.client_id, c.client_email, { nav: 'crm' })}><svg {...svgProps}><path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" /></svg></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
