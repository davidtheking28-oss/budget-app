import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import styles from './NotAdvisor.module.css';

export default function MfaChallenge({ factorId, onVerified }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (busy || code.trim().length !== 6) return;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (err) { setError('לא ניתן לאמת את הקוד. בדוק את הקוד ואת החיבור ונסה שוב.'); return; }
      await onVerified();
    } catch {
      setError('האימות לא הושלם. בדוק את החיבור ונסה שוב.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="mfa-title">
        <h1 id="mfa-title" className={styles.title}>אימות דו־שלבי</h1>
        <p style={{ margin: 0, color: 'var(--text2)', lineHeight: 1.7 }}>הזן את הקוד בן 6 הספרות מאפליקציית האימות שלך.</p>
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          aria-label="קוד אימות"
          disabled={busy}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && code.length === 6 && !busy && verify()}
          style={{ width: '100%', textAlign: 'center', letterSpacing: 8, fontSize: '1.4rem', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        />
        {error && <p role="alert" style={{ margin: 0, color: 'var(--danger, #b42318)' }}>{error}</p>}
        <Button onClick={verify} disabled={code.length !== 6 || busy}>אישור</Button>
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>התנתקות</Button>
      </div>
    </div>
  );
}
