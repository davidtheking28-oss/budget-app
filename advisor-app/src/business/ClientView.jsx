import { lazy, Suspense, useState } from 'react';
import { useClientList } from '../clients/useClientList.js';
import { BudgetModeContext } from '../budget/useClientBudget.js';
import { addMonths } from '../budget/monthUtils.js';
import Budget from '../budget/Budget.jsx';
import Crm from '../crm/Crm.jsx';
import MonthNav from '../components/MonthNav.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Business.module.css';

const Assets = lazy(() => import('../budget/Assets.jsx'));
const EconomicMapping = lazy(() => import('../mapping/EconomicMapping.jsx'));

const TABS = [
  { key: 'mapping', label: 'מיפוי' },
  { key: 'budget', label: 'תקצוב' },
  { key: 'assets', label: 'שווי נקי' },
  { key: 'tasks', label: 'משימות' }
];

const UNSAVED = 'יש שינויים שטרם נשמרו. להמשיך בלי לשמור?';

export default function ClientView({ advisorId, clientId, onClientChange, onOpenFull }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const now = new Date();
  const [tab, setTab] = useState('mapping');
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [mode, setMode] = useState('personal');
  const [dirty, setDirty] = useState(false);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const client = clients.find(c => c.client_id === clientId);
  const clientName = client?.name || client?.client_email;
  const leave = () => !dirty || window.confirm(UNSAVED);

  function changeClient(nextId) {
    if (!leave()) return;
    setDirty(false);
    onClientChange(nextId || null);
  }

  function changeTab(next) {
    if (next === tab || !leave()) return;
    setDirty(false);
    setTab(next);
  }

  function changeMonth(delta) {
    if (!leave()) return;
    setDirty(false);
    setYm(prev => addMonths(prev.year, prev.month, delta));
  }

  function resetMonth() {
    if (!leave()) return;
    setDirty(false);
    setYm({ year: now.getFullYear(), month: now.getMonth() });
  }

  function changeMode(next) {
    if (next === mode || !leave()) return;
    setDirty(false);
    setMode(next);
  }

  function goTo(key) {
    if (TABS.some(t => t.key === key)) changeTab(key);
    else if (client) onOpenFull(client.client_id, client.client_email, { nav: key });
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <label className={styles.toolbar}>
          <span className={styles.statLabel}>לקוח:</span>
          <select className={styles.select} value={clientId || ''} aria-label="בחירת לקוח" onChange={e => changeClient(e.target.value)}>
            <option value="">בחירת לקוח</option>
            {clients.map(c => <option key={c.id} value={c.client_id}>{c.name || c.client_email}</option>)}
          </select>
        </label>
        {client && <span className={styles.cardSub}>מציג את המסכים של <b>{clientName}</b>, בדיוק כמו שהוא רואה אותם</span>}
      </div>
      <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
        <div className={styles.pills} role="group" aria-label="אזור בכרטיס הלקוח">
          {TABS.map(t => (
            <button key={t.key} type="button" className={tab === t.key ? styles.pillOn : styles.pill} aria-pressed={tab === t.key} onClick={() => changeTab(t.key)}>{t.label}</button>
          ))}
        </div>
        {client && <Button variant="ghost" onClick={() => onOpenFull(client.client_id, client.client_email, { nav: 'crm' })}>כרטיס לקוח מלא</Button>}
      </div>
      {!client && (
        <section className={styles.card}>
          <div className={styles.emptyState}><span>בחר לקוח מהרשימה למעלה כדי לראות את האזור האישי שלו.</span></div>
        </section>
      )}
      {client && tab === 'budget' && (
        <div className={styles.toolbar}>
          <MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} />
          <div className={styles.segment} role="group" aria-label="סוג תקציב">
            <button type="button" className={mode === 'personal' ? styles.segBtnOn : styles.segBtn} aria-pressed={mode === 'personal'} onClick={() => changeMode('personal')}>פרטי</button>
            <button type="button" className={mode === 'business' ? styles.segBtnOn : styles.segBtn} aria-pressed={mode === 'business'} onClick={() => changeMode('business')}>עסקי</button>
          </div>
        </div>
      )}
      {client && tab === 'mapping' && <Suspense fallback={<Skeleton height="220px" radius="18px" />}><EconomicMapping key={client.client_id} clientUserId={client.client_id} advisorId={advisorId} onNavigate={goTo} /></Suspense>}
      {client && tab === 'budget' && (
        <BudgetModeContext.Provider value={mode}>
          <Budget key={`${client.client_id}:${mode}:${ym.year}:${ym.month}`} onDirtyChange={setDirty} focusCategory={null} clientUserId={client.client_id} advisorId={advisorId} year={ym.year} month={ym.month} />
        </BudgetModeContext.Provider>
      )}
      {client && tab === 'assets' && <Suspense fallback={<Skeleton height="220px" radius="18px" />}><Assets key={client.client_id} clientUserId={client.client_id} advisorId={advisorId} /></Suspense>}
      {client && tab === 'tasks' && <Crm view="tasks" key={`${client.client_id}:tasks`} onDirtyChange={setDirty} action={null} advisorId={advisorId} clientId={client.client_id} email={client.client_email} />}
    </div>
  );
}
