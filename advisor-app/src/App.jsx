import { useEffect, useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import NotAdvisor from './auth/NotAdvisor.jsx';
import { useIsAdvisor } from './auth/useIsAdvisor.js';
import { useAdvisorRequest } from './auth/useAdvisorRequest.js';
import Shell from './components/Shell.jsx';
import Toaster from './components/Toaster.jsx';
import QuickSwitcher from './components/QuickSwitcher.jsx';
import Skeleton from './components/Skeleton.jsx';
import ClientList from './clients/ClientList.jsx';
import Report from './budget/Report.jsx';
import Presentation from './budget/Presentation.jsx';
import { BudgetModeContext } from './budget/useClientBudget.js';
import { useTheme } from './useTheme.js';
import { useUrlParam } from './useUrlParam.js';
import Prospects from './clients/Prospects.jsx';
import BusinessView from './business/BusinessView.jsx';
import { BUSINESS_NAV, BUSINESS_KEYS, DEPARTMENTS, deptOf, pageTitle } from './business/BusinessNav.jsx';

// Older links opened a standalone client screen (?client=<id>&nav=<tab>); that
// screen now lives inside the department's "תצוגת לקוח".
const legacyParams = new URLSearchParams(window.location.search);
const legacyClient = legacyParams.get('client');
const legacyTab = legacyParams.get('nav');

export default function App() {
  const { session, loading, isRecovery, clearRecovery } = useSession();
  const [homeView, setHomeView] = useUrlParam('view', 'clients', legacyClient ? 'client-view' : 'clients', { history: true });
  const [viewClientId, setViewClientId] = useState(legacyClient);
  const [viewTab, setViewTab] = useState(legacyTab);
  const [inviteDraft, setInviteDraft] = useState(null);
  const [fullscreen, setFullscreen] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const isAdvisor = useIsAdvisor(session?.user?.id);
  const { status: advisorRequestStatus, submit: submitAdvisorRequest } = useAdvisorRequest(!isAdvisor ? session?.user?.id : null);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    if (!legacyClient) return;
    const params = new URLSearchParams(window.location.search);
    for (const key of ['client', 'nav', 'y', 'm', 'mode']) params.delete(key);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, []);

  if (loading) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (isRecovery) return (<><Login recovery onRecoveryDone={clearRecovery} /><Toaster /></>);
  if (!session) return (<><Login /><Toaster /></>);
  if (isAdvisor === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (!isAdvisor) {
    if (advisorRequestStatus === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
    return (<><NotAdvisor email={session.user.email} userId={session.user.id} requestStatus={advisorRequestStatus} onSubmitRequest={submitAdvisorRequest} /><Toaster /></>);
  }

  const openInView = (clientId, clientEmail, destination) => {
    setViewClientId(clientId);
    setViewTab(destination?.nav || null);
    setHomeView('client-view');
  };

  const openFullscreen = type => ({ clientId, email, year, month, mode, tab }) => {
    setViewClientId(clientId);
    setViewTab(tab);
    setFullscreen({ type, clientId, email, year, month, mode });
  };

  const activeHome = BUSINESS_KEYS.includes(homeView) ? homeView : 'clients';
  const activeDept = deptOf(activeHome);
  const homeItem = BUSINESS_NAV.find(n => n.key === activeHome);

  if (fullscreen) {
    const Screen = fullscreen.type === 'report' ? Report : Presentation;
    return (
      <>
        <BudgetModeContext.Provider value={fullscreen.mode}>
          <Screen clientUserId={fullscreen.clientId} advisorId={session.user.id} year={fullscreen.year} month={fullscreen.month} email={fullscreen.email} onClose={() => setFullscreen(null)} />
        </BudgetModeContext.Provider>
        <Toaster />
      </>
    );
  }

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
          ? <BusinessView view={activeHome} advisorId={session.user.id} onNavigate={setHomeView} onSelectClient={openInView} onReport={openFullscreen('report')} onPresent={openFullscreen('present')} viewClientId={viewClientId} viewTab={viewTab} onViewClient={setViewClientId} />
          : <ClientList key={session.user.id} advisorId={session.user.id} onSelect={clientId => openInView(clientId)} inviteDraft={inviteDraft} onDraftUsed={() => setInviteDraft(null)} onOpenProspects={() => setHomeView('prospects')} />}
      </Shell>
      <QuickSwitcher advisorId={session.user.id} onSelect={openInView} open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster />
    </>
  );
}
