import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import styles from './Business.module.css';
import css from './ClientAgreement.module.css';
import { AGREEMENTS_CHANGED } from './useAgreementSigns.js';
import { agreementPrintHtml, formatAuditEvents, formatBirthDate, whenImagesLoaded } from './agreementAudit.js';

export default function ClientAgreement({ clientId, advisorId }) {
  const [record, setRecord] = useState(undefined);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRecord(undefined);
    setError(false);
    supabase.from('client_agreements').select('*').eq('user_id', clientId).order('signed_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) { setError(true); return; }
        setRecord(data || null);
        if (data && advisorId) {
          supabase.from('client_agreement_views').upsert({ advisor_id: advisorId, agreement_id: data.id }, { onConflict: 'advisor_id,agreement_id', ignoreDuplicates: true })
            .then(({ error: viewError }) => { if (!viewError) window.dispatchEvent(new Event(AGREEMENTS_CHANGED)); });
        }
      });
    return () => { cancelled = true; };
  }, [clientId, advisorId, attempt]);

  async function print() {
    const win = window.open('', '_blank');
    if (!win) { toast('הדפדפן חסם את חלון ההדפסה'); return; }
    win.document.write(agreementPrintHtml(record));
    win.document.close();
    await whenImagesLoaded(win.document);
    win.focus();
    win.print();
  }

  if (error) return <ErrorState onRetry={() => setAttempt(n => n + 1)} />;
  if (record === undefined) return <Skeleton height="160px" radius="18px" />;
  if (record === null) {
    return (
      <section className={styles.card}>
        <div className={styles.emptyState}><span>הלקוח טרם חתם על הסכם התקשרות.</span></div>
      </section>
    );
  }

  const events = formatAuditEvents(record);
  const details = [
    ['שם מלא', record.full_name],
    ['תעודת זהות', record.national_id],
    ['תאריך לידה', formatBirthDate(record.birth_date)],
    ['כתובת', record.address],
    ['טלפון', record.phone],
    ['דוא"ל', record.email],
  ];

  return (
    <section className={css.card}>
      <div className={css.head}>
        <h3 className={css.title}>הסכם התקשרות חתום</h3>
        <Button variant="ghost" onClick={print}>הדפסה / שמירה כמסמך</Button>
      </div>
      <dl className={css.details}>
        {details.map(([label, value]) => (
          <div key={label} className={css.detail}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <img className={css.signature} src={record.signature_png} alt="חתימת הלקוח" />
      <table className={css.audit}>
        <thead><tr><th>אירוע</th><th>תאריך ושעה</th><th>כתובת רשת</th><th>מכשיר</th></tr></thead>
        <tbody>
          {events.map(e => (
            <tr key={e.label}><td>{e.label}</td><td>{e.at}</td><td dir="ltr">{e.ip}</td><td dir="ltr">{e.device}</td></tr>
          ))}
        </tbody>
      </table>
      <p className={css.fingerprint}>גרסה <span dir="ltr">{record.version}</span> · טביעת אצבע של הנוסח <span dir="ltr">{record.body_sha256}</span></p>
      <p className={css.fingerprint}>טביעת אצבע של הרשומה <span dir="ltr">{record.record_sha256}</span></p>
      <details className={css.bodyBox}>
        <summary>נוסח ההסכם כפי שנחתם</summary>
        <div className={css.body}>{record.body}</div>
      </details>
    </section>
  );
}
