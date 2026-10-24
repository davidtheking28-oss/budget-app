import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import BudgetWizard from './BudgetWizard.jsx';

export default function Budget({ clientUserId, advisorId, year, month, focusCategory, onDirtyChange }) {
  const { data, loading, error, reload, save } = useClientBudget(clientUserId, advisorId);

  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="72px" radius="14px" />
      </div>
    );
  }

  return (
    <div>
      <BudgetWizard onDirtyChange={onDirtyChange} focusCategory={focusCategory} data={data} save={save} year={year} month={month} />
    </div>
  );
}
