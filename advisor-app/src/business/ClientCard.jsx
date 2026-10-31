import { useState } from 'react';
import { journeyProgress, currentStage, nextMeeting, journeyAttention } from './journeyMath.js';
import { percentLabel } from './bizMath.js';
import { fmt } from '../format.js';
import styles from './Business.module.css';

function formatDay(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function ClientCard({ row, statuses, payments, saveDeal, onBack, onEdit, onRemove, onOpenClient, onOpenJourney }) {
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState(row.deal?.call_summary || '');
  const name = row.name || row.client_email;
  const journey = row.deal?.journey;
  const progress = journeyProgress(journey);
  const upcoming = nextMeeting(journey);
  const attention = journeyAttention(journey);
  const svc = statuses.find(s => s.key === (row.deal?.service_status || 'active'));
  const pay = payments.find(p => p.key === (row.deal?.payment_status || 'unpaid'));
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('');

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
        <button type="button" className={styles.btnGhost} onClick={onBack}>חזרה ללקוחות</button>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnGhost} onClick={onEdit}>עריכה</button>
          {confirming ? (
            <>
              <button type="button" className={styles.btnGhost} onClick={onRemove}>לאשר מחיקה?</button>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirming(false)}>ביטול</button>
            </>
          ) : <button type="button" className={styles.btnGhost} onClick={() => setConfirming(true)}>מחיקה</button>}
        </div>
      </div>

      <section className={styles.bigCard}>
        <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
          <div className={styles.toolbar}>
            <span className={styles.iconTile} aria-hidden="true">{initials}</span>
            <div>
              <h2 className={styles.viewHeading} style={{ fontSize: 'var(--text-xl)' }}>{name}</h2>
              <div className={styles.rowMeta}>
                <span className={styles.pillBtn + (svc.tone ? ' ' + styles[svc.tone] : '')} style={{ cursor: 'default' }}>{svc.label}</span>
                {row.deal?.source && <> · מקור: {row.deal.source}</>}
                {row.phone && <> · <a href={`tel:${row.phone}`} dir="ltr">{row.phone}</a></>}
              </div>
            </div>
          </div>
          {row.client_id && <button type="button" className={styles.btn} onClick={onOpenClient}>תצוגת לקוח</button>}
        </div>
        <div className={styles.statLabel} style={{ marginTop: 16 }}>התקדמות בתהליך</div>
        <div className={styles.toolbar} style={{ flexWrap: 'nowrap' }}>
          <div className={styles.progress} style={{ flex: 1 }}><div className={styles.progressFill} style={{ width: progress.rate * 100 + '%' }} /></div>
          <span className={styles.num}>{percentLabel(progress.rate)}</span>
        </div>
        <p className={styles.cardSub}>{currentStage(journey)}</p>
      </section>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>פרטי העסקה</h3>
          <dl className={styles.grid2} style={{ margin: 0 }}>
            <div><dt className={styles.statLabel}>מחיר העסקה</dt><dd className={styles.statValue} style={{ margin: 0 }}>{row.deal?.price != null ? fmt(row.deal.price) : '—'}</dd></div>
            <div><dt className={styles.statLabel}>אמצעי תשלום</dt><dd style={{ margin: 0 }}>{row.deal?.payment_method || '—'}</dd></div>
            <div><dt className={styles.statLabel}>האם שילם</dt><dd style={{ margin: 0 }}>{pay.label}</dd></div>
            <div><dt className={styles.statLabel}>האם קיבל קבלה</dt><dd style={{ margin: 0 }}>{row.deal?.receipt_issued ? 'הונפקה' : 'לא בוצע'}</dd></div>
            <div><dt className={styles.statLabel}>תאריך הצטרפות</dt><dd style={{ margin: 0 }}>{formatDay(row.created_at)}</dd></div>
            <div><dt className={styles.statLabel}>תאריך סיום</dt><dd style={{ margin: 0 }}>{formatDay(row.deal?.ends_at)}</dd></div>
          </dl>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>מסע השירות</h3>
            <button type="button" className={styles.btnGhost} onClick={onOpenJourney}>פתח מסע שירות</button>
          </div>
          <div className={styles.statLabel}>השלב הנוכחי</div>
          <p className={styles.cardSub}>{currentStage(journey)}</p>
          <div className={styles.statLabel}>הפגישה הבאה</div>
          <p className={styles.cardSub}>{upcoming ? upcoming.title + (upcoming.date ? ' · ' + formatDay(upcoming.date) : '') : 'הושלמו כל הפגישות'}</p>
          <div className={styles.statLabel}>דברים שדורשים טיפול</div>
          <div className={styles.pills}>{attention.length ? attention.map(a => <span key={a} className={styles.pillBtn + ' ' + styles.pillWarn} style={{ cursor: 'default' }}>{a}</span>) : <span className={styles.rowMeta}>הכול תקין</span>}</div>
        </section>
      </div>

      <section className={styles.card}>
        <label className={styles.fieldLabel}>סיכום שיחת התאמה
          <textarea className={styles.input + ' ' + styles.textarea} value={summary} onChange={e => setSummary(e.target.value)} onBlur={() => { if (summary !== (row.deal?.call_summary || '')) saveDeal(row, { call_summary: summary || null }); }} />
        </label>
      </section>
    </div>
  );
}
