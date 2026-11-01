import { useEffect, useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import NotAdvisor from './auth/NotAdvisor.jsx';
import LegalGate from './auth/LegalGate.jsx';
import { useLegalConsent } from './auth/useLegalConsent.js';
import MfaChallenge from './auth/MfaChallenge.jsx';
import { useMfaGate } from './auth/useMfaGate.js';
import { useIsAdvisor } from './auth/useIsAdvisor.js';
import { useAdvisorRequest } from './auth/useAdvisorRequest.js';
import Shell from './components/Shell.jsx';
import Toaster from './components/Toaster.jsx';
import QuickSwitcher from './components/QuickSwitcher.jsx';
import Skeleton from './components/Skeleton.jsx';
import ClientList from './clients/ClientList.jsx';
import { signupMessage } from './business/clientApp.js';
import { toast } from './toast.js';
import { useTheme } from './useTheme.js';
import { useUrlParam } from './useUrlParam.js';
import Prospects from './clients/Prospects.jsx';
import BusinessView from './business/BusinessView.jsx';
import PersonalView from './business/PersonalView.jsx';
import { PERSONAL_NAV, PERSONAL_KEYS } from './business/PersonalNav.jsx';
import { BUSINESS_NAV, BUSINESS_KEYS, DEPARTMENTS, deptOf, pageTitle } from './business/BusinessNav.jsx';

// Older links opened a standalone client screen (?client=<id>&nav=<tab>); that
// screen now lives inside the department's "תצוגת לקוח".
const legacyParams = new URLSearchParams(window.location.search);
const legacyClient = legacyParams.get('client');
const legacyTab = legacyParams.get('nav');

export default function App() {
  const { session, loading, isRecovery, clearRecovery } = useSession();
  const [homeView, setHomeView] = useUrlParam('view', 'clients', legacyClient ? 'client-view' : 'clients', { history: true });
  const [workspace, setWorkspace] = useUrlParam('ws', 'advisor', 'advisor', { history: true });
  const [personalView, setPersonalView] = useUrlParam('pview', 'personal-expenses', 'personal-expenses', { history: true });
  const [viewClientId, setViewClientId] = useState(legacyClient);
  const [viewTab, setViewTab] = useState(legacyTab);
  const [searchOpen, setSearchOpen] = useState(false);
  const [legalAccepted, markLegalAccepted] = useLegalConsent(session?.user?.id);
  const isAdvisor = useIsAdvisor(session?.user?.id);
  const mfa = useMfaGate(session?.user?.id);
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
  if (legalAccepted === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (!legalAccepted) return (<><LegalGate onAccepted={markLegalAccepted} /><Toaster /></>);
  if (isAdvisor === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (!isAdvisor) {
    if (advisorRequestStatus === null) return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
    return (<><NotAdvisor email={session.user.email} userId={session.user.id} requestStatus={advisorRequestStatus} onSubmitRequest={submitAdvisorRequest} /><Toaster /></>);
  }

  if (mfa.status === 'loading') return <div style={{ maxWidth: 360, margin: '20vh auto' }}><Skeleton height="64px" radius="14px" /></div>;
  if (mfa.status === 'challenge') return (<><MfaChallenge factorId={mfa.factorId} onVerified={mfa.refresh} /><Toaster /></>);

  const openInView = (clientId, clientEmail, destination) => {
    setViewClientId(clientId);
    setViewTab(destination?.nav || null);
    setHomeView('client-view');
  };

  const activeHome = BUSINESS_KEYS.includes(homeView) ? homeView : 'clients';
  const activeDept = deptOf(activeHome);
  const homeItem = BUSINESS_NAV.find(n => n.key === activeHome);
  const personal = workspace === 'personal';
  const activePersonal = PERSONAL_KEYS.includes(personalView) ? personalView : 'personal-expenses';
  const personalItem = PERSONAL_NAV.find(n => n.key === activePersonal);

  return (
    <>
      <Shell
        email={session.user.email}
        advisorId={session.user.id}
        workspaceKey={personal ? `${session.user.id}:personal:${activePersonal}` : `${session.user.id}:home:${homeView}`}
        onSearch={personal ? undefined : () => setSearchOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        inert={searchOpen}
        onHomeClients={personal ? () => setWorkspace('advisor') : () => setHomeView('clients')}
        workspace={workspace}
        onWorkspaceChange={next => { setWorkspace(next); if (next === 'advisor') setPersonalView('personal-expenses'); }}
        homeNav={personal ? PERSONAL_NAV : BUSINESS_NAV.filter(n => n.dept === activeDept.key)}
        homeActive={personal ? activePersonal : activeHome}
        onHomeNavChange={personal ? setPersonalView : setHomeView}
        homeTabs={personal ? [] : DEPARTMENTS.map(d => ({ key: d.key, label: d.label, icon: d.icon, active: d.key === activeDept.key, onClick: () => setHomeView(d.items[0].key) }))}
        title={personal ? personalItem?.label || '' : activeHome === 'client-view' ? '' : pageTitle(homeItem)}
        description={personal ? personalItem?.description : activeHome === 'tasks' ? new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : homeItem?.description}
        homeLinks={personal ? PERSONAL_NAV.map(n => ({ key: n.key, label: n.label, active: activePersonal === n.key, onClick: () => setPersonalView(n.key), icon: n.icon })) : BUSINESS_NAV.filter(n => n.key !== 'clients').map(n => ({ key: n.key, label: n.label, active: activeHome === n.key, onClick: () => setHomeView(n.key), icon: n.icon }))}
      >
        {personal
          ? <PersonalView view={activePersonal} userId={session.user.id} email={session.user.email} />
          : activeHome === 'prospects'
          ? <Prospects advisorId={session.user.id} onConvert={async () => { try { await navigator.clipboard.writeText(signupMessage(session.user.id)); toast('קישור ההרשמה הועתק, שלח אותו ללקוח', 'success'); } catch { toast('אפשר להעתיק את הקישור ממסך אישור לקוחות', 'info'); } setHomeView('client-approvals'); }} />
          : activeHome !== 'clients'
          ? <BusinessView view={activeHome} advisorId={session.user.id} onNavigate={setHomeView} onSelectClient={openInView} viewClientId={viewClientId} viewTab={viewTab} onViewClient={setViewClientId} />
          : <ClientList key={session.user.id} advisorId={session.user.id} onSelect={clientId => openInView(clientId)} />}
      </Shell>
      <QuickSwitcher advisorId={session.user.id} onSelect={openInView} open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster />
    </>
  );
}
