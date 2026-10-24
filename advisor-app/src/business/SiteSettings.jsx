import { useEffect, useRef, useState } from 'react';
import { useAdvisorProfile } from '../auth/useAdvisorProfile.js';
import { DEFAULT_BRAND } from '../brandColor.js';
import { toast } from '../toast.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Business.module.css';

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
      <p className={styles.note} style={{ margin: 0 }}>כל מה שמעצב את הדוחות שהלקוחות מקבלים ממך.</p>
      <section className={styles.card} style={{ padding: 'var(--space-4)' }}>
        <div className={styles.formStack}>
          <h2 className={styles.sectionHeading}>מיתוג</h2>
          <label className={styles.fieldLabel}>שם העסק
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitName()} placeholder="שם העסק שיופיע בדוחות" />
          </label>
          <div><button type="button" className={styles.btn} onClick={submitName} disabled={busy === 'name'}>שמור שם</button></div>

          <div className={styles.toolbar}>
            {profile.logo_url && <img className={styles.logoPreviewBig} src={profile.logo_url} alt="הלוגו הנוכחי" />}
            <input ref={fileRef} type="file" accept="image/*" className={styles.hiddenFile} onChange={pickLogo} aria-label="העלאת לוגו" />
            <button type="button" className={styles.btnGhost} onClick={() => fileRef.current?.click()} disabled={busy === 'logo'}>{busy === 'logo' ? 'מעלה…' : profile.logo_url ? 'החלף לוגו' : 'העלה לוגו'}</button>
            {profile.logo_url && <button type="button" className={styles.btnGhost} onClick={clearLogo}>הסר לוגו</button>}
          </div>

          <div className={styles.toolbar}>
            <input type="color" className={styles.colorInput} aria-label="צבע מותג בדוחות" value={profile.brand_color || DEFAULT_BRAND} onChange={e => pickColor(e.target.value)} />
            <span className={styles.statLabel}>צבע מותג בדוחות</span>
            {profile.brand_color && <button type="button" className={styles.btnGhost} onClick={() => pickColor(null)}>איפוס</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
