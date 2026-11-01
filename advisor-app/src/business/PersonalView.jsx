import { lazy, Suspense } from 'react';
import Skeleton from '../components/Skeleton.jsx';
import PersonalExpenses from './PersonalExpenses.jsx';
import PersonalBudget from './PersonalBudget.jsx';
import PersonalSettings from './PersonalSettings.jsx';
import CompoundCalculator from './CompoundCalculator.jsx';
import styles from './Business.module.css';

const Assets = lazy(() => import('../budget/Assets.jsx'));

export default function PersonalView({ view, userId, email }) {
  if (view === 'personal-budget') return <PersonalBudget key={userId} userId={userId} />;
  if (view === 'personal-assets') {
    return (
      <div className={styles.stack}>
        <Suspense fallback={<Skeleton height="220px" radius="18px" />}><Assets key={userId} clientUserId={userId} advisorId={userId} /></Suspense>
      </div>
    );
  }
  if (view === 'personal-calculator') return <CompoundCalculator />;
  if (view === 'personal-settings') return <PersonalSettings userId={userId} email={email} />;
  return <PersonalExpenses key={userId} userId={userId} />;
}
