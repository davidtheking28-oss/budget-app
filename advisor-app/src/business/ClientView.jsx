import { useState } from 'react';
import { useClientList } from '../clients/useClientList.js';
import { toast } from '../toast.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Business.module.css';

const TABS = [
  { key: 'mapping', label: 'מיפוי' },
  { key: 'budget', label: 'תקציב' },
  { key: 'assets', label: 'שווי נקי' },
  { key: 'crm', label: 'משימות' }
];

export default function ClientView({ advisorId, onSelect }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const [tab, setTab] = useState('mapping');
  const [clientId, setClientId] = useState('');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  function open(nextClientId, nextTab) {
    const c = clients.find(x => x.client_id === nextClientId);
    if (c) onSelect(c.client_id, c.client_email, { nav: nextTab });
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <label className={styles.toolbar}>
          <span className={styles.statLabel}>לקוח:</span>
          <select className={styles.select} value={clientId} aria-label="בחירת לקוח" onChange={e => { setClientId(e.target.value); if (e.target.value) open(e.target.value, tab); }}>
            <option value="">בחירת לקוח</option>
            {clients.map(c => <option key={c.id} value={c.client_id}>{c.name || c.client_email}</option>)}
          </select>
        </label>
        <div className={styles.segment} role="group" aria-label="אזור בכרטיס הלקוח">
          {TABS.map(t => (
            <button key={t.key} type="button" className={tab === t.key ? styles.segBtnOn : styles.segBtn} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); if (clientId) open(clientId, t.key); else toast('בחר לקוח מהרשימה קודם', 'info'); }}>{t.label}</button>
          ))}
        </div>
      </div>
      <section className={styles.card}>
        <div className={styles.emptyState}><span>בחר לקוח מהרשימה למעלה כדי לראות את האזור האישי שלו.</span></div>
      </section>
    </div>
  );
}
