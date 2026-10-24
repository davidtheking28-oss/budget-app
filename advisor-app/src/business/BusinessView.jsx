import BizTasks from './BizTasks.jsx';
import Projects from './Projects.jsx';
import Systems from './Systems.jsx';
import MarketingPlan from './MarketingPlan.jsx';
import VideoIdeas from './VideoIdeas.jsx';
import MetricsView from './MetricsView.jsx';
import Finance from './Finance.jsx';
import ClientTasks from './ClientTasks.jsx';
import ClientService from './ClientService.jsx';
import ClientDeals from './ClientDeals.jsx';

export default function BusinessView({ view, advisorId, onNavigate, onSelectClient }) {
  if (view === 'tasks') return <BizTasks advisorId={advisorId} />;
  if (view === 'projects') return <Projects advisorId={advisorId} />;
  if (view === 'systems') return <Systems advisorId={advisorId} />;
  if (view === 'client-deals') return <ClientDeals advisorId={advisorId} />;
  if (view === 'client-service') return <ClientService advisorId={advisorId} onSelect={onSelectClient} />;
  if (view === 'client-tasks') return <ClientTasks advisorId={advisorId} onSelect={onSelectClient} />;
  if (view === 'marketing') return <MarketingPlan advisorId={advisorId} onNavigate={onNavigate} />;
  if (view === 'ideas') return <VideoIdeas advisorId={advisorId} />;
  if (view.startsWith('marketing-')) return <MetricsView advisorId={advisorId} kind="marketing" scope={view.slice(10)} />;
  if (view.startsWith('sales-')) return <MetricsView advisorId={advisorId} kind="sales" scope={view.slice(6)} />;
  if (view.startsWith('fin-')) return <Finance advisorId={advisorId} scope={view.slice(4)} />;
  return null;
}
