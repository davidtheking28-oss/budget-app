import { useEffect, useRef, useState } from 'react';
import { useAdvisorProfile } from '../auth/useAdvisorProfile.js';
import { DEFAULT_BRAND } from '../brandColor.js';
import { toast } from '../toast.js';
import Skeleton from '../components/Skeleton.jsx';
import MfaSettings from './MfaSettings.jsx';
import { signupMessage } from './clientApp.js';
import styles from './Business.module.css';

async function copySignupLink(advisorId) {
  const message = signupMessage(advisorId);
  try {
    await navigator.clipboard.writeText(message);
    toast('הקישור הועתק, אפשר להדביק ללקוח', 'success');
  } catch {
    window.prompt('העתק את ההודעה ושלח ללקוח:', message);
  }
}

export default function SiteSettings({ advisorId }) {
  const { profile, saveName, saveLogo, removeLogo, saveBrandColor } = useAdvisorProfile(advisorId);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const fileRef = useRef(null);

  useEffect(() => { setName(profile?.display_name || ''); }, [profile?.display_name]);

  if (!profile) return <Skeleton height="220px" radius="18px" />;

  async function submitName() {
    setBusy('name');
    const ok = await saveName(name);
    setBusy('');
    toast(ok ? 'שם העסק נשמר' : 'שגיאה בשמירת שם העסק', ok ? 'success' : 'error');
  }

  async function pickLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('logo');
    const ok = await saveLogo(file);
    setBusy('');
    toast(ok ? 'הלוגו נשמר' : 'שגיאה בשמירת הלוגו', ok ? 'success' : 'error');
  }

  async function clearLogo() {
    const ok = await removeLogo();
    if (ok) toast('הלוגו הוסר', 'success');
  }

  async function pickColor(hex) {
    const ok = await saveBrandColor(hex);
    toast(ok ? 'צבע המותג נשמר' : 'שגיאה בשמירת צבע המותג', ok ? 'success' : 'error');
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card} style={{ padding: 'var(--space-4)' }}>
        <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 className={styles.sectionHeading}>העתק קישור אתר</h2>
            <p className={styles.cardSub}>הקישור שהלקוחות נרשמים דרכו. אחרי ההרשמה מזמינים אותם מהמערכת.</p>
          </div>
          <button type="button" className={styles.btn} onClick={() => copySignupLink(advisorId)}>העתק קישור</button>
        </div>
      </section>
      <section className={styles.card} style={{ padding: 'var(--space-4)' }}>
        <div className={styles.brandingLayout}>
          <h2 className={styles.sectionHeading}>מיתוג</h2>
          <p className={styles.cardSub}>כך העסק שלך יופיע בדוחות שתשתף עם לקוחות.</p>
          <div className={styles.settingsPreview} style={{ borderInlineStart: '4px solid ' + (profile.brand_color || DEFAULT_BRAND), padding: 14, background: 'var(--surface2)', borderRadius: 'var(--radius-md)' }}>
            {profile.logo_url && <img className={styles.logoPreviewBig} src={profile.logo_url} alt="הלוגו הנוכחי" />}
            <div><strong>{profile.display_name || 'שם העסק שלך'}</strong><small>תצוגה מקדימה של פרטי המותג</small></div>
          </div>
          <div className={styles.settingsGroup + ' ' + styles.settingsFull}>
            <div className={styles.settingsRow}>
              <label className={styles.fieldLabel}>שם העסק
                <input className={styles.input} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitName()} placeholder="שם העסק שיופיע בדוחות" />
              </label>
              <button type="button" className={styles.btn} onClick={submitName} disabled={busy === 'name'}>{busy === 'name' ? 'שומר…' : 'שמור שם'}</button>
            </div>
          </div>
          <div className={styles.settingsGroup}>
            <h3 className={styles.settingsHeading}>לוגו העסק</h3>
            <p className={styles.cardSub}>הלוגו יופיע לצד שם העסק בדוחות.</p>
            <div className={styles.toolbar}>
              <input ref={fileRef} type="file" accept="image/*" className={styles.hiddenFile} onChange={pickLogo} aria-label="העלאת לוגו" />
              <button type="button" className={styles.btnGhost} onClick={() => fileRef.current?.click()} disabled={busy === 'logo'}>{busy === 'logo' ? 'מעלה…' : profile.logo_url ? 'החלף לוגו' : 'העלה לוגו'}</button>
              {profile.logo_url && <button type="button" className={styles.btnGhost} onClick={clearLogo}>הסר לוגו</button>}
            </div>
          </div>
          <div className={styles.settingsGroup}>
            <h3 className={styles.settingsHeading}>צבע המותג</h3>
            <div className={styles.toolbar}>
              <label className={styles.toolbar}>צבע מותג בדוחות<input type="color" className={styles.colorInput} aria-label="צבע מותג בדוחות" value={profile.brand_color || DEFAULT_BRAND} onChange={e => pickColor(e.target.value)} /></label>
              <span className={styles.rowMeta}>השינוי נשמר אוטומטית</span>
              {profile.brand_color && <button type="button" className={styles.btnGhost} onClick={() => pickColor(null)}>איפוס</button>}
            </div>
          </div>
        </div>
      </section>
      <MfaSettings />
    </div>
  );
}
