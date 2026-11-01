import { useState } from 'react';
import { journeyProgress, currentStage, nextMeeting, journeyAttention } from './journeyMath.js';
import { percentLabel } from './bizMath.js';
import { fmt } from '../format.js';
import styles from './Business.module.css';
import workspace from './ClientWorkspace.module.css';

function formatDay(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function ClientCard({ row, statuses, payments, saveDeal, onBack, onEdit, onRemove, onOpenClient, onOpenJourney }) {
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState(row.deal?.call_summary || '');
  const [summaryStatus, setSummaryStatus] = useState('');
  const name = row.name || row.client_email;
  const journey = row.deal?.journey;
  const progress = journeyProgress(journey);
  const upcoming = nextMeeting(journey);
  const attention = journeyAttention(journey);
  const nextAction = attention[0] || upcoming?.title || currentStage(journey);
  const svc = statuses.find(s => s.key === (row.deal?.service_status || 'active'));
  const pay = payments.find(p => p.key === (row.deal?.payment_status || 'unpaid'));
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('');

  return (
    <div className={styles.stack}>
      <div className={workspace.cardNavigation}>
        <button type="button" className={styles.btnGhost} onClick={onBack}>חזרה ללקוחות</button>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnGhost} onClick={onEdit}>עריכת פרטים</button>
          <details className={workspace.moreActions}>
            <summary>פעולות נוספות</summary>
            {confirming ? <div className={styles.toolbar}><button type="button" className={styles.btnGhost} onClick={onRemove}>לאשר ניתוק?</button><button type="button" className={styles.btnGhost} onClick={() => setConfirming(false)}>ביטול</button></div> : <button type="button" className={styles.btnGhost} onClick={() => setConfirming(true)}>ניתוק לקוח</button>}
          </details>
        </div>
      </div>
      <header className={workspace.clientHeader}>
        <span className={workspace.largeAvatar} aria-hidden="true">{initials}</span>
        <div className={workspace.headerIdentity}>
          <div className={workspace.identityLine}><h2>{name}</h2><span className={styles.pillBtn + (svc.tone ? ' ' + styles[svc.tone] : '')}>{svc.label}</span></div>
          <div className={workspace.contactLine}>
            {row.phone && <a href={`tel:${row.phone}`} dir="ltr">{row.phone}</a>}
            {row.client_email && <span dir="ltr">{row.client_email}</span>}
            {row.deal?.source && <span>מקור: {row.deal.source}</span>}
          </div>
        </div>
        {row.client_id && <button type="button" className={styles.btnGhost} onClick={onOpenClient}>תמונה כלכלית ←</button>}
      </header>
      <section className={workspace.workOverview} aria-label="מצב התהליך והפעולה הבאה">
        <div className={workspace.nextAction}>
          <span className={workspace.eyebrow}>הצעד הבא בתהליך</span>
          <h3>{nextAction}</h3>
          <p>{attention.length ? 'השלמת הפרטים תעזור להתקדם לפגישה הבאה.' : upcoming ? 'כל פרטי הפגישות והמעקב נמצאים במסע השירות.' : 'אפשר לעבור למסע השירות ולעדכן את סיום התהליך.'}</p>
          <button type="button" className={styles.btn} onClick={onOpenJourney}>המשך מסע השירות ←</button>
        </div>
        <div className={workspace.processSnapshot}>
          <div className={workspace.progressHeading}><span className={styles.statLabel}>מצב התהליך</span><strong>{percentLabel(progress.rate)}</strong></div>
          <div className={styles.progress} role="progressbar" aria-label="התקדמות בתהליך" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.rate * 100)}><div className={styles.progressFill} style={{ width: progress.rate * 100 + '%' }} /></div>
          <p className={workspace.currentStage}>{currentStage(journey)}</p>
          <div className={workspace.nextMeeting}><span className={styles.statLabel}>הפגישה הבאה</span><strong>{upcoming?.date ? formatDay(upcoming.date) : upcoming ? 'טרם נקבע מועד' : 'הפגישות הושלמו'}</strong>{upcoming && <span className={styles.rowMeta}>{upcoming.title}</span>}</div>
        </div>
      </section>
      {attention.length > 0 && <div className={workspace.attentionLine}><span className={styles.statLabel}>להשלמת הקליטה</span>{attention.map(item => <span key={item} className={styles.pillBtn + ' ' + styles.pillWarn}>{item}</span>)}</div>}
      <section className={workspace.notes}>
        <div className={workspace.notesHead}><label htmlFor="client-call-summary">סיכום שיחת התאמה</label><span className={styles.rowMeta} role="status">{summaryStatus === 'saving' ? 'שומר…' : summaryStatus === 'saved' ? 'נשמר' : summaryStatus === 'error' ? 'לא נשמר · יש לנסות שוב' : 'נשמר ביציאה מהשדה'}</span></div>
        <textarea id="client-call-summary" className={styles.input + ' ' + styles.textarea} value={summary} placeholder="מה חשוב לזכור לקראת השיחה הבאה?" onChange={e => { setSummary(e.target.value); setSummaryStatus(''); }} onBlur={async () => {
          if (summary === (row.deal?.call_summary || '')) return;
          setSummaryStatus('saving');
          const saved = await saveDeal(row, { call_summary: summary || null });
          setSummaryStatus(saved === false ? 'error' : 'saved');
        }} />
      </section>
      <details className={workspace.billing}>
        <summary><span>פרטי העסקה והתשלום</span><span className={styles.pillBtn + ' ' + styles[pay.tone]}>{pay.label}</span></summary>
        <dl className={workspace.billingGrid}>
          <div><dt>מחיר העסקה</dt><dd>{row.deal?.price != null ? fmt(row.deal.price) : '—'}</dd></div>
          <div><dt>אמצעי תשלום</dt><dd>{row.deal?.payment_method || '—'}</dd></div>
          <div><dt>קבלה</dt><dd>{row.deal?.receipt_issued ? 'הונפקה' : 'לא בוצע'}</dd></div>
          <div><dt>תאריך הצטרפות</dt><dd>{formatDay(row.created_at)}</dd></div>
          <div><dt>תאריך סיום</dt><dd>{formatDay(row.deal?.ends_at)}</dd></div>
        </dl>
      </details>
    </div>
  );
}
