import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import Logo from './Logo.jsx';
import styles from './Shell.module.css';

function AccountMenu({ email }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    if (!password || password.length < 6) { toast('הסיסמה חייבת להיות באורך 6 תווים לפחות', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { toast('שגיאה בעדכון הסיסמה', 'error'); return; }
    toast('הסיסמה עודכנה', 'success');
    setPassword('');
    setOpen(false);
  }

  return (
    <div className={styles.accountMenu}>
      <button type="button" className={styles.accountTrigger} onClick={() => setOpen(o => !o)}>
        <span className={styles.accountEmail}>{email}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={open ? styles.chevronOpen : ''}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className={styles.accountPanel}>
          <div className={styles.accountPanelLabel}>שנה סיסמה</div>
          <input
            className={styles.accountInput}
            type="password"
            autoComplete="new-password"
            placeholder="סיסמה חדשה"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && changePassword()}
          />
          <button type="button" className={styles.accountSaveBtn} onClick={changePassword} disabled={saving}>{saving ? 'שומר…' : 'עדכן סיסמה'}</button>
          <button type="button" className={styles.accountLogoutBtn} onClick={() => supabase.auth.signOut()}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            התנתק
          </button>
        </div>
      )}
    </div>
  );
}

export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, email, children }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeNav]);

  if (!nav) {
    return (
      <div className={styles.shell} dir="rtl">
        <div className={styles.topbar}>
          <div className={styles.logo}><Logo />Budget Advisor</div>
          <AccountMenu email={email} />
        </div>
        <div className={styles.content}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shellSidebar} dir="rtl">
      <aside className={styles.sidebar}>
        <div className={styles.logo}><Logo />Budget Advisor</div>
        {sidebarInfo}
        {onPrint && (
          <button className={styles.reportButton} onClick={onPrint}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9V2h9l3 3v4M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2" />
              <path d="M6 14h12v8H6z" />
            </svg>
            דוח חודשי
          </button>
        )}
        <nav className={styles.nav}>
          {nav.map(n => (
            <button
              key={n.key}
              className={styles.navItem + (n.key === activeNav ? ' ' + styles.navItemActive : '')}
              onClick={() => onNavChange(n.key)}
            >
              {n.icon && <span className={styles.navIcon} aria-hidden="true">{n.icon}</span>}
              {n.label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <button className={styles.backButton} onClick={onBack}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            חזרה ללקוחות
          </button>
          <AccountMenu email={email} />
        </div>
      </aside>
      <div className={styles.mainArea}>
        <div className={styles.contentSidebar} key={activeNav}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
