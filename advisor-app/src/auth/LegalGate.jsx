import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import LegalLinks from '../components/LegalLinks.jsx';
import { toast } from '../toast.js';
import { LEGAL_VERSION } from './useLegalConsent.js';
import styles from './NotAdvisor.module.css';

export default function LegalGate({ onAccepted }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  async function accept() {
    setSaving(true);
    const { error } = await supabase.rpc('accept_legal_documents', { p_terms_version: LEGAL_VERSION, p_privacy_version: LEGAL_VERSION, p_age_18: true });
    setSaving(false);
    if (error) { toast('שגיאה בשמירת ההסכמה, נסה שוב', 'error'); return; }
    onAccepted();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="legal-gate-title">
        <h1 id="legal-gate-title" className={styles.title}>לפני שממשיכים</h1>
        <p style={{ margin: 0, color: 'var(--text2)', lineHeight: 1.7 }}>
          הפלטפורמה מעבדת נתונים פיננסיים של לקוחות. כיועץ, אתה מתחייב לשמור עליהם בסודיות ולהשתמש בהם רק לצורך הטיפול בלקוח. כדי להמשיך יש לאשר את התנאים והמדיניות.
        </p>
        <LegalLinks />
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'start', color: 'var(--text)', lineHeight: 1.6, cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18, flex: 'none' }} />
          <span>קראתי ואני מסכים/ה לתנאי השימוש ולמדיניות הפרטיות, מתחייב/ת לשמור בסודיות את נתוני הלקוחות, ואני בן/בת 18 ומעלה.</span>
        </label>
        <Button onClick={accept} disabled={!checked || saving}>המשך</Button>
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>אני לא מסכים/ה, התנתקות</Button>
      </div>
    </div>
  );
}
