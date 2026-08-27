import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import { toast } from '../toast.js';
import styles from './NotAdvisor.module.css';

const CLOCK_ICON = (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
const LOCK_ICON = (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10.5" width="16" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

// Four real states land here, and used to collapse into the same dead-end
// message: a client account opening this app by mistake, someone who hasn't
// applied for advisor access yet, an application still waiting on manual
// approval, and one that was declined. Only "wrong account" is a dead end —
// "haven't applied" gets a real way to apply, right here.
export default function NotAdvisor({ email, userId, requestStatus, onSubmitRequest }) {
  const pending = requestStatus === 'pending';
  const declined = requestStatus === 'declined';
  const none = requestStatus === 'none';
  const [submitting, setSubmitting] = useState(false);

  async function apply() {
    setSubmitting(true);
    const ok = await onSubmitRequest(userId, email);
    setSubmitting(false);
    if (!ok) toast('שגיאה בשליחת הבקשה, נסה שוב', 'error');
  }

  return (
    <div className={styles.wrap} dir="rtl">
      <div className={styles.card}>
        <div className={styles.mark} aria-hidden="true">{pending ? CLOCK_ICON : LOCK_ICON}</div>

        {pending ? (
          <>
            <h1 className={styles.title}>הבקשה שלך ממתינה לאישור</h1>
            <p className={styles.text}>
              בקשת הגישה של <b className={styles.email}>{email}</b> לפלטפורמת היועצים התקבלה ותיבדק בהקדם.
            </p>
            <p className={styles.text}>נעדכן אותך במייל ברגע שהחשבון יאושר.</p>
          </>
        ) : declined ? (
          <>
            <h1 className={styles.title}>הבקשה לא אושרה</h1>
            <p className={styles.text}>
              בקשת הגישה של <b className={styles.email}>{email}</b> לא אושרה. אם מדובר בטעות, צור איתנו קשר.
            </p>
          </>
        ) : none ? (
          <>
            <h1 className={styles.title}>בקש גישה לפלטפורמת היועצים</h1>
            <p className={styles.text}>
              החשבון <b className={styles.email}>{email}</b> עדיין לא רשום כחשבון יועץ. שלח בקשת גישה ונבדוק אותה בהקדם.
            </p>
            <Button className={styles.cta} onClick={apply} disabled={submitting}>{submitting ? 'שולח...' : 'שלח בקשת גישה'}</Button>
          </>
        ) : (
          <>
            <h1 className={styles.title}>אין גישה לפלטפורמת היועצים</h1>
            <p className={styles.text}>
              החשבון <b className={styles.email}>{email}</b> הוא חשבון לקוח, ולא חשבון יועץ.
            </p>
            <p className={styles.text}>
              כדי לנהל את התקציב האישי שלך היכנס לאפליקציית התקציב. כדי להיכנס כיועץ, התנתק והתחבר עם חשבון היועץ.
            </p>
          </>
        )}

        <Button variant="ghost" className={styles.cta} onClick={() => supabase.auth.signOut()}>התנתק</Button>
      </div>
    </div>
  );
}
