import React from 'react';
import ReactDOM from 'react-dom/client';
import { Chart as ChartJS } from 'chart.js';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './theme.css';

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
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
