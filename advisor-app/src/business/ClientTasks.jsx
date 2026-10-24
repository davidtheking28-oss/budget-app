import { useClientList } from '../clients/useClientList.js';
import DailyWorkQueue from '../clients/DailyWorkQueue.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';

export default function ClientTasks({ advisorId, onSelect }) {
  const { clients, tasks, taskError, completeTask, loading, error, reload } = useClientList(advisorId);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading) return <Skeleton height="220px" radius="18px" />;
  return <DailyWorkQueue advisorId={advisorId} tasks={tasks} clients={clients} error={taskError} onRetry={reload} onToggle={completeTask} onSelect={onSelect} />;
}
