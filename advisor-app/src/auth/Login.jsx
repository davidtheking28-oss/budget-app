import { useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';
import LegalLinks from '../components/LegalLinks.jsx';
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
    if (sending) return;
    setError('');
    if (!email.trim() || !password) { setError('הזן אימייל וסיסמה'); return; }
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError('לא ניתן להתחבר. בדוק את הפרטים ואת החיבור ונסה שוב.');
    } catch {
      setError('לא ניתן להתחבר. בדוק את החיבור ונסה שוב.');
    } finally {
      setSending(false);
    }
  }

  async function signUp() {
    if (sending) return;
    setError('');
    if (!email.trim() || !password) { setError('הזן אימייל וסיסמה'); return; }
    if (password.length < 6) { setError('הסיסמה חייבת להיות באורך 6 תווים לפחות'); return; }
    setSending(true);
    let created = false;
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) { setError(error.message.includes('already registered') ? 'כבר קיים חשבון עם המייל הזה' : 'שגיאה בהרשמה, נסה שוב'); return; }
      if (data.user) {
        created = true;
        const { error: requestError } = await supabase.from('advisor_access_requests').insert({ user_id: data.user.id, email: email.trim() });
        if (requestError) { setError('החשבון נוצר, אך בקשת הגישה לא נשמרה. התחבר כדי לנסות שוב.'); return; }
      }
      if (!data.session) setMode('signupSent');
    } catch {
      setError(created ? 'החשבון נוצר, אך בקשת הגישה לא נשמרה. התחבר כדי לנסות שוב.' : 'ההרשמה לא הושלמה. בדוק את החיבור ונסה שוב.');
    } finally {
      setSending(false);
    }
  }

  async function sendReset() {
    if (sending) return;
    setError('');
    if (!email.trim()) { setError('הזן אימייל'); return; }
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + import.meta.env.BASE_URL });
      if (error) { setError('לא ניתן לשלוח את הקישור כרגע. נסה שוב.'); return; }
      setMode('sent');
    } catch {
      setError('שליחת הקישור לא הושלמה. בדוק את החיבור ונסה שוב.');
    } finally {
      setSending(false);
    }
  }

  async function setNewPassword() {
    if (sending) return;
    setError('');
    if (!password || password.length < 6) { setError('הסיסמה חייבת להיות באורך 6 תווים לפחות'); return; }
    setSending(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError('שגיאה בעדכון הסיסמה, נסה שוב'); return; }
      onRecoveryDone?.();
    } catch {
      setError('הסיסמה לא עודכנה. בדוק את החיבור ונסה שוב.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.wrap} dir="rtl" onMouseMove={onMouseMove}>
      <div className={styles.glow} ref={glowRef}></div>
      <div className={styles.diagonal}></div>
      <div className={styles.card}>
        <Logo size="lg" />
        <div className={styles.logo}>שקל שקל · יועץ</div>
        <div className={styles.tagline}>
          {mode === 'login' && 'קונסולת ניהול לקוחות'}
          {mode === 'signup' && 'בקשת גישה כיועץ'}
          {mode === 'signupSent' && 'בקשת גישה כיועץ'}
          {mode === 'forgot' && 'איפוס סיסמה'}
          {mode === 'sent' && 'איפוס סיסמה'}
          {mode === 'newPassword' && 'הגדרת סיסמה חדשה'}
        </div>

        {mode === 'signupSent' ? (
          <div className={styles.sent}>
            <div className={styles.sentIcon}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            נשלח קישור אימות למייל שלך — לחץ עליו כדי להשלים את ההרשמה. לאחר מכן הבקשה שלך לגישת יועץ תמתין לאישור ידני.
            <button type="button" className={styles.linkBtn} disabled={sending} onClick={() => setMode('login')}>חזרה להתחברות</button>
          </div>
        ) : mode === 'sent' ? (
          <div className={styles.sent}>
            <div className={styles.sentIcon}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            אם קיים חשבון עם המייל הזה, נשלח אליו קישור לאיפוס סיסמה
            <button type="button" className={styles.linkBtn} disabled={sending} onClick={() => setMode('login')}>חזרה להתחברות</button>
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
              onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? signIn() : mode === 'signup' ? signUp() : sendReset())}
            />
            {(mode === 'login' || mode === 'signup') && (
              <input
                className={styles.input}
                type="password"
                name={mode === 'signup' ? 'new-password' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                spellCheck={false}
                aria-label="סיסמה"
                placeholder="סיסמה"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (mode === 'signup' ? signUp() : signIn())}
              />
            )}
            {mode === 'login' && (
              <Button className={styles.button} onClick={signIn} disabled={sending}>{sending ? 'מתחבר…' : 'התחבר'}</Button>
            )}
            {mode === 'signup' && (
              <Button className={styles.button} onClick={signUp} disabled={sending}>{sending ? 'שולח…' : 'שליחת בקשה'}</Button>
            )}
            {mode === 'forgot' && (
              <Button className={styles.button} onClick={sendReset} disabled={sending}>{sending ? 'שולח…' : 'שלח קישור לאיפוס'}</Button>
            )}
            {error && <div className={styles.error} role="alert" aria-live="polite">{error}</div>}
            {mode === 'login' && (
              <>
                <button type="button" className={styles.linkBtn} disabled={sending} onClick={() => { setMode('forgot'); setError(''); }}>שכחת סיסמה?</button>
                <button type="button" className={styles.linkBtn} disabled={sending} onClick={() => { setMode('signup'); setError(''); }}>יועץ חדש? בקש גישה</button>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot') && (
              <button type="button" className={styles.linkBtn} disabled={sending} onClick={() => { setMode('login'); setError(''); }}>חזרה להתחברות</button>
            )}
          </>
        )}
        <LegalLinks />
      </div>
    </div>
  );
}
