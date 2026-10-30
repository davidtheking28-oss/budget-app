import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import NotAdvisor from './auth/NotAdvisor.jsx';
import { useIsAdvisor } from './auth/useIsAdvisor.js';
import { useAdvisorRequest } from './auth/useAdvisorRequest.js';
import Shell from './components/Shell.jsx';
import { writeWorkspace } from './workspaceMemory.js';
import Toaster from './components/Toaster.jsx';
import QuickSwitcher from './components/QuickSwitcher.jsx';
import MonthNav from './components/MonthNav.jsx';
import ClientContextBar from './components/ClientContextBar.jsx';
import Skeleton from './components/Skeleton.jsx';
import ClientList from './clients/ClientList.jsx';
import Budget from './budget/Budget.jsx';
import Goals from './budget/Goals.jsx';
import Subscriptions from './budget/Subscriptions.jsx';
import Credit from './budget/Credit.jsx';
import Crm from './crm/Crm.jsx';
import Report from './budget/Report.jsx';
import Presentation from './budget/Presentation.jsx';
import { useClientSummary } from './crm/useClientSummary.js';
import { useClientProfile } from './crm/useClientProfile.js';
import { BudgetModeContext, MODES } from './budget/useClientBudget.js';
import { useTheme } from './useTheme.js';
import { useUrlParam } from './useUrlParam.js';
import Prospects from './clients/Prospects.jsx';
import BusinessView from './business/BusinessView.jsx';
import { BUSINESS_NAV, BUSINESS_KEYS, DEPARTMENTS, deptOf, pageTitle } from './business/BusinessNav.jsx';

const Analysis = lazy(() => import('./budget/Analysis.jsx'));
const Assets = lazy(() => import('./budget/Assets.jsx'));
const Mortgage = lazy(() => import('./budget/Mortgage.jsx'));
const EconomicMapping = lazy(() => import('./mapping/EconomicMapping.jsx'));
import { addMonths } from './budget/monthUtils.js';

const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

// `group` drives the section boundary IconRail renders between clusters, and
// `groupLabel` (set once, on a group's first item) is the text IconRail shows
// there — not a data model, just enough to tell the advisor "overview, then
// the financial detail tabs" at a glance in the sidebar.
const NAV_DESC = {
  crm: 'פרטי הלקוח, פגישות ומשימות במקום אחד.',
  mapping: 'מיפוי הכנסות והוצאות קבועות ומשתנות מדפי החשבון והאשראי.',
  budget: 'תקציב חודשי: מה נכנס, מה יוצא ומה נשאר.',
  analysis: 'השוואת חודשים והבנה לאן הכסף הולך.',
  goals: 'יעדי חיסכון והתקדמות אליהם.',
  subs: 'מנויים, ביטוחים והוצאות שנתיות, כולל תאריכי חידוש.',
  credit: 'הלוואות, כרטיסי אשראי ועסקאות בתשלומים.',
  tasks: 'המשימות של הלקוח: מה הוגדר לו בתהליך ומה הוא הוסיף לעצמו.',
  assets: 'תמונה עדכנית של הנכסים וההתחייבויות, והמרחק ביניהם.',
  mortgage: 'בניית תמהיל משכנתא וחישוב ההחזר החודשי.'
};
const NAV = [
  { key: 'mapping', label: 'מיפוי כלכלי', hint: 'הכנסות והוצאות מדפי חשבון', group: 'overview', groupLabel: 'סקירה', icon: <svg {...svgProps}><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 9v11" /></svg> },
  { key: 'crm', label: 'לקוח', hint: 'פרטים, פגישות ומשימות', group: 'overview', icon: <svg {...svgProps}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" /></svg> },
  { key: 'budget', usesMonth: true, label: 'תקציב', hint: 'תכנון מול ביצוע', group: 'money', groupLabel: 'כספים', icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 3.5" /></svg> },
  { key: 'analysis', usesMonth: true, label: 'ניתוח', hint: 'השוואת חודשים', group: 'money', icon: <svg {...svgProps}><path d="M4 20V10M12 20V4M20 20v-7" /></svg> },
  { key: 'goals', label: 'יעדים', hint: 'חיסכון והתקדמות', group: 'money', icon: <svg {...svgProps}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg> },
  { key: 'subs', label: 'מנויים וביטוחים', hint: 'חידושים והתראות', group: 'money', icon: <svg {...svgProps}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg> },
  { key: 'credit', label: 'הלוואות ואשראי', hint: 'יתרות ותשלומים', group: 'money', icon: <svg {...svgProps}><circle cx="7" cy="7" r="2.3" /><circle cx="17" cy="17" r="2.3" /><path d="M18 6 6 18" /></svg> },
  { key: 'assets', label: 'נכסים והתחייבויות', hint: 'שווי נקי', group: 'money', icon: <svg {...svgProps}><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M10 21v-6h4v6" /></svg> },
  { key: 'tasks', label: 'משימות', hint: 'מהתהליך', group: 'money', icon: <svg {...svgProps}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> },
  { key: 'mortgage', usesMonth: true, label: 'אפיון נדלני', hint: 'תמהיל משכנתא', group: 'money', icon: <svg {...svgProps}><rect x="4" y="2.5" width="16" height="19" rx="2" /><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01" /></svg> }
];

const today = new Date();

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client');
  const nav = params.get('nav');
  const y = parseInt(params.get('y'), 10);
  const m = parseInt(params.get('m'), 10);
  const mode = params.get('mode');
  return {
    selectedClient: clientId ? { id: clientId, email: null } : null,
    nav: NAV.some(n => n.key === nav) ? nav : NAV[0].key,
    budgetMode: MODES.includes(mode) ? mode : 'personal',
    ym: Number.isInteger(y) && Number.isInteger(m) ? { year: y, month: m } : { year: today.getFullYear(), month: today.getMonth() }
  };
}

export default function App() {
  const { session, loading, isRecovery, clearRecovery } = useSession();
  const initial = readUrlState();
  const [selectedClient, setSelectedClient] = useState(initial.selectedClient);
  const [homeView, setHomeView] = useUrlParam('view', 'clients', 'clients', { history: true });
  const [viewClientId, setViewClientId] = useState(null);
  const [viewTab, setViewTab] = useState(null);
  const [inviteDraft, setInviteDraft] = useState(null);
  const [nav, setNav] = useState(initial.nav);
  const [budgetCategory, setBudgetCategory] = useState(null);
  const [budgetDirty, setBudgetDirty] = useState(false);
  const [crmDirty, setCrmDirty] = useState(false);
  const [crmAction, setCrmAction] = useState(null);
  const [budgetMode, setBudgetMode] = useState(initial.budgetMode);
  const [ym, setYm] = useState(initial.ym);
  const [reportMode, setReportMode] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isAdvisor = useIsAdvisor(session?.user?.id);
  const { status: advisorRequestStatus, submit: submitAdvisorRequest } = useAdvisorRequest(!isAdvisor ? session?.user?.id : null);
  const { theme, toggle: toggleTheme } = useTheme();
  const { nextMeeting, openTasks, household, refresh: refreshClientSummary } = useClientSummary(session?.user?.id, selectedClient?.id);
  const { profile: clientProfile, reload: reloadClientProfile, addTag: addClientTag, removeTag: removeClientTag } = useClientProfile(session?.user?.id, selectedClient?.id);
  const [hasMortgage, setHasMortgage] = useState(false);

  useEffect(() => {
    setHasMortgage(false);
    if (!selectedClient) return;
    let cancelled = false;
    supabase
      .from('budget_data')
      .select('mortgage_scenario')
      .eq('user_id', selectedClient.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setHasMortgage(!!data?.mortgage_scenario?.tracks?.length);
      });
    return () => { cancelled = true; };
  }, [selectedClient]);

  const clientTags = [];
  if (hasMortgage) clientTags.push('משכנתא פעילה');
  if (nextMeeting) {
    const daysToMeeting = Math.ceil((new Date(nextMeeting) - today) / 86400000);
    if (daysToMeeting >= 0 && daysToMeeting <= 7) clientTags.push('פגישה השבוע');
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    for (const key of ['client', 'nav', 'y', 'm', 'mode']) params.delete(key);
    if (selectedClient) {
      params.set('client', selectedClient.id);
      params.set('nav', nav);
      params.set('y', ym.year);
      params.set('m', ym.month);
      if (budgetMode !== 'personal') params.set('mode', budgetMode);
    }
    const query = params.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [selectedClient, nav, ym, budgetMode]);

  useEffect(() => {
    if (!session || !selectedClient || selectedClient.email) return;
    let cancelled = false;
    supabase
      .from('advisor_clients')
      .select('client_email')
      .eq('advisor_id', session.user.id)
      .eq('client_id', selectedClient.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.client_email) return;
        setSelectedClient(prev => (prev && prev.id === selectedClient.id ? { ...prev, email: data.client_email } : prev));
      });
    return () => { cancelled = true; };
  }, [session, selectedClient]);

  useEffect(() => {
    if (!session?.user?.id || !selectedClient || !isAdvisor) return;
    writeWorkspace(`advisor_last:${session.user.id}`, { id: selectedClient.id, nav, mode: budgetMode, year: ym.year, month: ym.month });
  }, [session?.user?.id, selectedClient, isAdvisor, nav, budgetMode, ym]);

  if (loading) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (isRecovery) return (<><Login recovery onRecoveryDone={clearRecovery} /><Toaster /></>);
  if (!session) return (<><Login /><Toaster /></>);
  if (isAdvisor === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (!isAdvisor) {
    if (advisorRequestStatus === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
    return (<><NotAdvisor email={session.user.email} userId={session.user.id} requestStatus={advisorRequestStatus} onSubmitRequest={submitAdvisorRequest} /><Toaster /></>);
  }

  function canLeaveBudget() {
    if ((nav === 'crm' || nav === 'tasks') && crmDirty) return window.confirm('יש שינויים בפרטי הלקוח או בפגישה שטרם נשמרו. להמשיך בלי לשמור?');
    return nav !== 'budget' || !budgetDirty || window.confirm('יש שינויים בתקציב שטרם נשמרו. להמשיך בלי לשמור?');
  }

  function changeBudgetMode(mode) {
    if (mode === budgetMode || (nav !== 'crm' && !canLeaveBudget())) return;
    setBudgetDirty(false);
    setBudgetCategory(null);
    setBudgetMode(mode);
  }

  const openInView = (clientId, clientEmail, destination) => {
    setViewClientId(clientId);
    setViewTab(destination?.nav || null);
    setHomeView('client-view');
  };

  const switchClient = (clientId, clientEmail, destination) => {
    if (!canLeaveBudget()) return;
    setBudgetDirty(false);
    if (NAV.some(n => n.key === destination?.nav)) setNav(destination.nav);
    setCrmDirty(false);
    setCrmAction(destination?.action ? { type: destination.action, id: Date.now() } : null);
    if (MODES.includes(destination?.mode)) setBudgetMode(destination.mode);
    setBudgetCategory(null);
    setSelectedClient({ id: clientId, email: clientEmail });
    // Deliberately not resetting `nav`: an advisor working through 40+ clients
    // via Ctrl+K on the same tab (e.g. מיפוי כלכלי) should stay on that tab
    // across every switch, not restart at "דשבורד" each time.
    setYm(Number.isInteger(destination?.year) && destination.year >= 2000 && destination.year <= 2100 && Number.isInteger(destination?.month) && destination.month >= 0 && destination.month < 12 ? { year: destination.year, month: destination.month } : { year: today.getFullYear(), month: today.getMonth() });
  };

  const activeHome = BUSINESS_KEYS.includes(homeView) ? homeView : 'clients';
  const activeDept = deptOf(activeHome);
  const homeItem = BUSINESS_NAV.find(n => n.key === activeHome);

  if (!selectedClient) {
    return (
      <>
        <Shell
          email={session.user.email}
          advisorId={session.user.id}
          workspaceKey={`${session.user.id}:home:${homeView}`}
          onSearch={() => setSearchOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          inert={searchOpen}
          onHomeClients={() => setHomeView('clients')}
          homeNav={BUSINESS_NAV.filter(n => n.dept === activeDept.key)}
          homeActive={activeHome}
          onHomeNavChange={setHomeView}
          homeTabs={DEPARTMENTS.map(d => ({ key: d.key, label: d.label, icon: d.icon, active: d.key === activeDept.key, onClick: () => setHomeView(d.items[0].key) }))}
          title={activeHome === 'client-view' ? '' : pageTitle(homeItem)}
          description={activeHome === 'tasks' ? new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : homeItem?.description}
          homeLinks={BUSINESS_NAV.filter(n => n.key !== 'clients').map(n => ({ key: n.key, label: n.label, active: activeHome === n.key, onClick: () => setHomeView(n.key), icon: n.icon }))}
        >
          {activeHome === 'prospects'
            ? <Prospects advisorId={session.user.id} onConvert={p => { setInviteDraft({ prospectId: p.id, email: p.email || '' }); setHomeView('clients'); }} />
            : activeHome !== 'clients'
            ? <BusinessView view={activeHome} advisorId={session.user.id} onNavigate={setHomeView} onSelectClient={openInView} onOpenFull={switchClient} viewClientId={viewClientId} viewTab={viewTab} onViewClient={setViewClientId} />
            : <ClientList key={session.user.id} advisorId={session.user.id} onSelect={clientId => openInView(clientId)} inviteDraft={inviteDraft} onDraftUsed={() => setInviteDraft(null)} onOpenProspects={() => setHomeView('prospects')} />}
        </Shell>
        <QuickSwitcher advisorId={session.user.id} onSelect={openInView} open={searchOpen} onOpenChange={setSearchOpen} />
        <Toaster />
      </>
    );
  }

  const changeMonth = delta => { if (!canLeaveBudget()) return; setBudgetDirty(false); setBudgetCategory(null); setYm(prev => addMonths(prev.year, prev.month, delta)); };
  const resetMonth = () => { if (!canLeaveBudget()) return; setBudgetDirty(false); setBudgetCategory(null); setYm({ year: today.getFullYear(), month: today.getMonth() }); };

  if (reportMode) {
    return (
      <>
        <BudgetModeContext.Provider value={budgetMode}>
          <Report clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} email={selectedClient.email} onClose={() => setReportMode(false)} />
        </BudgetModeContext.Provider>
        <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} open={searchOpen} onOpenChange={setSearchOpen} />
        <Toaster />
      </>
    );
  }

  if (presentMode) {
    return (
      <>
        <BudgetModeContext.Provider value={budgetMode}>
          <Presentation clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} email={selectedClient.email} onClose={() => setPresentMode(false)} />
        </BudgetModeContext.Provider>
        <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} open={searchOpen} onOpenChange={setSearchOpen} />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <BudgetModeContext.Provider value={budgetMode}>
      <Shell
        title={NAV.find(n => n.key === nav)?.label}
        description={NAV_DESC[nav]}
        onBack={() => { if (canLeaveBudget()) { setBudgetDirty(false); setCrmDirty(false); setSelectedClient(null); } }}
        nav={NAV}
        activeNav={nav}
        workspaceKey={`${session.user.id}:${selectedClient.id}:${nav}:${ym.year}:${ym.month}:${budgetMode}`}
        onNavChange={key => { if (key !== nav && !canLeaveBudget()) return; if (key !== nav) { setBudgetDirty(false); setCrmDirty(false); setCrmAction(null); } setBudgetCategory(null); setNav(key); }}
        onPrint={() => { if (canLeaveBudget()) { setBudgetDirty(false); setCrmDirty(false); setReportMode(true); } }}
        onPresent={() => { if (canLeaveBudget()) { setBudgetDirty(false); setCrmDirty(false); setPresentMode(true); } }}
        onSearch={() => setSearchOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        email={session.user.email}
        advisorId={session.user.id}
        clientName={clientProfile?.name || selectedClient.email}
        budgetMode={budgetMode}
        onBudgetModeChange={changeBudgetMode}
        clientSince={clientProfile?.created_at ? `${String(new Date(clientProfile.created_at).getMonth() + 1).padStart(2, '0')}.${new Date(clientProfile.created_at).getFullYear()}` : null}
        sidebarInfo={NAV.find(n => n.key === nav)?.usesMonth ? <MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} /> : null}
        inert={searchOpen}
      >
        {nav === 'crm' && (
          <ClientContextBar
            isVip={!!clientProfile?.is_vip}
            phone={clientProfile?.phone}
            createdAt={clientProfile?.created_at}
            nextMeeting={nextMeeting}
            openTasks={openTasks}
            household={household}
            tags={clientTags}
            manualTags={clientProfile?.tags || []}
            onAddTag={addClientTag}
            onRemoveTag={removeClientTag}
            onAction={type => setCrmAction({ type, id: Date.now() })}
            budgetMode={budgetMode}
          />
        )}
        {nav === 'budget' && <Budget key={`${session.user.id}:${selectedClient.id}:${budgetMode}:${ym.year}:${ym.month}`} onDirtyChange={setBudgetDirty} focusCategory={budgetCategory} clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'analysis' && <Suspense fallback={<Skeleton height="260px" radius="16px" />}><Analysis onPreviousMonth={() => changeMonth(-1)} onOpenBudget={() => setNav('budget')} clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} /></Suspense>}
        {nav === 'goals' && <Goals clientUserId={selectedClient.id} advisorId={session.user.id} />}
        {nav === 'subs' && <Subscriptions clientUserId={selectedClient.id} advisorId={session.user.id} />}
        {nav === 'credit' && <Credit clientUserId={selectedClient.id} advisorId={session.user.id} />}
        {nav === 'assets' && <Suspense fallback={<Skeleton height="220px" radius="18px" />}><Assets clientUserId={selectedClient.id} advisorId={session.user.id} /></Suspense>}
        {nav === 'mortgage' && <Suspense fallback={<Skeleton height="220px" radius="18px" />}><Mortgage clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} /></Suspense>}
        {nav === 'tasks' && <Crm view="tasks" key={`${session.user.id}:${selectedClient.id}:tasks`} onDirtyChange={setCrmDirty} action={crmAction} advisorId={session.user.id} clientId={selectedClient.id} email={selectedClient.email} onChange={() => { refreshClientSummary(); reloadClientProfile(); }} />}
        {nav === 'crm' && <Crm key={`${session.user.id}:${selectedClient.id}`} onDirtyChange={setCrmDirty} action={crmAction} advisorId={session.user.id} clientId={selectedClient.id} email={selectedClient.email} onChange={() => { refreshClientSummary(); reloadClientProfile(); }} />}
        {nav === 'mapping' && <Suspense fallback={<Skeleton height="220px" radius="18px" />}><EconomicMapping clientUserId={selectedClient.id} advisorId={session.user.id} onNavigate={setNav} /></Suspense>}
      </Shell>
      </BudgetModeContext.Provider>
      <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster />
    </>
  );
}
