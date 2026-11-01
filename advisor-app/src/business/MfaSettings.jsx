import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import styles from './Business.module.css';

export default function MfaSettings() {
  const [verified, setVerified] = useState(null);
  const [enrolling, setEnrolling] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setVerified(data?.totp || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function start() {
    setBusy(true);
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all || []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator ' + Date.now() });
    setBusy(false);
    if (error || !data) { toast('לא ניתן להתחיל את ההפעלה, נסה שוב', 'error'); return; }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode('');
  }

  async function confirm() {
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
    setBusy(false);
    if (error) { toast('הקוד שגוי, נסה שוב', 'error'); setCode(''); return; }
    setEnrolling(null);
    toast('האימות הדו־שלבי הופעל', 'success');
    load();
  }

  async function cancel() {
    await supabase.auth.mfa.unenroll({ factorId: enrolling.id });
    setEnrolling(null);
  }

  async function turnOff() {
    setBusy(true);
    let failed = false;
    for (const f of verified) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) failed = true;
    }
    setBusy(false);
    setConfirmOff(false);
    toast(failed ? 'לא ניתן לכבות, נסה להתחבר מחדש' : 'האימות הדו־שלבי כובה', failed ? 'error' : 'success');
    load();
  }

  if (verified === null) return null;
  const on = verified.length > 0;

  return (
    <section className={styles.card} style={{ padding: 'var(--space-4)' }}>
      <div className={styles.formStack}>
        <h2 className={styles.sectionHeading}>אבטחת חשבון</h2>
        <p className={styles.cardSub}>יועץ ניגש לנתונים הפיננסיים של לקוחות. אימות דו־שלבי מוסיף קוד מהטלפון לכל התחברות, כך שגם אם הסיסמה תודלף, אי אפשר להיכנס.</p>
        {!enrolling && (
          <div className={styles.toolbar}>
            <span className={styles.tag}>{on ? 'פעיל' : 'כבוי'}</span>
            {!on && <button type="button" className={styles.btn} onClick={start} disabled={busy}>הפעלה</button>}
            {on && !confirmOff && <button type="button" className={styles.btnGhost} onClick={() => setConfirmOff(true)}>כיבוי</button>}
            {on && confirmOff && (
              <>
                <button type="button" className={styles.btnGhost} onClick={turnOff} disabled={busy}>לכבות את האימות הדו־שלבי?</button>
                <button type="button" className={styles.btnGhost} onClick={() => setConfirmOff(false)}>חזרה</button>
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
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && !busy && confirm()}
            />
            <div className={styles.toolbar}>
              <button type="button" className={styles.btn} onClick={confirm} disabled={code.length !== 6 || busy}>אישור והפעלה</button>
              <button type="button" className={styles.btnGhost} onClick={cancel}>ביטול</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
