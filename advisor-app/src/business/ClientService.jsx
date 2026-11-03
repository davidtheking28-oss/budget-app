import { useState } from 'react';
import { useClientList } from '../clients/useClientList.js';
import { useClientDeals } from './useClientDeals.js';
import { percentLabel } from './bizMath.js';
import ClientJourney from './ClientJourney.jsx';
import { MEETINGS, readJourney, journeyProgress, currentStage, nextMeeting, journeyAttention } from './journeyMath.js';
import { scheduleJourneyMeeting } from './journeyMeetings.js';
import { toast } from '../toast.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { formatDate } from '../budget/monthUtils.js';
import styles from './Business.module.css';
import service from './ClientService.module.css';

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
  const [meetingDraft, setMeetingDraft] = useState(null);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [meetingError, setMeetingError] = useState(false);

  if (error) return <ErrorState onRetry={reload} />;
  if (deals.error) return <ErrorState onRetry={deals.reload} />;
  if (loading || deals.loading) return <Skeleton height="220px" radius="18px" />;

  const dealByLink = Object.fromEntries(deals.rows.map(r => [r.id, r]));
  const opened = openId && dealByLink[openId];
  if (opened) return <ClientJourney key={openId} advisorId={advisorId} row={opened} saveDeal={deals.saveDeal} onBack={() => setOpenId(null)} onOpenClient={r => onSelect(r.client_id, r.client_email)} />;
  const journeyOf = c => dealByLink[c.id]?.deal?.journey;

  async function registerMeeting(c) {
    if (savingMeeting) return;
    if (!c.client_id) { toast('הלקוח עוד לא מחובר, אי אפשר לשתף איתו', 'error'); return; }
    setSavingMeeting(true);
    setMeetingError(false);
    try {
      const journey = meetingDraft.journey || readJourney(journeyOf(c));
      const key = MEETINGS.find(m => m.title === nextMeeting(journey).title).key;
      const next = await scheduleJourneyMeeting(advisorId, c.client_id, journey, key, meetingDraft.date);
      if (!next) { setMeetingError(true); return; }
      setMeetingDraft(prev => ({ ...prev, journey: next }));
      if (await deals.saveDeal(dealByLink[c.id], { journey: next })) { setMeetingDraft(null); toast('הפגישה נרשמה', 'success'); }
      else setMeetingError(true);
    } catch {
      setMeetingError(true);
    } finally {
      setSavingMeeting(false);
    }
  }
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
      <section className={styles.card + ' ' + service.overview} aria-label="סיכום שירות לקוחות">
        <div className={service.overviewItem}><span className={styles.statLabel}>בליווי פעיל</span><strong>{activeCount}</strong></div>
        <div className={service.overviewItem}><span className={styles.statLabel}>סיימו את התהליך</span><strong>{endedCount}</strong><button type="button" className={styles.linkNote} onClick={() => { setStatus('ended'); setView('all'); }}>הצגת לקוחות שסיימו ←</button></div>
      </section>

      <div className={styles.toolbar + ' ' + service.filters}>
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

      <section className={styles.card + ' ' + service.roster}>
        <div className={service.listHeading}><h3 className={styles.cardTitle}>{view === 'attention' ? 'לקוחות לטיפול' : 'מעקב שירות'}</h3><span className={styles.rowMeta}>{visible.length} לקוחות בתצוגה</span></div>
        {visible.length === 0 ? <div className={styles.emptyState}>
          <strong>{clients.length ? 'אין לקוחות שמתאימים לתצוגה ולסינון' : 'עוד אין לקוחות במעקב השירות'}</strong>
          <p className={styles.note}>{clients.length ? 'אפשר לנקות את החיפוש ולהציג לקוחות מכל הסטטוסים.' : 'לקוחות יופיעו כאן לאחר הוספתם למערכת.'}</p>
          {clients.length > 0 && <button type="button" className={styles.btnGhost} onClick={() => { setSearch(''); setStatus(''); setView('all'); }}>הצג את כל הלקוחות</button>}
        </div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table + ' ' + styles.denseTable}>
              <thead><tr><th>לקוח</th><th>הפגישה הבאה</th><th>התקדמות</th><th>דברים שדורשים טיפול</th><th>סטטוס</th><th><span className={styles.srOnly}>פעולות</span></th></tr></thead>
              <tbody>
                {visible.map(c => {
                  const progress = journeyProgress(journeyOf(c));
                  const attention = allAttention(c);
                  const upcoming = nextMeeting(journeyOf(c));
                  const meetingDate = upcoming?.date || (c.nextMeetingAt ? c.nextMeetingAt.slice(0, 10) : '');
                  const svc = SERVICE_STATUSES.find(s => s.key === statusOf(c));
                  return (
                    <tr key={c.id}>
                      <td className={styles.nameCell} style={{ maxWidth: 200 }}><button type="button" className={styles.sortBtn} style={{ maxWidth: "100%" }} title={c.name || c.client_email} aria-label={"פתח מסע שירות: " + (c.name || c.client_email)} onClick={() => setOpenId(c.id)}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", unicodeBidi: "plaintext" }}>{c.name || c.client_email}</span></button><div className={styles.rowMeta}>{currentStage(journeyOf(c))}</div></td>
                      <td className={service.meetingCell}>
                        {meetingDraft?.id === c.id ? (
                          <div className={service.meetingEditor}>
                            <input className={styles.input} type="date" aria-label={'מועד הפגישה הבאה: ' + (c.name || c.client_email)} disabled={savingMeeting} value={meetingDraft.date} onChange={e => setMeetingDraft({ ...meetingDraft, date: e.target.value })} />
                            <div className={styles.toolbar}><button type="button" className={styles.btn} disabled={savingMeeting} onClick={() => registerMeeting(c)}>{savingMeeting ? 'שומר…' : 'שמירה'}</button>
                            <button type="button" className={styles.btnGhost} disabled={savingMeeting} onClick={() => { setMeetingDraft(null); setMeetingError(false); }}>ביטול</button>{meetingError && <span className={styles.fieldError} role="alert">לא הושלמה שמירת הפגישה. אפשר לנסות שוב.</span>}</div>
                          </div>
                        ) : meetingDate ? <span className={service.meetingDate}>{formatDate(meetingDate)}</span> : <span className={styles.rowMeta}>{upcoming ? upcoming.title + ' · לא נקבעה' : 'הושלמו כל הפגישות'}</span>}
                      </td>
                      <td style={{ minWidth: 170 }}>
                        <div className={styles.toolbar} style={{ flexWrap: 'nowrap' }}>
                          <div className={styles.progress} role="progressbar" aria-label={'התקדמות הליווי: ' + (c.name || c.client_email)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.rate * 100)} style={{ flex: 1 }}><div className={styles.progressFill} style={{ width: progress.rate * 100 + '%' }} /></div>
                          <span className={styles.num}>{percentLabel(progress.rate)}</span>
                        </div>
                      </td>
                      <td className={styles.attentionCell}>
                        {attention.length ? <><div className={styles.attentionLead}>{attention[0]}</div>{attention.length > 1 && <details className={styles.attentionDetails}><summary>ועוד {attention.length - 1} לטיפול</summary><ul>{attention.slice(1).map(item => <li key={item}>{item}</li>)}</ul></details>}</> : <span className={styles.rowMeta}>אין פריטים לטיפול</span>}
                      </td>
                      <td>
                        <select className={styles.pillSelect + (svc.tone ? ' ' + styles[svc.tone] : '')} aria-label={'סטטוס לקוח: ' + (c.name || c.client_email)} value={svc.key} onChange={e => deals.saveDeal(dealByLink[c.id], { service_status: e.target.value })}>
                          {SERVICE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </td>
                      <td><div className={service.rowActions}><button type="button" className={styles.iconBtn} aria-label={'מסע שירות: ' + (c.name || c.client_email)} title="מסע שירות" onClick={() => setOpenId(c.id)}><svg {...svgProps}><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button>{upcoming && <button type="button" className={styles.btnGhost + ' ' + service.scheduleButton} aria-label={'רישום הפגישה הבאה של ' + (c.name || c.client_email)} title="רישום הפגישה הבאה" onClick={() => setMeetingDraft({ id: c.id, date: meetingDate })}><svg {...svgProps}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>תיאום פגישה</button>}</div></td>
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
