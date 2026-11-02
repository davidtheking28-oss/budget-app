import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import ErrorState from '../components/ErrorState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Business.module.css';

export default function MfaSettings() {
  const [verified, setVerified] = useState(null);
  const [enrolling, setEnrolling] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setLoadError(true); return; }
      setVerified(data?.totp || []);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function start() {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const { data: all, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) { setActionError('לא ניתן להתחיל את ההפעלה, נסה שוב.'); return; }
      for (const f of all?.all || []) if (f.status === 'unverified') {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) { setActionError('לא ניתן להתחיל את ההפעלה, נסה שוב.'); return; }
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator ' + Date.now() });
      if (error || !data) { setActionError('לא ניתן להתחיל את ההפעלה, נסה שוב.'); return; }
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode('');
    } catch {
      setActionError('לא ניתן להתחיל את ההפעלה. בדוק את החיבור ונסה שוב.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy || code.trim().length !== 6) return;
    setBusy(true);
    setActionError('');
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
      if (error) { setActionError('לא ניתן לאמת את הקוד. בדוק את הקוד ואת החיבור ונסה שוב.'); return; }
      setEnrolling(null);
      setCode('');
      toast('האימות הדו־שלבי הופעל', 'success');
      await load();
    } catch {
      setActionError('האימות לא הושלם. בדוק את החיבור ונסה שוב.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolling.id });
      if (error) { setActionError('ביטול ההפעלה לא הושלם. אפשר לנסות שוב.'); return; }
      setEnrolling(null);
      setCode('');
    } catch {
      setActionError('ביטול ההפעלה לא הושלם. בדוק את החיבור ונסה שוב.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      let failed = false;
      for (const f of verified) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) failed = true;
      }
      if (failed) setActionError('לא ניתן לכבות, נסה להתחבר מחדש.');
      else { setConfirmOff(false); toast('האימות הדו־שלבי כובה', 'success'); }
      await load();
    } catch {
      setActionError('הכיבוי לא הושלם. בדוק את החיבור ונסה שוב.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorState message="לא הצלחנו לטעון את הגדרות האימות" onRetry={load} />;
  if (verified === null) return <Skeleton height="100px" />;

  const on = verified.length > 0;

  return (
    <section className={styles.card} style={{ padding: 'var(--space-4)' }}>
      <div className={styles.formStack}>
        <h2 className={styles.sectionHeading}>אבטחת חשבון</h2>
        <p className={styles.cardSub}>יועץ ניגש לנתונים הפיננסיים של לקוחות. אימות דו־שלבי מוסיף קוד מהטלפון לכל התחברות, כך שגם אם הסיסמה תודלף, אי אפשר להיכנס.</p>
        {actionError && <p className={styles.fieldError} role="alert">{actionError}</p>}
        {busy && <p className={styles.note} role="status">מבצע את הפעולה…</p>}
        {!enrolling && (
          <div className={styles.toolbar}>
            <span className={styles.tag}>{on ? 'פעיל' : 'כבוי'}</span>
            {!on && <button type="button" className={styles.btn} onClick={start} disabled={busy}>הפעלה</button>}
            {on && !confirmOff && <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => setConfirmOff(true)}>כיבוי</button>}
            {on && confirmOff && (
              <>
                <button type="button" className={styles.btnGhost} onClick={turnOff} disabled={busy}>לכבות את האימות הדו־שלבי?</button>
                <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => setConfirmOff(false)}>חזרה</button>
              </>
            )}
          </div>
        )}
        {enrolling && (
          <div className={styles.formStack}>
            <p className={styles.note} style={{ margin: 0 }}>1. פתח אפליקציית אימות (Google Authenticator, Microsoft Authenticator או דומה) וסרוק את הקוד.</p>
            <img src={enrolling.qr} alt="קוד לסריקה באפליקציית האימות" width="180" height="180" style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
            <p className={styles.note} style={{ margin: 0 }}>אם אי אפשר לסרוק, הזן ידנית את המפתח:</p>
            <code dir="ltr" style={{ userSelect: 'all', wordBreak: 'break-all' }}>{enrolling.secret}</code>
            <p className={styles.note} style={{ margin: 0 }}>2. הזן את הקוד בן 6 הספרות שמוצג באפליקציה.</p>
            <input
              className={styles.input}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              dir="ltr"
              aria-label="קוד אימות"
              disabled={busy}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && !busy && confirm()}
            />
            <div className={styles.toolbar}>
              <button type="button" className={styles.btn} onClick={confirm} disabled={code.length !== 6 || busy}>אישור והפעלה</button>
              <button type="button" className={styles.btnGhost} disabled={busy} onClick={cancel}>ביטול</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
