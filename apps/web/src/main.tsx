import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { WorkspaceProvider } from './workspace/WorkspaceContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './App';
// React Flow stylesheet (base styles before app overrides)
import '@xyflow/react/dist/style.css';
// Design tokens (CSS vars + Tailwind @theme) — single source of truth.
// Usage: <button className="bg-primary text-on-primary rounded-pill shadow-glow font-sans">
//        <h1 className="text-display-xl font-display text-ink">
import './styles/tokens.css';
import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
