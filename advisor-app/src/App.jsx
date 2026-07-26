import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import NotAdvisor from './auth/NotAdvisor.jsx';
import { useIsAdvisor } from './auth/useIsAdvisor.js';
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

const Dashboard = lazy(() => import('./budget/Dashboard.jsx'));
const Analysis = lazy(() => import('./budget/Analysis.jsx'));
const Assets = lazy(() => import('./budget/Assets.jsx'));
import { addMonths } from './budget/monthUtils.js';

const svgProps = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const NAV = [
  { key: 'dashboard', label: 'דשבורד', icon: <svg {...svgProps}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="12" width="8" height="9" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></svg> },
  { key: 'expenses', label: 'הוצאות', icon: <svg {...svgProps}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg> },
  { key: 'budget', label: 'תקציב', icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 3.5" /></svg> },
  { key: 'analysis', label: 'ניתוח', icon: <svg {...svgProps}><path d="M4 20V10M12 20V4M20 20v-7" /></svg> },
  { key: 'goals', label: 'יעדים', icon: <svg {...svgProps}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg> },
  { key: 'subs', label: 'מנויים והלוואות', icon: <svg {...svgProps}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg> },
  { key: 'assets', label: 'נכסים והתחייבויות', icon: <svg {...svgProps}><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M10 21v-6h4v6" /></svg> },
  { key: 'crm', label: 'לקוח', icon: <svg {...svgProps}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" /></svg> }
];

const today = new Date();

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client');
  const nav = params.get('nav');
  const y = parseInt(params.get('y'), 10);
  const m = parseInt(params.get('m'), 10);
  return {
    selectedClient: clientId ? { id: clientId, email: null } : null,
    nav: NAV.some(n => n.key === nav) ? nav : NAV[0].key,
    ym: Number.isInteger(y) && Number.isInteger(m) ? { year: y, month: m } : { year: today.getFullYear(), month: today.getMonth() }
  };
}

export default function App() {
  const { session, loading, isRecovery, clearRecovery } = useSession();
  const initial = readUrlState();
  const [selectedClient, setSelectedClient] = useState(initial.selectedClient);
  const [nav, setNav] = useState(initial.nav);
  const [ym, setYm] = useState(initial.ym);
  const [reportMode, setReportMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isAdvisor = useIsAdvisor(session?.user?.id);
  const { nextMeeting, openTasks, refresh: refreshClientSummary } = useClientSummary(session?.user?.id, selectedClient?.id);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedClient) {
      params.set('client', selectedClient.id);
      params.set('nav', nav);
      params.set('y', ym.year);
      params.set('m', ym.month);
    }
    const query = params.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [selectedClient, nav, ym]);

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
  if (!isAdvisor) return (<><NotAdvisor email={session.user.email} /><Toaster /></>);

  const switchClient = (clientId, clientEmail) => {
    setSelectedClient({ id: clientId, email: clientEmail });
    setNav(NAV[0].key);
    setYm({ year: today.getFullYear(), month: today.getMonth() });
  };

  if (!selectedClient) {
    return (
      <>
        <Shell title="לוח בקרה" email={session.user.email} onSearch={() => setSearchOpen(true)}>
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
      <Shell
        title={NAV.find(n => n.key === nav)?.label}
        onBack={() => setSelectedClient(null)}
        nav={NAV}
        activeNav={nav}
        onNavChange={setNav}
        onPrint={() => setReportMode(true)}
        onSearch={() => setSearchOpen(true)}
        email={session.user.email}
        sidebarInfo={<MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} />}
      >
        <ClientContextBar
          email={selectedClient.email}
          nextMeeting={nextMeeting}
          openTasks={openTasks}
          onOpenCrm={() => setNav('crm')}
        />
        {nav === 'dashboard' && <Suspense fallback={<Skeleton height="140px" radius="18px" />}><Dashboard clientUserId={selectedClient.id} year={ym.year} month={ym.month} /></Suspense>}
        {nav === 'expenses' && <Expenses clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'budget' && <Budget clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'analysis' && <Suspense fallback={<Skeleton height="260px" radius="16px" />}><Analysis clientUserId={selectedClient.id} year={ym.year} month={ym.month} /></Suspense>}
        {nav === 'goals' && <Goals clientUserId={selectedClient.id} advisorId={session.user.id} />}
        {nav === 'subs' && <Subscriptions clientUserId={selectedClient.id} advisorId={session.user.id} />}
        {nav === 'assets' && <Suspense fallback={<Skeleton height="220px" radius="18px" />}><Assets clientUserId={selectedClient.id} advisorId={session.user.id} /></Suspense>}
        {nav === 'crm' && <Crm advisorId={session.user.id} clientId={selectedClient.id} onChange={refreshClientSummary} />}
      </Shell>
      <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster />
    </>
  );
}
