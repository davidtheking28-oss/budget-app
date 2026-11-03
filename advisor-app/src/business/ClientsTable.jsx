import { Fragment, useRef, useState } from 'react';
import { useClientDeals } from './useClientDeals.js';
import { num } from './bizMath.js';
import ClientCard from './ClientCard.jsx';
import AddClientModal from './AddClientModal.jsx';
import ClientJourney from './ClientJourney.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { localISODate } from '../budget/monthUtils.js';
import styles from './Business.module.css';
import workspace from './ClientWorkspace.module.css';
import { currentStage, nextMeeting, journeyAttention } from './journeyMath.js';

const PAYMENT_STATUSES = [
  { key: 'unpaid', label: 'לא שולם', tone: 'pillBad' },
  { key: 'partial', label: 'שולם חלקית', tone: 'pillWarn' },
  { key: 'paid', label: 'שילם', tone: 'pillGood' }
];
const SERVICE_STATUSES = [
  { key: 'active', label: 'פעיל', tone: 'pillGood' },
  { key: 'frozen', label: 'בהקפאה', tone: 'pillWarn' },
  { key: 'ended', label: 'סיים', tone: '' }
];
const PAYMENT_METHODS = ['העברה בנקאית', 'אשראי', 'ביט', 'צ׳ק', 'מזומן', 'תשלומים'];
const SOURCES = ['דף נחיתה', 'הודעות בפרטי', 'פה לאוזן · לקוח ישן', 'המלצה', 'אינסטגרם'];

function formatDay(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function ClientsTable({ advisorId, onOpen, onRemove }) {
  const { rows, loading, error, reload, saveDeal, saveContact, addManual } = useClientDeals(advisorId);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [confirmingId, setConfirmingId] = useState(null);
  const [cardId, setCardId] = useState(null);
  const [journeyId, setJourneyId] = useState(null);
  const tableRef = useRef(null);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const journeyRow = rows.find(r => r.id === journeyId);
  if (journeyRow) return <ClientJourney key={journeyRow.id} advisorId={advisorId} row={journeyRow} saveDeal={saveDeal} onBack={() => setJourneyId(null)} onOpenClient={r => onOpen(r)} />;
  const cardRow = rows.find(r => r.id === cardId);
  if (cardRow) return <ClientCard key={cardRow.id} row={cardRow} statuses={SERVICE_STATUSES} payments={PAYMENT_STATUSES} saveDeal={saveDeal} onBack={() => setCardId(null)} onEdit={() => { setCardId(null); setExpandedId(cardRow.id); setTimeout(() => document.querySelector(`input[data-name-of="${cardRow.id}"]`)?.focus(), 0); }} onRemove={() => { setCardId(null); onRemove(cardRow.id).then(reload); }} onOpenClient={() => onOpen(cardRow)} onOpenJourney={() => setJourneyId(cardRow.id)} />;

  const monthPrefix = localISODate().slice(0, 7);
  const statusOf = r => r.deal?.service_status || 'active';
  const payOf = r => r.deal?.payment_status || 'unpaid';
  const label = r => r.name || r.client_email;
  const sortValue = {
    name: r => (r.name || r.client_email || '').toLocaleLowerCase('he'),
    created_at: r => r.created_at || '',
    ends_at: r => r.deal?.ends_at || '9999',
    price: r => num(r.deal?.price),
    meeting: r => nextMeeting(r.deal?.journey)?.date || '9999'
  };
  const visible = rows
    .filter(r => !status || statusOf(r) === status)
    .filter(r => !search.trim() || [r.name, r.client_email, r.phone].some(v => (v || '').includes(search.trim())))
    .sort((a, b) => {
      if (!sort.key) return 0;
      const av = sortValue[sort.key](a);
      const bv = sortValue[sort.key](b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  const activeCount = rows.filter(r => statusOf(r) === 'active').length;
  const newThisMonth = rows.filter(r => (r.created_at || '').startsWith(monthPrefix)).length;
  const endedCount = rows.filter(r => statusOf(r) === 'ended').length;

  const toggleSort = key => setSort(prev => prev.key === key ? { key, dir: -prev.dir } : { key, dir: 1 });
  const sortHead = (key, text) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={styles.sortBtn} onClick={() => toggleSort(key)}>{text}<span className={styles.sortMark} aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}</span></button>
    </th>
  );

  return (
    <div className={styles.stack}>
      <div className={workspace.listHead}>
        <div><h2 className={workspace.listTitle}>כל הלקוחות</h2><p className={styles.cardSub}>מצב התהליך והצעד הבא, במקום אחד</p></div>
        <button type="button" className={styles.btn} onClick={() => setAdding(true)}>הוסף לקוח +</button>
      </div>
      <div className={workspace.summary} role="group" aria-label="סיכום לקוחות">
        <span><strong>{activeCount}</strong> לקוחות פעילים</span>
        <span><strong>{newThisMonth}</strong> חדשים החודש</span>
        <span><strong>{endedCount}</strong> סיימו את התהליך</span>
      </div>
      <div className={workspace.filters}>
        <input className={styles.input} type="search" placeholder="חיפוש לפי שם, טלפון או אימייל..." aria-label="חיפוש לקוח" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} aria-label="סינון לפי סטטוס" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {SERVICE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <span className={workspace.resultCount} role="status">{visible.length} מתוך {rows.length} לקוחות</span>
      </div>
      <section className={workspace.roster} aria-label="רשימת לקוחות">
        {visible.length === 0 ? <div className={styles.emptyState}>
          <strong>{rows.length ? 'לא נמצאו לקוחות שמתאימים לחיפוש ולסינון' : 'עוד אין לקוחות ברשימה'}</strong>
          <p className={styles.note}>{rows.length ? 'נסה שם, טלפון או אימייל אחר, או נקה את הסינון.' : 'אפשר להתחיל בהוספת לקוח חדש.'}</p>
          {rows.length > 0 && <button type="button" className={styles.btnGhost} onClick={() => { setSearch(''); setStatus(''); }}>נקה חיפוש וסינון</button>}
        </div> : (
          <div className={styles.tableWrap} ref={tableRef}>
            <table className={styles.table + ' ' + workspace.rosterTable}>
              <thead><tr>{sortHead('name', 'לקוח')}<th>מצב התהליך</th><th>השלב הבא</th>{sortHead('meeting', 'הפגישה הבאה')}<th><span className={styles.srOnly}>פרטים ועריכה</span></th></tr></thead>
              <tbody>
                {visible.map(r => {
                  const pay = PAYMENT_STATUSES.find(p => p.key === payOf(r));
                  const svc = SERVICE_STATUSES.find(s => s.key === statusOf(r));
                  const upcoming = nextMeeting(r.deal?.journey);
                  const nextAction = journeyAttention(r.deal?.journey)[0] || upcoming?.title || currentStage(r.deal?.journey);
                  return (
                    <Fragment key={r.id}>
                      <tr className={workspace.overviewRow}>
                        <td>
                          <button type="button" className={workspace.clientName} aria-label={'פתח כרטיס לקוח: ' + label(r)} onClick={() => setCardId(r.id)}>
                            <span className={workspace.avatar} aria-hidden="true">{(r.name || r.client_email || '?').trim()[0]}</span>
                            <span className={workspace.identity}><strong>{r.name || 'ללא שם'}</strong><span dir="ltr" title={r.client_email}>{r.client_email || 'לקוח ידני'}</span></span>
                          </button>
                        </td>
                        <td><select className={styles.pillSelect + (svc.tone ? ' ' + styles[svc.tone] : '')} aria-label={'סטטוס לקוח: ' + label(r)} value={svc.key} onChange={e => saveDeal(r, { service_status: e.target.value })}>{SERVICE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select><div className={workspace.stage}>{currentStage(r.deal?.journey)}</div></td>
                        <td><button type="button" className={workspace.nextStep} onClick={() => setJourneyId(r.id)} aria-label={'פתח מסע שירות: ' + label(r)}>{nextAction}<span aria-hidden="true">←</span></button></td>
                        <td className={workspace.meetingDate}>{upcoming?.date ? formatDay(upcoming.date) : <span className={styles.rowMeta}>{upcoming ? 'טרם נקבעה' : 'הפגישות הושלמו'}</span>}</td>
                        <td><button type="button" className={workspace.expandButton} aria-label={'פרטים ועריכה: ' + label(r)} aria-expanded={expandedId === r.id} aria-controls={'client-details-' + r.id} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>{expandedId === r.id ? 'סגירה' : 'פרטים'}<span aria-hidden="true">{expandedId === r.id ? '−' : '+'}</span></button></td>
                      </tr>
                      {expandedId === r.id && <tr><td colSpan={5} className={workspace.detailCell}>
                        <div id={'client-details-' + r.id} className={workspace.inlineDetails}>
                          <div className={workspace.detailsHead}><h3>פרטי לקוח ועסקה</h3><span className={styles.rowMeta}>שדות טקסט נשמרים ביציאה מהשדה. פרטי העסקה גלויים לך בלבד.</span></div>
                          <div className={workspace.detailGrid}>
                              <div className={workspace.detailField}><span className={styles.statLabel}>שם מלא ואימייל</span><input className={styles.input + ' ' + styles.ghostField + ' ' + styles.nameCell} data-name-of={r.id} placeholder="ללא שם" aria-label={'שם: ' + label(r)} defaultValue={r.name || ''} onBlur={e => { if (e.target.value.trim() !== (r.name || '')) saveContact(r, { name: e.target.value.trim() || null }); }} /><div dir="ltr" className={styles.rowMeta + ' ' + styles.emailUnder} title={r.client_email}>{r.client_email || '—'}</div></div>
                              <div className={workspace.detailField}><span className={styles.statLabel}>טלפון</span><input className={styles.input + ' ' + styles.ghostField} dir="ltr" placeholder="—" style={{ width: 112 }} aria-label={'טלפון: ' + label(r)} defaultValue={r.phone || ''} onBlur={e => { if (e.target.value.trim() !== (r.phone || '')) saveContact(r, { phone: e.target.value.trim() || null }); }} /></div>
                              <div className={workspace.detailField}><span className={styles.statLabel}>הצטרפות</span>{formatDay(r.created_at)}</div>
                              <div className={workspace.detailField}><span className={styles.statLabel}>תאריך סיום</span><label className={styles.dateCell}><span>{formatDay(r.deal?.ends_at)}</span><input className={styles.dateHidden} type="date" aria-label={'תאריך סיום: ' + label(r)} value={r.deal?.ends_at || ''} onClick={e => e.target.showPicker?.()} onChange={e => saveDeal(r, { ends_at: e.target.value || null })} /></label></div>
                              <div className={workspace.detailField}><span className={styles.statLabel}>מחיר העסקה</span><input className={styles.input + ' ' + styles.ghostField + ' ' + styles.numInput} style={{ width: 84 }} inputMode="decimal" placeholder="—" aria-label={'מחיר העסקה: ' + label(r)} defaultValue={r.deal?.price ?? ''} onBlur={e => { const v = e.target.value.trim(); if (v !== String(r.deal?.price ?? '')) saveDeal(r, { price: v === '' ? null : Math.max(0, num(v)) }); }} /></div>
                              <div className={workspace.detailField}><span className={styles.statLabel}>סטטוס תשלום</span><select className={styles.pillSelect + ' ' + styles[pay.tone]} aria-label={'סטטוס תשלום: ' + label(r)} value={pay.key} onChange={e => saveDeal(r, { payment_status: e.target.value })}>
                          {PAYMENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select></div>
                              <div className={workspace.detailField}><span className={styles.statLabel}>אמצעי תשלום</span><select className={styles.select + ' ' + styles.ghostField} aria-label={'אמצעי תשלום: ' + label(r)} value={r.deal?.payment_method || ''} onChange={e => saveDeal(r, { payment_method: e.target.value || null })}>
                          <option value="">—</option>
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select></div>
                              <div className={workspace.detailField}><span className={styles.statLabel}>קבלה</span><button type="button" className={styles.pillBtn + ' ' + (r.deal?.receipt_issued ? styles.pillGood : styles.pillWarn)} aria-pressed={!!r.deal?.receipt_issued} aria-label={'קבלה: ' + label(r)} onClick={() => saveDeal(r, { receipt_issued: !r.deal?.receipt_issued })}>{r.deal?.receipt_issued ? 'הונפקה' : 'לא הונפקה'}</button></div>
                              <div className={workspace.detailField}><span className={styles.statLabel}>מקור</span><select className={styles.select + ' ' + styles.ghostField} aria-label={'מקור: ' + label(r)} value={r.deal?.source || ''} onChange={e => saveDeal(r, { source: e.target.value || null })}>
                          <option value="">—</option>
                          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select></div>
                          </div>
                          <div className={workspace.detailActions}>
                            {confirmingId === r.id ? <><button type="button" className={styles.btnGhost} onClick={() => { setConfirmingId(null); onRemove(r.id).then(reload); }}>לאשר ניתוק?</button><button type="button" className={styles.btnGhost} onClick={() => setConfirmingId(null)}>ביטול</button></> : <button type="button" className={styles.btnGhost} aria-label={'נתק לקוח: ' + label(r)} onClick={() => setConfirmingId(r.id)}>נתק לקוח</button>}
                            <button type="button" className={styles.btnGhost} onClick={() => setCardId(r.id)}>פתיחת כרטיס לקוח</button>
                          </div>
                        </div>
                      </td></tr>}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {adding && <AddClientModal methods={PAYMENT_METHODS} sources={SOURCES} onSave={addManual} onClose={() => setAdding(false)} />}
    </div>
  );
}
