import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import styles from './NotAdvisor.module.css';

export default function NotAdvisor({ email }) {
  return (
    <div className={styles.wrap} dir="rtl">
      <div className={styles.card}>
        <div className={styles.mark} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10.5" width="16" height="10" rx="2" />
            <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
          </svg>
        </div>
        <h1 className={styles.title}>אין גישה לפלטפורמת היועצים</h1>
        <p className={styles.text}>
          החשבון <b className={styles.email}>{email}</b> הוא חשבון לקוח, ולא חשבון יועץ.
        </p>
        <p className={styles.text}>
          כדי לנהל את התקציב האישי שלך היכנס לאפליקציית התקציב. כדי להיכנס כיועץ, התנתק והתחבר עם חשבון היועץ.
        </p>
        <Button className={styles.cta} onClick={() => supabase.auth.signOut()}>התנתק</Button>
      </div>
    </div>
  );
}
