import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import NotAdvisor from './auth/NotAdvisor.jsx';
import { useIsAdvisor } from './auth/useIsAdvisor.js';
import { useAdvisorRequest } from './auth/useAdvisorRequest.js';
import Shell from './components/Shell.jsx';
import Toaster from './components/Toaster.jsx';
import QuickSwitcher from './components/QuickSwitcher.jsx';
import MonthNav from './components/MonthNav.jsx';
import ClientContextBar from './components/ClientContextBar.jsx';
import Skeleton from './components/Skeleton.jsx';
import ClientList from './clients/ClientList.jsx';
import Expenses from './budget/Expenses.jsx';
import Budget from './budget/Budget.jsx';
import Goals from './budget/Goals.jsx';
import Subscriptions from './budget/Subscriptions.jsx';
import Crm from './crm/Crm.jsx';
import Report from './budget/Report.jsx';
import { useClientSummary } from './crm/useClientSummary.js';
import { BudgetModeContext, MODES } from './budget/useClientBudget.js';
import { useClientFreshness } from './clients/useClientFreshness.js';
import { useTheme } from './useTheme.js';

const Dashboard = lazy(() => import('./budget/Dashboard.jsx'));
const Analysis = lazy(() => import('./budget/Analysis.jsx'));
const Assets = lazy(() => import('./budget/Assets.jsx'));
const EconomicMapping = lazy(() => import('./mapping/EconomicMapping.jsx'));
import { addMonths } from './budget/monthUtils.js';

const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

// `group` drives the divider Shell renders between clusters — not a data model,
// just enough to tell the advisor "overview, then relationship + fast entry,
// then the financial detail tabs" at a glance in a flat nav bar.
const NAV = [
  { key: 'dashboard', label: 'דשבורד', group: 'overview', icon: <svg {...svgProps}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="12" width="8" height="9" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></svg> },
  { key: 'crm', label: 'לקוח', group: 'tools', icon: <svg {...svgProps}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" /></svg> },
  { key: 'mapping', label: 'מיפוי כלכלי', group: 'tools', icon: <svg {...svgProps}><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 9v11" /></svg> },
  { key: 'expenses', label: 'תזרים', group: 'money', icon: <svg {...svgProps}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg> },
  { key: 'budget', label: 'תקציב', group: 'money', icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 3.5" /></svg> },
  { key: 'analysis', label: 'ניתוח', group: 'money', icon: <svg {...svgProps}><path d="M4 20V10M12 20V4M20 20v-7" /></svg> },
  { key: 'goals', label: 'יעדים', group: 'money', icon: <svg {...svgProps}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg> },
  { key: 'subs', label: 'מנויים והלוואות', group: 'money', icon: <svg {...svgProps}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg> },
  { key: 'assets', label: 'נכסים והתחייבויות', group: 'money', icon: <svg {...svgProps}><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M10 21v-6h4v6" /></svg> }
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
  const [nav, setNav] = useState(initial.nav);
  const [budgetMode, setBudgetMode] = useState(initial.budgetMode);
  const [ym, setYm] = useState(initial.ym);
  const [reportMode, setReportMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isAdvisor = useIsAdvisor(session?.user?.id);
  const { status: advisorRequestStatus, submit: submitAdvisorRequest } = useAdvisorRequest(!isAdvisor ? session?.user?.id : null);
  const freshness = useClientFreshness(selectedClient?.id);
  const { theme, toggle: toggleTheme } = useTheme();
  const { nextMeeting, openTasks, household, refresh: refreshClientSummary } = useClientSummary(session?.user?.id, selectedClient?.id);

  useEffect(() => {
    const params = new URLSearchParams();
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

  if (loading) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (isRecovery) return (<><Login recovery onRecoveryDone={clearRecovery} /><Toaster /></>);
  if (!session) return (<><Login /><Toaster /></>);
  if (isAdvisor === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (!isAdvisor) {
    if (advisorRequestStatus === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
    return (<><NotAdvisor email={session.user.email} userId={session.user.id} requestStatus={advisorRequestStatus} onSubmitRequest={submitAdvisorRequest} /><Toaster /></>);
  }

  const switchClient = (clientId, clientEmail) => {
    setSelectedClient({ id: clientId, email: clientEmail });
    // Deliberately not resetting `nav`: an advisor working through 40+ clients
    // via Ctrl+K on the same tab (e.g. מיפוי כלכלי) should stay on that tab
    // across every switch, not restart at "דשבורד" each time.
    setYm({ year: today.getFullYear(), month: today.getMonth() });
  };

  if (!selectedClient) {
    return (
      <>
        <Shell title="לוח בקרה" email={session.user.email} onSearch={() => setSearchOpen(true)} theme={theme} onToggleTheme={toggleTheme}>
          <ClientList advisorId={session.user.id} onSelect={switchClient} />
        </Shell>
        <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} open={searchOpen} onOpenChange={setSearchOpen} />
        <Toaster />
      </>
    );
  }

  const changeMonth = delta => setYm(prev => addMonths(prev.year, prev.month, delta));
  const resetMonth = () => setYm({ year: today.getFullYear(), month: today.getMonth() });

  if (reportMode) {
    return (
      <>
        <Report clientUserId={selectedClient.id} year={ym.year} month={ym.month} email={selectedClient.email} onClose={() => setReportMode(false)} />
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
        onBack={() => setSelectedClient(null)}
        nav={NAV}
        activeNav={nav}
        onNavChange={setNav}
        onPrint={() => setReportMode(true)}
        onSearch={() => setSearchOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        email={session.user.email}
        sidebarInfo={<MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} />}
      >
        <ClientContextBar
          email={selectedClient.email}
          nextMeeting={nextMeeting}
          openTasks={openTasks}
          household={household}
          onOpenCrm={() => setNav('crm')}
          freshness={freshness}
          budgetMode={budgetMode}
          onBudgetModeChange={setBudgetMode}
        />
        {nav === 'dashboard' && <Suspense fallback={<Skeleton height="140px" radius="18px" />}><Dashboard clientUserId={selectedClient.id} year={ym.year} month={ym.month} /></Suspense>}
        {nav === 'expenses' && <Expenses clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'budget' && <Budget clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'analysis' && <Suspense fallback={<Skeleton height="260px" radius="16px" />}><Analysis clientUserId={selectedClient.id} year={ym.year} month={ym.month} /></Suspense>}
        {nav === 'goals' && <Goals clientUserId={selectedClient.id} advisorId={session.user.id} />}
        {nav === 'subs' && <Subscriptions clientUserId={selectedClient.id} advisorId={session.user.id} />}
        {nav === 'assets' && <Suspense fallback={<Skeleton height="220px" radius="18px" />}><Assets clientUserId={selectedClient.id} advisorId={session.user.id} /></Suspense>}
        {nav === 'crm' && <Crm advisorId={session.user.id} clientId={selectedClient.id} onChange={refreshClientSummary} />}
        {nav === 'mapping' && <Suspense fallback={<Skeleton height="220px" radius="18px" />}><EconomicMapping clientUserId={selectedClient.id} advisorId={session.user.id} /></Suspense>}
      </Shell>
      </BudgetModeContext.Provider>
      <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster />
    </>
  );
}
