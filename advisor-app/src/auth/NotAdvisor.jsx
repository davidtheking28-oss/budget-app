import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
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

// Three real states land here, and each used to show the same dead-end
// message: a client account opening this app by mistake, a signup still
// waiting on manual approval, and a signup that was declined. Only the first
// one is actually "wrong account" — the other two are "you did this right,
// it's just not done yet."
export default function NotAdvisor({ email, requestStatus }) {
  const pending = requestStatus === 'pending';
  const declined = requestStatus === 'declined';

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

        <Button className={styles.cta} onClick={() => supabase.auth.signOut()}>התנתק</Button>
      </div>
    </div>
  );
}
