import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';

export default function App() {
  const { session, loading } = useSession();

  if (loading) return null;
  if (!session) return <Login />;

  return <Shell title="לוח בקרה">מחובר כ־{session.user.email}</Shell>;
}
