import { useState } from 'react';
import { useClientList } from '../clients/useClientList.js';
import { ratio, percentLabel } from './bizMath.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { formatDate } from '../budget/monthUtils.js';
import styles from './Business.module.css';

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
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const needing = clients.filter(c => attentionOf(c).length > 0);
  const finished = clients.filter(c => c.totalTasks > 0 && c.openTasks === 0);
  const visible = (view === 'attention' ? needing : clients).filter(c => !search.trim() || [c.name, c.client_email].some(v => (v || '').includes(search.trim())));

  return (
    <div className={styles.stack}>
      <section className={styles.bigCard}>
        <div className={styles.grid2}>
          <div>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true">◎</span><span className={styles.statLabel}>לקוחות פעילים</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 36 }}>{clients.length}</div>
            <div className={styles.statNote}>בתהליך ליווי כרגע</div>
          </div>
          <div>
            <div className={styles.toolbar}><span className={styles.iconTile} aria-hidden="true">✓</span><span className={styles.statLabel}>סיימו את כל התהליך</span></div>
            <div className={styles.bigNumber} style={{ fontSize: 36 }}>{finished.length}</div>
            <div className={styles.statNote}>אין להם משימות פתוחות</div>
          </div>
        </div>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="תצוגה">
          <button type="button" className={view === 'all' ? styles.segBtnOn : styles.segBtn} aria-pressed={view === 'all'} onClick={() => setView('all')}>כל הלקוחות {clients.length}</button>
          <button type="button" className={view === 'attention' ? styles.segBtnOn : styles.segBtn} aria-pressed={view === 'attention'} onClick={() => setView('attention')}>דורשים טיפול {needing.length}</button>
        </div>
        <input className={styles.input + ' ' + styles.inputGrow} type="search" placeholder="חיפוש לקוח..." aria-label="חיפוש לקוח" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <section className={styles.card}>
        {visible.length === 0 ? <div className={styles.emptyState}><span>אין לקוחות בתצוגה הזו</span></div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>לקוח</th><th>הפגישה הבאה</th><th>אחוז התקדמות</th><th>דברים שדורשים טיפול</th><th /></tr></thead>
              <tbody>
                {visible.map(c => {
                  const rate = ratio(c.doneTasks, c.totalTasks);
                  const attention = attentionOf(c);
                  return (
                    <tr key={c.id}>
                      <td className={styles.taskName}>{c.name || c.client_email}</td>
                      <td>{c.nextMeetingAt ? formatDate(c.nextMeetingAt.slice(0, 10)) : <span className={styles.rowMeta}>לא נקבעה</span>}</td>
                      <td style={{ minWidth: 160 }}>
                        <div className={styles.toolbar}>
                          <div className={styles.progress} style={{ flex: 1 }}><div className={styles.progressFill} style={{ width: (rate || 0) * 100 + '%' }} /></div>
                          <span className={styles.num}>{rate === null ? '0%' : percentLabel(rate)}</span>
                        </div>
                      </td>
                      <td><div className={styles.pills}>{attention.length ? attention.map(a => <span key={a} className={styles.tag + ' ' + styles.tagHigh}>{a}</span>) : <span className={styles.rowMeta}>הכול תקין</span>}</div></td>
                      <td><button type="button" className={styles.btnGhost} onClick={() => onSelect(c.client_id, c.client_email, { nav: 'crm' })}>פתח לקוח</button></td>
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
