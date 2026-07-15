import { useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';
import Toaster from './components/Toaster.jsx';
import MonthNav from './components/MonthNav.jsx';
import ClientList from './clients/ClientList.jsx';
import Dashboard from './budget/Dashboard.jsx';
import Expenses from './budget/Expenses.jsx';
import Budget from './budget/Budget.jsx';
import Analysis from './budget/Analysis.jsx';
import Goals from './budget/Goals.jsx';
import Subscriptions from './budget/Subscriptions.jsx';
import { addMonths } from './budget/monthUtils.js';

const NAV = [
  { key: 'dashboard', label: 'דשבורד' },
  { key: 'expenses', label: 'הוצאות' },
  { key: 'budget', label: 'תקציב' },
  { key: 'analysis', label: 'ניתוח' },
  { key: 'goals', label: 'יעדים' },
  { key: 'subs', label: 'מנויים והלוואות' }
];

const today = new Date();

export default function App() {
  const { session, loading } = useSession();
  const [selectedClient, setSelectedClient] = useState(null);
  const [nav, setNav] = useState(NAV[0].key);
  const [ym, setYm] = useState({ year: today.getFullYear(), month: today.getMonth() });

  if (loading) return null;
  if (!session) return (<><Login /><Toaster /></>);

  if (!selectedClient) {
    return (
      <>
        <Shell title="לקוחות">
          <ClientList
            advisorId={session.user.id}
            onSelect={(clientId, clientEmail) => {
              setSelectedClient({ id: clientId, email: clientEmail });
              setNav(NAV[0].key);
              setYm({ year: today.getFullYear(), month: today.getMonth() });
            }}
          />
        </Shell>
        <Toaster />
      </>
    );
  }

  const changeMonth = delta => setYm(prev => addMonths(prev.year, prev.month, delta));
  const resetMonth = () => setYm({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <>
      <Shell
        title={NAV.find(n => n.key === nav)?.label}
        onBack={() => setSelectedClient(null)}
        nav={NAV}
        activeNav={nav}
        onNavChange={setNav}
        sidebarInfo={<MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} email={selectedClient.email} />}
      >
        {nav === 'dashboard' && <Dashboard clientUserId={selectedClient.id} year={ym.year} month={ym.month} />}
        {nav === 'expenses' && <Expenses clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'budget' && <Budget clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'analysis' && <Analysis clientUserId={selectedClient.id} year={ym.year} month={ym.month} />}
        {nav === 'goals' && <Goals clientUserId={selectedClient.id} />}
        {nav === 'subs' && <Subscriptions clientUserId={selectedClient.id} />}
      </Shell>
      <Toaster />
    </>
  );
}
