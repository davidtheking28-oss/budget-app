import { lazy, Suspense, useState } from 'react';
import { useClientList } from '../clients/useClientList.js';
import { BudgetModeContext } from '../budget/useClientBudget.js';
import { addMonths } from '../budget/monthUtils.js';
import Budget from '../budget/Budget.jsx';
import Goals from '../budget/Goals.jsx';
import Credit from '../budget/Credit.jsx';
import Subscriptions from '../budget/Subscriptions.jsx';
import Crm from '../crm/Crm.jsx';
import ClientCardTab from './ClientCardTab.jsx';
import MonthNav from '../components/MonthNav.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Business.module.css';

const Assets = lazy(() => import('../budget/Assets.jsx'));
const Analysis = lazy(() => import('../budget/Analysis.jsx'));
const Mortgage = lazy(() => import('../budget/Mortgage.jsx'));
const EconomicMapping = lazy(() => import('../mapping/EconomicMapping.jsx'));

const TABS = [
  { key: 'mapping', label: 'מיפוי' },
  { key: 'budget', label: 'תקציב' },
  { key: 'assets', label: 'שווי נקי' },
  { key: 'tasks', label: 'משימות' },
  { key: 'crm', label: 'לקוח' },
  { key: 'analysis', label: 'ניתוח' },
  { key: 'goals', label: 'יעדים' }
];

const CHIPS = [
  { key: 'main', label: 'תצוגה ראשית' },
  { key: 'cards', label: 'כרטיסי אשראי', view: 'credit', focus: 'all' },
  { key: 'loans', label: 'חובות והלוואות', view: 'credit', focus: 'loans' },
  { key: 'mortgage', label: 'משכנתא', view: 'mortgage' },
  { key: 'installments', label: 'תשלומים', view: 'credit', focus: 'payments' },
  { key: 'subs', label: 'ביטוחים · שנתיות · מנויים · חינוך', view: 'subs' }
];

const CHIP_FOR_VIEW = { credit: 'loans', mortgage: 'mortgage', subs: 'subs' };

const UNSAVED = 'יש שינויים שטרם נשמרו. להמשיך בלי לשמור?';

function Heading({ title, text }) {
  return (
    <div>
      <h2 className={styles.viewHeading}>{title}</h2>
      <p className={styles.cardSub}>{text}</p>
    </div>
  );
}

export default function ClientView({ advisorId, clientId, initialTab, onClientChange, onReport, onPresent }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const now = new Date();
  const [tab, setTab] = useState(TABS.some(t => t.key === initialTab) ? initialTab : 'mapping');
  const [chip, setChip] = useState(CHIP_FOR_VIEW[initialTab] || 'main');
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [mode, setMode] = useState('personal');
  const [dirty, setDirty] = useState(false);
  const [period, setPeriod] = useState('month');

  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const client = clients.find(c => c.client_id === clientId);
  const clientName = client?.name || client?.client_email;
  const leave = () => !dirty || window.confirm(UNSAVED);
  const chipView = CHIPS.find(c => c.key === chip)?.view || null;
  const showChips = tab === 'mapping' || tab === 'budget';
  const view = showChips && chipView ? chipView : tab;
  const clientIdOrNull = client?.client_id;

  function changeClient(nextId) {
    if (!leave()) return;
    setDirty(false);
    onClientChange(nextId || null);
  }

  function changeTab(next) {
    if (next === tab || !leave()) return;
    setDirty(false);
    setChip('main');
    setTab(next);
  }

  function changeChip(next) {
    if (next === chip || !leave()) return;
    setDirty(false);
    setChip(next);
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

  function openFullscreen(handler) {
    if (!client || !leave()) return;
    setDirty(false);
    handler({ clientId: client.client_id, email: client.client_email, year: ym.year, month: ym.month, mode, tab });
  }

  const monthModeBar = (
    <div className={styles.toolbar}>
      <MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} />
      <div className={styles.segment} role="group" aria-label="סוג תקציב">
        <button type="button" className={mode === 'personal' ? styles.segBtnOn : styles.segBtn} aria-pressed={mode === 'personal'} onClick={() => changeMode('personal')}>פרטי</button>
        <button type="button" className={mode === 'business' ? styles.segBtnOn : styles.segBtn} aria-pressed={mode === 'business'} onClick={() => changeMode('business')}>עסקי</button>
      </div>
    </div>
  );

  const chipBar = (
    <div className={styles.pills} role="group" aria-label="תצוגות נוספות">
      {CHIPS.map(c => (
        <button key={c.key} type="button" className={chip === c.key ? styles.pillOn : styles.pill} aria-pressed={chip === c.key} onClick={() => changeChip(c.key)}>{c.label}</button>
      ))}
      {tab === 'mapping' && chip === 'main' && <a className={styles.pill} href="#mapping-upload">העלאת מסמכים</a>}
    </div>
  );

  const suspense = node => <Suspense fallback={<Skeleton height="220px" radius="18px" />}>{node}</Suspense>;

  return (
    <div className={styles.stack}>
      <div className={styles.viewHead}>
        <h1 className={styles.viewTitle}>תצוגת לקוח</h1>
        <label className={styles.toolbar}>
          <span className={styles.statLabel}>לקוח:</span>
          <select className={styles.select} style={{ width: 280, maxWidth: '100%' }} value={clientId || ''} aria-label="בחירת לקוח" onChange={e => changeClient(e.target.value)}>
            <option value="">בחירת לקוח</option>
            {clients.map(c => <option key={c.id} value={c.client_id}>{c.name || c.client_email}</option>)}
          </select>
        </label>
        {client && <span className={styles.cardSub}>מציג את המסכים של <b>{clientName}</b>, בדיוק כמו שהוא רואה אותם</span>}
      </div>
      <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
        <div className={styles.pills} role="group" aria-label="אזור בכרטיס הלקוח">
          {TABS.map(t => (
            <button key={t.key} type="button" className={tab === t.key ? styles.bigPillOn : styles.bigPill} aria-pressed={tab === t.key} onClick={() => changeTab(t.key)}>{t.label}</button>
          ))}
        </div>
        {client && (
          <div className={styles.toolbar}>
            <Button variant="ghost" onClick={() => openFullscreen(onReport)}>דוח חודשי</Button>
            <Button variant="ghost" onClick={() => openFullscreen(onPresent)}>תמונת מצב ללקוח</Button>
          </div>
        )}
      </div>
      {!client && (
        <section className={styles.card}>
          <div className={styles.emptyState}><span>בחר לקוח מהרשימה למעלה כדי לראות את האזור האישי שלו.</span></div>
        </section>
      )}
      {client && (
        <BudgetModeContext.Provider value={mode}>
          {showChips && (
            <div className={styles.stack}>
              <Heading
                title={tab === 'budget' ? 'תקציב' : 'מיפוי'}
                text={tab === 'budget' ? 'חודשי: תכנון בתחילת החודש מול ביצוע בסופו.' : 'מיפוי: התמונה המלאה של ההוצאות וההכנסות, עם מחשבונים לכל קטגוריה משתנה.'}
              />
              {chipBar}
            </div>
          )}
          {view === 'mapping' && suspense(<EconomicMapping key={clientIdOrNull} clientUserId={clientIdOrNull} advisorId={advisorId} />)}
          {view === 'budget' && (
            <>
              <div className={styles.toolbar}>
                <div className={styles.pills} role="group" aria-label="תצוגת תקופה">
                  <button type="button" className={period === 'month' ? styles.bigPillOn : styles.bigPill} aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>חודשי</button>
                  <button type="button" className={period === 'year' ? styles.bigPillOn : styles.bigPill} aria-pressed={period === 'year'} onClick={() => setPeriod('year')}>שנתי</button>
                  <button type="button" className={period === 'avg' ? styles.bigPillOn : styles.bigPill} aria-pressed={period === 'avg'} onClick={() => setPeriod('avg')}>חודש ממוצע</button>
                  <button type="button" className={period === 'long' ? styles.bigPillOn : styles.bigPill} aria-pressed={period === 'long'} onClick={() => setPeriod('long')}>תכנון ארוך טווח</button>
                </div>
                {monthModeBar}
              </div>
              <Budget key={`${clientIdOrNull}:${mode}:${ym.year}:${ym.month}`} period={period} onPeriodChange={setPeriod} onDirtyChange={setDirty} focusCategory={null} clientUserId={clientIdOrNull} advisorId={advisorId} year={ym.year} month={ym.month} />
            </>
          )}
          {view === 'assets' && (
            <div className={styles.stack}>
              <Heading title="שווי נקי" text="תמונה עדכנית של הנכסים וההתחייבויות שלך, והמרחק ביניהם." />
              {suspense(<Assets key={clientIdOrNull} clientUserId={clientIdOrNull} advisorId={advisorId} />)}
            </div>
          )}
          {view === 'tasks' && (
            <div className={styles.stack}>
              <Heading title="משימות" text="המשימות של הלקוח: מה הוגדר לו בתהליך ומה הוא הוסיף לעצמו." />
              <Crm view="tasks" key={`${clientIdOrNull}:tasks`} onDirtyChange={setDirty} action={null} advisorId={advisorId} clientId={clientIdOrNull} email={client.client_email} />
            </div>
          )}
          {view === 'crm' && (
            <div className={styles.stack}>
              <Heading title="לקוח" text="פרטי הלקוח, פגישות ומשימות במקום אחד." />
              <ClientCardTab key={clientIdOrNull} advisorId={advisorId} clientId={clientIdOrNull} email={client.client_email} mode={mode} onDirtyChange={setDirty} />
            </div>
          )}
          {view === 'analysis' && (
            <div className={styles.stack}>
              <Heading title="ניתוח" text="השוואת חודשים והבנה לאן הכסף הולך." />
              {monthModeBar}
              {suspense(<Analysis onPreviousMonth={() => changeMonth(-1)} onOpenBudget={() => changeTab('budget')} clientUserId={clientIdOrNull} advisorId={advisorId} year={ym.year} month={ym.month} />)}
            </div>
          )}
          {view === 'goals' && (
            <div className={styles.stack}>
              <Heading title="יעדים" text="יעדי חיסכון והתקדמות אליהם." />
              <Goals clientUserId={clientIdOrNull} advisorId={advisorId} />
            </div>
          )}
          {view === 'credit' && <Credit key={chip} focus={CHIPS.find(c => c.key === chip)?.focus} clientUserId={clientIdOrNull} advisorId={advisorId} />}
          {view === 'subs' && <Subscriptions clientUserId={clientIdOrNull} advisorId={advisorId} />}
          {view === 'mortgage' && (
            <div className={styles.stack}>
              {monthModeBar}
              {suspense(<Mortgage clientUserId={clientIdOrNull} advisorId={advisorId} year={ym.year} month={ym.month} />)}
            </div>
          )}
        </BudgetModeContext.Provider>
      )}
    </div>
  );
}
