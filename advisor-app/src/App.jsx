import { useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';
import ClientList from './clients/ClientList.jsx';

export default function App() {
  const { session, loading } = useSession();
  const [selectedClient, setSelectedClient] = useState(null);

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

  return <Shell title={selectedClient.email}>בקרוב: ניהול תקציב</Shell>;
}
