import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import Logo from './Logo.jsx';
import IconRail from './IconRail.jsx';
import SearchBar from './SearchBar.jsx';
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
          <div className={styles.accountPanelHint}>הסיסמה תתעדכן לחשבון <b className={styles.accountPanelEmail}>{email}</b></div>
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

export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, onSearch, email, theme, onToggleTheme, children }) {
  const activeTabRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeNav]);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [activeNav]);

  if (!nav) {
    return (
      <div className={styles.shell} dir="rtl">
        <IconRail onSearch={onSearch} theme={theme} onToggleTheme={onToggleTheme} />
        <div className={styles.topbarBleed}>
          <div className={styles.topbar}>
            <div className={styles.logo}><Logo />Budget Advisor</div>
            <div className={styles.topbarEnd}>
              {onSearch && <SearchBar onOpen={onSearch} />}
              <AccountMenu email={email} />
            </div>
          </div>
        </div>
        <div className={styles.content}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shellTabs} dir="rtl">
      <IconRail onBack={onBack} onSearch={onSearch} onPrint={onPrint} theme={theme} onToggleTheme={onToggleTheme} />
      <div className={styles.topbarBleed}>
      <div className={styles.topbar}>
        <div className={styles.topbarStart}>
          <div className={styles.logo}><Logo />Budget Advisor</div>
        </div>
        <div className={styles.topbarEnd}>
          {onSearch && <SearchBar onOpen={onSearch} />}
          <AccountMenu email={email} />
        </div>
      </div>
      </div>
      <div className={styles.tabBarBleed}>
        <div className={styles.tabRow}>
          <nav className={styles.tabBar}>
            {nav.map(n => (
              <button
                key={n.key}
                ref={n.key === activeNav ? activeTabRef : null}
                className={styles.tabItem + (n.key === activeNav ? ' ' + styles.tabItemActive : '')}
                onClick={() => onNavChange(n.key)}
              >
                {n.icon && <span className={styles.tabIcon} aria-hidden="true">{n.icon}</span>}
                {n.label}
              </button>
            ))}
          </nav>
          {sidebarInfo && <div className={styles.infoRow}>{sidebarInfo}</div>}
        </div>
      </div>
      <div className={styles.contentTabs}>
        {title && <h1>{title}</h1>}
        {children}
      </div>
    </div>
  );
}
