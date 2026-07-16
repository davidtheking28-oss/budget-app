import { useEffect, useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';
import Toaster from './components/Toaster.jsx';
import QuickSwitcher from './components/QuickSwitcher.jsx';
import MonthNav from './components/MonthNav.jsx';
import ClientList from './clients/ClientList.jsx';
import Dashboard from './budget/Dashboard.jsx';
import Expenses from './budget/Expenses.jsx';
import Budget from './budget/Budget.jsx';
import Analysis from './budget/Analysis.jsx';
import Goals from './budget/Goals.jsx';
import Subscriptions from './budget/Subscriptions.jsx';
import Crm from './crm/Crm.jsx';
import Report from './budget/Report.jsx';
import { addMonths } from './budget/monthUtils.js';

const NAV = [
  { key: 'dashboard', label: 'דשבורד' },
  { key: 'expenses', label: 'הוצאות' },
  { key: 'budget', label: 'תקציב' },
  { key: 'analysis', label: 'ניתוח' },
  { key: 'goals', label: 'יעדים' },
  { key: 'subs', label: 'מנויים והלוואות' },
  { key: 'crm', label: 'לקוח' }
];

const today = new Date();

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client');
  const clientEmail = params.get('email');
  const nav = params.get('nav');
  const y = parseInt(params.get('y'), 10);
  const m = parseInt(params.get('m'), 10);
  return {
    selectedClient: clientId && clientEmail ? { id: clientId, email: clientEmail } : null,
    nav: NAV.some(n => n.key === nav) ? nav : NAV[0].key,
    ym: Number.isInteger(y) && Number.isInteger(m) ? { year: y, month: m } : { year: today.getFullYear(), month: today.getMonth() }
  };
}

export default function App() {
  const { session, loading } = useSession();
  const initial = readUrlState();
  const [selectedClient, setSelectedClient] = useState(initial.selectedClient);
  const [nav, setNav] = useState(initial.nav);
  const [ym, setYm] = useState(initial.ym);
  const [reportMode, setReportMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedClient) {
      params.set('client', selectedClient.id);
      params.set('email', selectedClient.email);
      params.set('nav', nav);
      params.set('y', ym.year);
      params.set('m', ym.month);
    }
    const query = params.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [selectedClient, nav, ym]);

  if (loading) return null;
  if (!session) return (<><Login /><Toaster /></>);

  const switchClient = (clientId, clientEmail) => {
    setSelectedClient({ id: clientId, email: clientEmail });
    setNav(NAV[0].key);
    setYm({ year: today.getFullYear(), month: today.getMonth() });
  };

  if (!selectedClient) {
    return (
      <>
        <Shell title="לוח בקרה">
          <ClientList advisorId={session.user.id} onSelect={switchClient} />
        </Shell>
        <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} />
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
        <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} />
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
        sidebarInfo={<MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} email={selectedClient.email} nextMeeting={null} />}
      >
        {nav === 'dashboard' && <Dashboard clientUserId={selectedClient.id} year={ym.year} month={ym.month} />}
        {nav === 'expenses' && <Expenses clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'budget' && <Budget clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'analysis' && <Analysis clientUserId={selectedClient.id} year={ym.year} month={ym.month} />}
        {nav === 'goals' && <Goals clientUserId={selectedClient.id} />}
        {nav === 'subs' && <Subscriptions clientUserId={selectedClient.id} />}
        {nav === 'crm' && <Crm advisorId={session.user.id} clientId={selectedClient.id} />}
      </Shell>
      <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} />
      <Toaster />
    </>
  );
}
