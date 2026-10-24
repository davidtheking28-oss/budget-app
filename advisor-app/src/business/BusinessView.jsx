import BizTasks from './BizTasks.jsx';
import Projects from './Projects.jsx';
import Systems from './Systems.jsx';
import MarketingPlan from './MarketingPlan.jsx';
import VideoIdeas from './VideoIdeas.jsx';
import MetricsView from './MetricsView.jsx';
import Finance from './Finance.jsx';

export default function BusinessView({ view, advisorId }) {
  if (view === 'tasks') return <BizTasks advisorId={advisorId} />;
  if (view === 'projects') return <Projects advisorId={advisorId} />;
  if (view === 'systems') return <Systems advisorId={advisorId} />;
  if (view === 'marketing') return <MarketingPlan advisorId={advisorId} />;
  if (view === 'ideas') return <VideoIdeas advisorId={advisorId} />;
  if (view === 'marketing-metrics') return <MetricsView advisorId={advisorId} kind="marketing" />;
  if (view === 'sales-metrics') return <MetricsView advisorId={advisorId} kind="sales" />;
  if (view === 'finance') return <Finance advisorId={advisorId} />;
  return null;
}
