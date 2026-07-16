import { useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const glowRef = useRef(null);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onMouseMove(e) {
    if (!glowRef.current || reducedMotion) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 40;
    const y = (e.clientY / window.innerHeight - 0.5) * 40;
    glowRef.current.style.transform = `translate(${x}px, ${y}px)`;
  }

  async function sendLink() {
    setError('');
    if (!email.trim()) { setError('הזן אימייל'); return; }
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true }
    });
    setSending(false);
    if (error) { setError('שגיאה בשליחת קישור'); return; }
    setSent(true);
  }

  return (
    <div className={styles.wrap} dir="rtl" onMouseMove={onMouseMove}>
      <div className={styles.glow} ref={glowRef}></div>
      <div className={styles.diagonal}></div>
      <div className={styles.card}>
        <div className={styles.mark}></div>
        <div className={styles.logo}>Budget Advisor</div>
        <div className={styles.tagline}>קונסולת ניהול לקוחות</div>
        {sent ? (
          <div className={styles.sent}>
            <div className={styles.sentIcon}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            שלחנו לך קישור התחברות למייל, בדוק את תיבת הדואר
          </div>
        ) : (
          <>
            <input
              className={styles.input}
              type="email"
              name="email"
              autoComplete="email"
              aria-label="כתובת אימייל"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendLink()}
            />
            <Button className={styles.button} onClick={sendLink} disabled={sending}>{sending ? 'שולח…' : 'שלח קישור התחברות'}</Button>
            {error && <div className={styles.error} role="alert" aria-live="polite">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
