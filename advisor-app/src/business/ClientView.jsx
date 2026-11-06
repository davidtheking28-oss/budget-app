import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { requestNavigation } from '../navigationGuard.js';
import { useClientList } from '../clients/useClientList.js';
import { BudgetModeContext } from '../budget/useClientBudget.js';
import { addMonths } from '../budget/monthUtils.js';
import Budget from '../budget/Budget.jsx';
import Credit from '../budget/Credit.jsx';
import ObligationTiles from '../budget/ObligationTiles.jsx';
import Crm from '../crm/Crm.jsx';
import MonthNav from '../components/MonthNav.jsx';
import CategorySelect from '../components/CategorySelect.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import styles from './Business.module.css';
import navigation from './ClientView.module.css';

const Assets = lazy(() => import('../budget/Assets.jsx'));
const Mortgage = lazy(() => import('../budget/Mortgage.jsx'));
const EconomicMapping = lazy(() => import('../mapping/EconomicMapping.jsx'));

const TABS = [
  { key: 'mapping', label: 'מיפוי' },
  { key: 'budget', label: 'תקציב' },
  { key: 'assets', label: 'שווי נקי' },
  { key: 'tasks', label: 'משימות' }
];

export const CHIPS = [
  { key: 'main', label: 'תצוגה ראשית' },
  { key: 'cards', label: 'כרטיסי אשראי', view: 'credit', focus: 'cards' },
  { key: 'loans', label: 'חובות והלוואות', view: 'credit', focus: 'loans' },
  { key: 'mortgage', label: 'משכנתא', view: 'mortgage' },
  { key: 'installments', label: 'תשלומים', view: 'credit', focus: 'payments' },
  { key: 'subs', label: 'ביטוחים · שנתיות · מנויים · חינוך', view: 'subs' }
];

export const CHIP_FOR_VIEW = { credit: 'loans', mortgage: 'mortgage', subs: 'subs' };



export function Heading({ title, text }) {
  return (
    <div>
      <h2 className={styles.viewHeading}>{title}</h2>
      <p className={styles.cardSub}>{text}</p>
    </div>
  );
}

export default function ClientView({ advisorId, clientId, initialTab, onClientChange, onTabChange }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const now = new Date();
  const [tab, setTab] = useState(TABS.some(t => t.key === initialTab) ? initialTab : 'mapping');
  const [chip, setChip] = useState(() => {
    const detail = new URLSearchParams(window.location.search).get('detail');
    return CHIPS.some(item => item.key === detail) ? detail : CHIP_FOR_VIEW[initialTab] || 'main';
  });
  const [ym, setYm] = useState(() => {
    const params = new URLSearchParams(window.location.search), year = Number(params.get('y')), month = Number(params.get('m'));
    return { year: params.has('y') && Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : now.getFullYear(), month: params.has('m') && Number.isInteger(month) && month >= 0 && month < 12 ? month : now.getMonth() };
  });
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'business' ? 'business' : 'personal');
  const [, setDirty] = useState(false);
  const [headerHost, setHeaderHost] = useState(null);
  useEffect(() => { setHeaderHost(document.getElementById('header-period-actions')); }, []);
  const [period, setPeriod] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('period');
    return ['month', 'year', 'avg', 'long'].includes(value) ? value : 'month';
  });
  useEffect(() => { setTab(TABS.some(item => item.key === initialTab) ? initialTab : 'mapping'); }, [initialTab]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('y', String(ym.year));params.set('m', String(ym.month));params.set('mode', mode);
    params.set('period', period);params.set('detail', chip);
    window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
  }, [ym, mode, period, chip]);


  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;

  const client = clients.find(c => c.client_id === clientId);
  const clientName = client?.name || client?.client_email;

  const chipView = CHIPS.find(c => c.key === chip)?.view || null;
  const showChips = tab === 'mapping' || tab === 'budget';
  const view = showChips && chipView ? chipView : tab;
  const clientIdOrNull = client?.client_id;

  async function changeClient(nextId) {
    if (!await requestNavigation()) return;
    setDirty(false);
    onClientChange(nextId || null);
  }

  async function changeTab(next) {
    if (next === tab || !await requestNavigation()) return;
    setDirty(false);
    setChip('main');
    setTab(next);
    onTabChange?.(next);
  }

  async function changeChip(next) {
    if (next === chip || !await requestNavigation()) return;
    setDirty(false);
    setChip(next);
  }

  async function changeMonth(delta) {
    if (!await requestNavigation()) return;
    setDirty(false);
    setYm(prev => addMonths(prev.year, prev.month, delta));
  }

  async function resetMonth() {
    if (!await requestNavigation()) return;
    setDirty(false);
    setYm({ year: now.getFullYear(), month: now.getMonth() });
  }

  async function changeMode(next) {
    if (next === mode || !await requestNavigation()) return;
    setDirty(false);
    setMode(next);
  }

  async function changePeriod(next) {
    if (next === period || !await requestNavigation()) return;
    setPeriod(next);
  }

  function editLinkedExpense(source) {
    if (source === 'mapping') return changeTab('mapping');
    const details = { loans: 'loans', mortgage_scenario: 'mortgage', payments: 'installments' };
    return changeChip(details[source] || 'subs');
  }

  function openInNewWindow() {
    window.open(`${window.location.pathname}?view=client-view&client=${client.client_id}&nav=${tab}&y=${ym.year}&m=${ym.month}&mode=${mode}&period=${period}&detail=${chip}`, '_blank', 'noopener');
  }

  const monthModeBar = (
    <div className={styles.toolbar}>
      {view !== 'budget' && <MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} />}
      <div className={styles.segment} role="group" aria-label="סוג תקציב">
        <button type="button" className={mode === 'personal' ? styles.segBtnOn : styles.segBtn} aria-pressed={mode === 'personal'} onClick={() => changeMode('personal')}>פרטי</button>
        <button type="button" className={mode === 'business' ? styles.segBtnOn : styles.segBtn} aria-pressed={mode === 'business'} onClick={() => changeMode('business')}>עסקי</button>
      </div>
    </div>
  );

  const chipBar = (
    <CategorySelect label="תצוגת נתוני הלקוח" value={chip} options={CHIPS.map(item => ({ key: item.key, label: item.key === 'subs' && tab === 'budget' ? 'ביטוחים · מנויים · חינוך · קוסמטיקה · מתנות' : item.label }))} onChange={changeChip} />
  );

  const suspense = node => <Suspense fallback={<Skeleton height="220px" radius="18px" />}>{node}</Suspense>;

  return (
    <div className={styles.stack}>
      {headerHost && view === 'budget' && (period === 'month' || period === 'avg') && createPortal(<MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} />, headerHost)}
      <div className={styles.viewHead + ' ' + navigation.context}>
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
      <div className={navigation.navigation}>
        <div className={navigation.tabs} role="group" aria-label="אזור בכרטיס הלקוח">
          {TABS.map(t => (
            <button key={t.key} type="button" className={tab === t.key ? navigation.tabActive : navigation.tab} aria-pressed={tab === t.key} onClick={() => changeTab(t.key)}>{t.label}</button>
          ))}
        </div>
        {client && <Button variant="ghost" onClick={openInNewWindow}>פתיחה בחלון חדש</Button>}
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
              {view === 'budget' && (
                <div className={styles.toolbar}>
                  <CategorySelect label="תצוגת תקופה" value={period} options={[{ key: 'month', label: 'חודשי' }, { key: 'year', label: 'שנתי' }, { key: 'avg', label: 'חודש ממוצע' }, { key: 'long', label: 'תכנון ארוך טווח' }]} onChange={changePeriod} />
                  {monthModeBar}
                </div>
              )}
              {chipBar}
            </div>
          )}
          {view === 'mapping' && suspense(<EconomicMapping key={clientIdOrNull} clientUserId={clientIdOrNull} advisorId={advisorId} />)}
          {view === 'budget' && (
            <>
              <Budget onEditLinkedExpense={editLinkedExpense} key={`${clientIdOrNull}:${mode}:${ym.year}:${ym.month}`} period={period} onPeriodChange={changePeriod} onDirtyChange={setDirty} focusCategory={null} clientUserId={clientIdOrNull} advisorId={advisorId} year={ym.year} month={ym.month} />
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
          {view === 'credit' && <Credit key={chip} focus={CHIPS.find(c => c.key === chip)?.focus} clientUserId={clientIdOrNull} advisorId={advisorId} />}
          {view === 'subs' && <ObligationTiles clientUserId={clientIdOrNull} advisorId={advisorId} keys={tab === 'budget' ? ['insurances', 'subs', 'education', 'grooming', 'events', 'annual'] : ['insurances', 'annual', 'subs', 'education']} />}
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
