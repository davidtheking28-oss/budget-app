import React from 'react';
import ReactDOM from 'react-dom/client';
import { Chart as ChartJS } from 'chart.js';
import App from './App.jsx';
import SharedReport from './budget/SharedReport.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { installErrorReporter } from './errorReporter';
import './theme.css';

// A ?share=<token> link is a fully public, unauthenticated view — resolved
// once here, before App ever mounts, so its useSession()/auth gating never
// comes into play for this path.
const shareToken = new URLSearchParams(window.location.search).get('share');

installErrorReporter();

// Chart.js draws to canvas, so the global prefers-reduced-motion rule in
// theme.css cannot reach it. Opt out here instead.
if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  ChartJS.defaults.animation = false;
  ChartJS.defaults.animations = {};
  ChartJS.defaults.transitions = { active: { animation: { duration: 0 } } };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {shareToken ? <SharedReport token={shareToken} /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
