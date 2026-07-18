import { useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';
import styles from './Login.module.css';

export default function Login({ recovery, onRecoveryDone }) {
  const [mode, setMode] = useState(recovery ? 'newPassword' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  async function signIn() {
    setError('');
    if (!email.trim() || !password) { setError('הזן אימייל וסיסמה'); return; }
    setSending(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    setSending(false);
    if (error) { setError('אימייל או סיסמה שגויים'); return; }
  }

  async function sendReset() {
    setError('');
    if (!email.trim()) { setError('הזן אימייל'); return; }
    setSending(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + import.meta.env.BASE_URL
    });
    setSending(false);
    setMode('sent');
  }

  async function setNewPassword() {
    setError('');
    if (!password || password.length < 6) { setError('הסיסמה חייבת להיות באורך 6 תווים לפחות'); return; }
    setSending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSending(false);
    if (error) { setError('שגיאה בעדכון הסיסמה, נסה שוב'); return; }
    onRecoveryDone?.();
  }

  return (
    <div className={styles.wrap} dir="rtl" onMouseMove={onMouseMove}>
      <div className={styles.glow} ref={glowRef}></div>
      <div className={styles.diagonal}></div>
      <div className={styles.card}>
        <Logo size="lg" />
        <div className={styles.logo}>Budget Advisor</div>
        <div className={styles.tagline}>קונסולת ניהול לקוחות</div>

        {mode === 'sent' ? (
          <div className={styles.sent}>
            <div className={styles.sentIcon}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            אם קיים חשבון עם המייל הזה, נשלח אליו קישור לאיפוס סיסמה
            <button type="button" className={styles.linkBtn} onClick={() => setMode('login')}>חזרה להתחברות</button>
          </div>
        ) : mode === 'newPassword' ? (
          <>
            <input
              className={styles.input}
              type="password"
              name="new-password"
              autoComplete="new-password"
              spellCheck={false}
              aria-label="סיסמה חדשה"
              placeholder="סיסמה חדשה"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setNewPassword()}
            />
            <Button className={styles.button} onClick={setNewPassword} disabled={sending}>{sending ? 'שומר…' : 'שמור סיסמה חדשה'}</Button>
            {error && <div className={styles.error} role="alert" aria-live="polite">{error}</div>}
          </>
        ) : (
          <>
            <input
              className={styles.input}
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              aria-label="כתובת אימייל"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? signIn() : sendReset())}
            />
            {mode === 'login' && (
              <input
                className={styles.input}
                type="password"
                name="password"
                autoComplete="current-password"
                spellCheck={false}
                aria-label="סיסמה"
                placeholder="סיסמה"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && signIn()}
              />
            )}
            {mode === 'login' ? (
              <Button className={styles.button} onClick={signIn} disabled={sending}>{sending ? 'מתחבר…' : 'התחבר'}</Button>
            ) : (
              <Button className={styles.button} onClick={sendReset} disabled={sending}>{sending ? 'שולח…' : 'שלח קישור לאיפוס'}</Button>
            )}
            {error && <div className={styles.error} role="alert" aria-live="polite">{error}</div>}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(''); }}
            >
              {mode === 'login' ? 'שכחת סיסמה?' : 'חזרה להתחברות'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
