import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function sendLink() {
    setError('');
    if (!email.trim()) { setError('הזן אימייל'); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true }
    });
    if (error) { setError('שגיאה בשליחת קישור'); return; }
    setSent(true);
  }

  return (
    <div className={styles.wrap} dir="rtl">
      <div className={styles.card}>
        <div className={styles.logo}>Velora Advisor</div>
        {sent ? (
          <div className={styles.sent}>שלחנו לך קישור התחברות למייל — בדוק את תיבת הדואר</div>
        ) : (
          <>
            <input
              className={styles.input}
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button className={styles.button} onClick={sendLink}>שלח קישור התחברות</button>
            {error && <div style={{ color: 'var(--red)', marginTop: 10, fontSize: '0.85rem' }}>{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
