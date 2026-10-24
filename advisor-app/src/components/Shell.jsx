import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';
import { useAdvisorProfile } from '../auth/useAdvisorProfile.js';
import { DEFAULT_BRAND } from '../brandColor.js';
import IconRail from './IconRail.jsx';
import TopNav from './TopNav.jsx';
import SearchBar from './SearchBar.jsx';
import SideNav from './SideNav.jsx';
import styles from './Shell.module.css';
import { useWorkspaceScroll } from '../useWorkspaceScroll.js';

function DensityToggle() {
  const [compact, setCompact] = useState(() => localStorage.getItem('advisor_density') === 'compact');
  useEffect(() => {
    document.documentElement.dataset.density = compact ? 'compact' : 'comfortable';
  }, [compact]);
  function toggle() {
    const next = !compact;
    setCompact(next);
    localStorage.setItem('advisor_density', next ? 'compact' : 'comfortable');
  }
  return <button type="button" className={styles.densityToggle} aria-label="תצוגה קומפקטית" aria-pressed={compact} onClick={toggle}>תצוגה: {compact ? 'קומפקטית' : 'מרווחת'}</button>;
}

function useDesktop() {
  const query = '(min-width: 861px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = e => setDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

function AccountMenu({ email, advisorId, up, block }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { profile, saveName, saveLogo, removeLogo, saveBrandColor } = useAdvisorProfile(advisorId);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => { setName(profile?.display_name || ''); }, [profile?.display_name]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector('input')?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    }
    function onPointerDown(e) {
      if (panelRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

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

  async function submitName() {
    setSavingName(true);
    const ok = await saveName(name);
    setSavingName(false);
    toast(ok ? 'שם העסק נשמר' : 'שגיאה בשמירת שם העסק', ok ? 'success' : 'error');
  }

  async function pickLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingLogo(true);
    const ok = await saveLogo(file);
    setUploadingLogo(false);
    toast(ok ? 'הלוגו נשמר' : 'שגיאה בשמירת הלוגו', ok ? 'success' : 'error');
  }

  async function clearLogo() {
    const ok = await removeLogo();
    if (ok) toast('הלוגו הוסר', 'success');
  }

  async function pickBrandColor(hex) {
    const ok = await saveBrandColor(hex);
    toast(ok ? 'צבע המותג נשמר' : 'שגיאה בשמירת צבע המותג', ok ? 'success' : 'error');
  }

  return (
    <div className={styles.accountMenu + (up ? ' ' + styles.accountUp : '') + (block ? ' ' + styles.accountBlockWrap : '')}>
      {block ? (
        <button ref={triggerRef} type="button" className={styles.accountBlock} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="true" aria-label={`חשבון: ${email}`}>
          <span className={styles.accountAvatar} aria-hidden="true">{(profile?.display_name || email || '?').trim().charAt(0).toUpperCase()}</span>
          <span className={styles.accountText}>
            <span className={styles.accountName}>{profile?.display_name || (email || '').split('@')[0]}</span>
            <span className={styles.accountRole}>יועץ</span>
          </span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      ) : (
      <button ref={triggerRef} type="button" className={styles.accountTrigger} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="true" aria-label={`חשבון: ${email}`}>
        <svg className={styles.accountIcon} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" /></svg>
        <span className={styles.accountEmail}>{email}</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={open ? styles.chevronOpen : ''}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      )}
      {open && (
        <div className={styles.accountPanel} ref={panelRef}>
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
          <div className={styles.accountDivider} />
          <div className={styles.accountPanelLabel}>מיתוג לדוחות</div>
          <div className={styles.accountPanelHint}>שם העסק והלוגו יופיעו בדוח החודשי המודפס ללקוח.</div>
          <input
            className={styles.accountInput}
            placeholder="שם העסק"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitName()}
          />
          <button type="button" className={styles.accountSaveBtn} onClick={submitName} disabled={savingName}>{savingName ? 'שומר…' : 'שמור שם'}</button>
          <div className={styles.logoRow}>
            {profile?.logo_url && <img className={styles.logoPreview} src={profile.logo_url} width="28" height="28" alt="" />}
            <input ref={logoInputRef} type="file" accept="image/*" className={styles.fileInputHidden} onChange={pickLogo} />
            <button type="button" className={styles.accountSaveBtn} onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
              {uploadingLogo ? 'מעלה…' : profile?.logo_url ? 'החלף לוגו' : 'העלה לוגו'}
            </button>
            {profile?.logo_url && <button type="button" className={styles.accountLogoutBtn} onClick={clearLogo}>הסר</button>}
          </div>
          <div className={styles.logoRow}>
            <input type="color" aria-label="צבע מותג" className={styles.colorInput} value={profile?.brand_color || DEFAULT_BRAND} onChange={e => pickBrandColor(e.target.value)} />
            <span className={styles.accountPanelHint}>צבע מותג בדוחות</span>
            {profile?.brand_color && <button type="button" className={styles.accountLogoutBtn} onClick={() => pickBrandColor(null)}>איפוס</button>}
          </div>
          <div className={styles.accountDivider} />
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

export default function Shell({ workspaceKey, homeLinks, onHomeClients, title, clientName, clientSince, budgetMode, onBudgetModeChange, onBack, description, homeNav, homeActive, onHomeNavChange, homeTabs, nav, activeNav, onNavChange, sidebarInfo, onPrint, onPresent, onSearch, email, advisorId, theme, onToggleTheme, inert: shellInert, children }) {
  const desktop = useDesktop();
  useWorkspaceScroll(workspaceKey);

  const topEnd = (
    <>
      {onSearch && <SearchBar onOpen={onSearch} />}
      <AccountMenu email={email} advisorId={advisorId} />
    </>
  );

  const sideEnd = onSearch ? <SearchBar onOpen={onSearch} /> : null;
  const accountFooter = <AccountMenu email={email} advisorId={advisorId} up block />;

  if (desktop && !nav && homeNav) {
    return (
      <div className={styles.shellSide} dir="rtl" inert={shellInert ? '' : undefined}>
        <SideNav nav={homeNav} activeNav={homeActive} onNavChange={onHomeNavChange} footer={accountFooter} />
        <div className={styles.sideMain}>
          <TopNav hideBrand tabs={homeTabs} theme={theme} onToggleTheme={onToggleTheme} end={sideEnd} />
          <main className={styles.contentTop + " " + styles.homeContent}>
            <div className={styles.clientHead + ' ' + styles.homeHead}>
              <div className={styles.titleBlock}>
                <h1 className={styles.clientTitle}>{title}</h1>
                {description ? <p className={styles.clientDesc}>{description}</p> : <div id="biz-header-sub" className={styles.clientDesc} />}
              </div>
              <div className={styles.clientHeadEnd}><div id="biz-header-actions" className={styles.headerActions} /><DensityToggle /></div>
            </div>
            {children}
          </main>
        </div>
      </div>
    );
  }

  if (desktop && !nav) {
    return (
      <div className={styles.shellTop} dir="rtl" inert={shellInert ? '' : undefined}>
        <TopNav homeLinks={homeLinks} onBack={onHomeClients || (() => {})} homeActive={!homeLinks?.some(l => l.active)} theme={theme} onToggleTheme={onToggleTheme} end={topEnd} />
        <main className={styles.contentTop}>
          {children}
        </main>
      </div>
    );
  }

  if (desktop && nav) {
    return (
      <div className={styles.shellSide} dir="rtl" inert={shellInert ? '' : undefined}>
        <SideNav clientName={clientName} clientSince={clientSince} nav={nav} activeNav={activeNav} onNavChange={onNavChange} footer={accountFooter} />
        <div className={styles.sideMain}>
          <TopNav hideBrand onBack={onBack} onPrint={onPrint} onPresent={onPresent} theme={theme} onToggleTheme={onToggleTheme} end={sideEnd} />
          <main className={styles.contentTop}>
            <div className={styles.clientHead}>
              <div className={styles.titleBlock}>
                <h1 className={styles.clientTitle}>{title || clientName || 'טוען פרטי לקוח…'}</h1>
                {description && <p className={styles.clientDesc}>{description}</p>}
              </div>
              <div className={styles.clientHeadEnd}>
                <div className={styles.modeContext} role="group" aria-label="סוג התקציב">
                  <button type="button" aria-pressed={budgetMode !== 'business'} onClick={() => onBudgetModeChange('personal')}>פרטי</button>
                  <button type="button" aria-pressed={budgetMode === 'business'} onClick={() => onBudgetModeChange('business')}>עסקי</button>
                </div>
                {sidebarInfo}
                <DensityToggle />
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>
    );
  }

  if (!nav) {
    return (
      <div className={styles.shell} dir="rtl" inert={shellInert ? '' : undefined}>
        <IconRail homeLinks={homeLinks} onBack={onHomeClients || (() => {})} homeActive={!homeLinks?.some(l => l.active)} onSearch={onSearch} theme={theme} onToggleTheme={onToggleTheme} />
        <div className={styles.topbarBleed}>
          <div className={styles.topbar}>
            <div className={styles.logo}>שקל שקל · יועץ</div>
            <div className={styles.topbarEnd}>
              <DensityToggle />
              {onSearch && <SearchBar onOpen={onSearch} />}
              <AccountMenu email={email} advisorId={advisorId} />
            </div>
          </div>
        </div>
        <main className={styles.content}>
          {homeNav && title && (
            <div className={styles.homeHeadMobile}>
              <h1 className={styles.clientTitle}>{title}</h1>
              {description ? <p className={styles.clientDesc}>{description}</p> : <div id="biz-header-sub" className={styles.clientDesc} />}
            </div>
          )}
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={styles.shellTabs} dir="rtl" inert={shellInert ? '' : undefined}>
      <IconRail
        clientName={clientName}
        clientSince={clientSince}
        onBack={onBack}
        onSearch={onSearch}
        onPrint={onPrint}
        onPresent={onPresent}
        nav={nav}
        activeNav={activeNav}
        onNavChange={onNavChange}
        theme={theme}
        onToggleTheme={onToggleTheme}
        footer={desktop ? <AccountMenu email={email} advisorId={advisorId} up /> : null}
      />
      <div className={styles.topbarBleed}>
        <div className={styles.topbar}>
          <div className={styles.topbarStart}>
            <div className={styles.titleBlock}>
              {title && <h1 className={styles.pageTitle}>{title}</h1>}
              <div className={styles.clientContext}>
                <span className={styles.contextName}>{clientName || 'טוען פרטי לקוח…'}</span>
                <div className={styles.modeContext} role="group" aria-label="סוג התקציב">
                  <button type="button" aria-pressed={budgetMode !== 'business'} onClick={() => onBudgetModeChange('personal')}>פרטי</button>
                  <button type="button" aria-pressed={budgetMode === 'business'} onClick={() => onBudgetModeChange('business')}>עסקי</button>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.topbarEnd}>
              <DensityToggle />
            {sidebarInfo}
            {!desktop && <AccountMenu email={email} advisorId={advisorId} />}
          </div>
        </div>
      </div>
      <main className={styles.contentTabs}>
        {children}
      </main>
    </div>
  );
}
