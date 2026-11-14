import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import MfaSettings from '../business/MfaSettings.jsx';
import styles from './NotAdvisor.module.css';

export default function MfaEnroll({ onEnabled }) {
  return (
    <div className={styles.wrap}>
      <div style={{ width: 'min(520px, 100%)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h1 className={styles.title}>נדרש אימות דו־שלבי</h1>
        <p className={styles.text}>הפלטפורמה חושפת נתונים פיננסיים של לקוחות, ולכן החיבור אליה מחייב אימות דו־שלבי. ההפעלה נעשית פעם אחת ולוקחת פחות מדקה.</p>
        <MfaSettings onEnabled={onEnabled} />
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>התנתקות</Button>
      </div>
    </div>
  );
}
