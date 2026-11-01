import { lazy, Suspense, useState } from 'react';
import { BudgetModeContext } from '../budget/useClientBudget.js';
import { addMonths } from '../budget/monthUtils.js';
import Budget from '../budget/Budget.jsx';
import Credit from '../budget/Credit.jsx';
import ObligationTiles from '../budget/ObligationTiles.jsx';
import MonthNav from '../components/MonthNav.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { CHIPS } from './ClientView.jsx';
import styles from './Business.module.css';

const Mortgage = lazy(() => import('../budget/Mortgage.jsx'));
const EconomicMapping = lazy(() => import('../mapping/EconomicMapping.jsx'));

const PERIODS = [
  { key: 'month', label: 'חודשי' },
  { key: 'year', label: 'שנתי' },
  { key: 'avg', label: 'חודש ממוצע' },
  { key: 'long', label: 'תכנון ארוך טווח' }
];

export default function PersonalBudget({ userId }) {
  const now = new Date();
  const [tab, setTab] = useState('budget');
  const [chip, setChip] = useState('main');
  const [period, setPeriod] = useState('month');
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [dirty, setDirty] = useState(false);

  const leave = () => !dirty || window.confirm('יש שינויים שטרם נשמרו. להמשיך בלי לשמור?');
  const chipDef = CHIPS.find(c => c.key === chip);
  const view = chipDef?.view || tab;
  const suspense = node => <Suspense fallback={<Skeleton height="220px" radius="18px" />}>{node}</Suspense>;

  function changeTab(next) {
    if (next === tab || !leave()) return;
    setDirty(false); setChip('main'); setTab(next);
  }
  function changeChip(next) {
    if (next === chip || !leave()) return;
    setDirty(false); setChip(next);
  }
  function changeMonth(delta) {
    if (!leave()) return;
    setDirty(false); setYm(prev => addMonths(prev.year, prev.month, delta));
  }
  function resetMonth() {
    if (!leave()) return;
    setDirty(false); setYm({ year: now.getFullYear(), month: now.getMonth() });
  }

  const monthBar = <div className={styles.toolbar}><MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} /></div>;

  return (
    <BudgetModeContext.Provider value="personal">
      <div className={styles.stack}>
        <div className={styles.pills} role="group" aria-label="אזור בתזרים">
          <button type="button" className={tab === 'mapping' ? styles.bigPillOn : styles.bigPill} aria-pressed={tab === 'mapping'} onClick={() => changeTab('mapping')}>מיפוי</button>
          <button type="button" className={tab === 'budget' ? styles.bigPillOn : styles.bigPill} aria-pressed={tab === 'budget'} onClick={() => changeTab('budget')}>תזרים</button>
        </div>
        <div className={styles.stack}>
          <div className={styles.pills} role="group" aria-label="תצוגות נוספות">
            {CHIPS.map(c => (
              <button key={c.key} type="button" className={chip === c.key ? styles.pillOn : styles.pill} aria-pressed={chip === c.key} onClick={() => changeChip(c.key)}>{c.label}</button>
            ))}
          </div>
        </div>
        {view === 'mapping' && suspense(<EconomicMapping key={userId} clientUserId={userId} advisorId={userId} />)}
        {view === 'budget' && (
          <>
            <div className={styles.toolbar}>
              <div className={styles.pills} role="group" aria-label="תצוגת תקופה">
                {PERIODS.map(p => (
                  <button key={p.key} type="button" className={period === p.key ? styles.bigPillOn : styles.bigPill} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</button>
                ))}
              </div>
              {monthBar}
            </div>
            <Budget key={`${userId}:${ym.year}:${ym.month}`} period={period} onPeriodChange={setPeriod} onDirtyChange={setDirty} focusCategory={null} clientUserId={userId} advisorId={userId} year={ym.year} month={ym.month} />
          </>
        )}
        {view === 'credit' && <Credit key={chip} focus={chipDef?.focus} clientUserId={userId} advisorId={userId} />}
        {view === 'subs' && <ObligationTiles clientUserId={userId} advisorId={userId} keys={tab === 'budget' ? ['insurances', 'subs', 'education', 'grooming', 'events', 'annual'] : ['insurances', 'annual', 'subs', 'education']} />}
        {view === 'mortgage' && (
          <div className={styles.stack}>
            {monthBar}
            {suspense(<Mortgage clientUserId={userId} advisorId={userId} year={ym.year} month={ym.month} />)}
          </div>
        )}
      </div>
    </BudgetModeContext.Provider>
  );
}
