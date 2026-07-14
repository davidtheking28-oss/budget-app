import { useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';
import ClientList from './clients/ClientList.jsx';
import Dashboard from './budget/Dashboard.jsx';
import Expenses from './budget/Expenses.jsx';
import Budget from './budget/Budget.jsx';
import Analysis from './budget/Analysis.jsx';

const TABS = ['דשבורד', 'הוצאות', 'תקציב', 'ניתוח'];

export default function App() {
  const { session, loading } = useSession();
  const [selectedClient, setSelectedClient] = useState(null);
  const [tab, setTab] = useState(TABS[0]);

  if (loading) return null;
  if (!session) return <Login />;

  if (!selectedClient) {
    return (
      <Shell title="לקוחות">
        <ClientList
          advisorId={session.user.id}
          onSelect={(clientId, clientEmail) => setSelectedClient({ id: clientId, email: clientEmail })}
        />
      </Shell>
    );
  }

  return (
    <Shell
      title={selectedClient.email}
      right={<button onClick={() => setSelectedClient(null)}>← חזרה ללקוחות</button>}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'דשבורד' && <Dashboard clientUserId={selectedClient.id} />}
      {tab === 'הוצאות' && <Expenses clientUserId={selectedClient.id} />}
      {tab === 'תקציב' && <Budget clientUserId={selectedClient.id} />}
      {tab === 'ניתוח' && <Analysis clientUserId={selectedClient.id} />}
    </Shell>
  );
}
