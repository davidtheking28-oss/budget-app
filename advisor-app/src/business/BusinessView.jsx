import BizTasks from './BizTasks.jsx';
import Projects from './Projects.jsx';
import Systems from './Systems.jsx';
import MarketingPlan from './MarketingPlan.jsx';
import VideoIdeas from './VideoIdeas.jsx';
import ContentPlan from './ContentPlan.jsx';
import MetricsView from './MetricsView.jsx';
import Finance from './Finance.jsx';
import ClientTasks from './ClientTasks.jsx';
import ClientService from './ClientService.jsx';
import ClientView from './ClientView.jsx';
import ClientApprovals from './ClientApprovals.jsx';
import SiteSettings from './SiteSettings.jsx';

export default function BusinessView({ view, advisorId, onNavigate, onSelectClient, onReport, onPresent, viewClientId, viewTab, onViewClient }) {
  if (view === 'tasks') return <BizTasks advisorId={advisorId} />;
  if (view === 'projects') return <Projects advisorId={advisorId} />;
  if (view === 'systems') return <Systems advisorId={advisorId} />;
  if (view === 'client-approvals') return <ClientApprovals advisorId={advisorId} />;
  if (view === 'site-settings') return <SiteSettings advisorId={advisorId} />;
  if (view === 'client-view') return <ClientView advisorId={advisorId} clientId={viewClientId} initialTab={viewTab} onClientChange={onViewClient} onReport={onReport} onPresent={onPresent} />;
  if (view === 'client-service') return <ClientService advisorId={advisorId} onSelect={onSelectClient} />;
  if (view === 'client-tasks') return <ClientTasks advisorId={advisorId} onSelect={onSelectClient} />;
  if (view === 'marketing') return <MarketingPlan advisorId={advisorId} onNavigate={onNavigate} />;
  if (view === 'ideas') return <VideoIdeas advisorId={advisorId} />;
  if (view === 'content-plan') return <ContentPlan advisorId={advisorId} />;
  if (view.startsWith('marketing-')) return <MetricsView advisorId={advisorId} kind="marketing" scope={view.slice(10)} onNavigate={onNavigate} />;
  if (view.startsWith('sales-')) return <MetricsView advisorId={advisorId} kind="sales" scope={view.slice(6)} />;
  if (view.startsWith('fin-')) return <Finance advisorId={advisorId} scope={view.slice(4)} />;
  return null;
}
