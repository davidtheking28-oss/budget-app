import { useEffect, useState } from 'react';
import { useAdvisorProfile } from '../auth/useAdvisorProfile.js';
import { toast } from '../toast.js';
import styles from './Business.module.css';

export default function PersonalSettings({ userId, email }) {
  const { profile, saveName } = useAdvisorProfile(userId);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(profile?.display_name || ''); }, [profile?.display_name]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const ok = await saveName(name);
    setSaving(false);
    toast(ok ? 'השם נשמר' : 'השמירה נכשלה', ok ? 'success' : 'error');
  }

  return (
    <div className={styles.stack}>
      <form className={styles.card} onSubmit={submit} aria-label="הפרטים שלי">
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>הפרטים שלי</h2></div>
        <p className={styles.note} style={{ margin: 0 }}>השם מופיע בראש המסך ובמה שהלקוחות שלך רואים.</p>
        <div className={styles.stack} style={{ marginTop: 'var(--space-3)' }}>
          <label className={styles.fieldLabel}>שם מלא
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} disabled={!profile} />
          </label>
          <label className={styles.fieldLabel}>כתובת המייל
            <input className={styles.input} dir="ltr" value={email || ''} readOnly />
            <span className={styles.note} style={{ margin: 0 }}>זו כתובת החשבון שאיתה נכנסים, ולכן אי אפשר להחליף אותה מכאן.</span>
          </label>
          <div className={styles.toolbar}>
            <button type="submit" className={styles.btn} disabled={saving || !profile}>{saving ? 'שומר...' : 'שמירת השינויים'}</button>
          </div>
        </div>
      </form>
      <section className={styles.card}>
        <div className={styles.cardHead}><h2 className={styles.cardTitle}>אפליקציית התקציב</h2></div>
        <p className={styles.note} style={{ margin: 0 }}>יעדים, התראות וחיבור יועץ או בן זוג נשארים באפליקציית התקציב.</p>
        <div className={styles.toolbar} style={{ marginTop: 'var(--space-3)' }}>
          <a className={styles.btnGhost} style={{ textDecoration: 'none' }} href={import.meta.env.BASE_URL + '../'}>פתח באפליקציית התקציב</a>
        </div>
      </section>
    </div>
  );
}
