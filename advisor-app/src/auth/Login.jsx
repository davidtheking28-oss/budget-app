import { useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';
import styles from './Login.module.css';

export default function Login() {
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

  return (
    <div className={styles.wrap} dir="rtl" onMouseMove={onMouseMove}>
      <div className={styles.glow} ref={glowRef}></div>
      <div className={styles.diagonal}></div>
      <div className={styles.card}>
        <Logo size="lg" />
        <div className={styles.logo}>Budget Advisor</div>
        <div className={styles.tagline}>קונסולת ניהול לקוחות</div>
        <input
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          aria-label="כתובת אימייל"
          placeholder="email@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && signIn()}
        />
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          aria-label="סיסמה"
          placeholder="סיסמה"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && signIn()}
        />
        <Button className={styles.button} onClick={signIn} disabled={sending}>{sending ? 'מתחבר…' : 'התחבר'}</Button>
        {error && <div className={styles.error} role="alert" aria-live="polite">{error}</div>}
      </div>
    </div>
  );
}
