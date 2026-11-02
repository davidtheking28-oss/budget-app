import { lazy, Suspense } from 'react';
import Skeleton from '../components/Skeleton.jsx';

const BizTasks = lazy(() => import('./BizTasks.jsx'));
const Planner = lazy(() => import('./Planner.jsx'));
const Projects = lazy(() => import('./Projects.jsx'));
const Systems = lazy(() => import('./Systems.jsx'));
const MarketingPlan = lazy(() => import('./MarketingPlan.jsx'));
const VideoIdeas = lazy(() => import('./VideoIdeas.jsx'));
const ContentPlan = lazy(() => import('./ContentPlan.jsx'));
const MetricsView = lazy(() => import('./MetricsView.jsx'));
const Finance = lazy(() => import('./Finance.jsx'));
const ClientTasks = lazy(() => import('./ClientTasks.jsx'));
const ClientService = lazy(() => import('./ClientService.jsx'));
const ClientView = lazy(() => import('./ClientView.jsx'));
const ClientApprovals = lazy(() => import('./ClientApprovals.jsx'));
const SiteSettings = lazy(() => import('./SiteSettings.jsx'));

function BusinessPage({ view, advisorId, onNavigate, onSelectClient, viewClientId, viewTab, onViewClient }) {
  if (view === 'tasks') return <BizTasks advisorId={advisorId} />;
  if (view === 'planner') return <Planner advisorId={advisorId} />;
  if (view === 'projects') return <Projects advisorId={advisorId} />;
  if (view === 'systems') return <Systems advisorId={advisorId} />;
  if (view === 'client-approvals') return <ClientApprovals advisorId={advisorId} />;
  if (view === 'site-settings') return <SiteSettings advisorId={advisorId} />;
  if (view === 'client-view') return <ClientView advisorId={advisorId} clientId={viewClientId} initialTab={viewTab} onClientChange={onViewClient} />;
  if (view === 'client-service') return <ClientService advisorId={advisorId} onSelect={onSelectClient} />;
  if (view === 'client-tasks') return <ClientTasks advisorId={advisorId} onSelect={onSelectClient} />;
  if (view === 'marketing') return <MarketingPlan advisorId={advisorId} onNavigate={onNavigate} />;
  if (view === 'ideas') return <VideoIdeas advisorId={advisorId} />;
  if (view === 'content-plan') return <ContentPlan advisorId={advisorId} />;
  if (view.startsWith('marketing-')) return <MetricsView advisorId={advisorId} kind="marketing" scope={view.slice(10)} onNavigate={onNavigate} />;
  if (view.startsWith('sales-')) return <MetricsView advisorId={advisorId} kind="sales" scope={view.slice(6)} />;
  if (view.startsWith('fin-')) return <Finance key={view} advisorId={advisorId} scope={view.slice(4)} onNavigate={onNavigate} />;
  return null;
}

export default function BusinessView(props) {
  return <Suspense fallback={<Skeleton height="260px" radius="18px" />}><BusinessPage {...props} /></Suspense>;
}
