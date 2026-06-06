import { createHashRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import App from './App';
import HomePage from './pages/Home';

const ChaptersPage = lazy(() => import('./pages/Chapters'));
const KnowledgePage = lazy(() => import('./pages/Knowledge'));
const KnowledgeManagementPage = lazy(() => import('./pages/KnowledgeManagement'));
const GraphPage = lazy(() => import('./pages/Graph'));
const WritingPage = lazy(() => import('./pages/Writing'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const BrainstormPage = lazy(() => import('./pages/Brainstorm'));
const ConfigPage = lazy(() => import('./pages/Config'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'chapters',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ChaptersPage />
          </Suspense>
        ),
      },
      {
        path: 'knowledge',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <KnowledgePage />
          </Suspense>
        ),
      },
      {
        path: 'knowledge-management',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <KnowledgeManagementPage />
          </Suspense>
        ),
      },
      {
        path: 'graph',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <GraphPage />
          </Suspense>
        ),
      },
      {
        path: 'writing',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <WritingPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'brainstorm',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <BrainstormPage />
          </Suspense>
        ),
      },
      {
        path: 'config',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ConfigPage />
          </Suspense>
        ),
      },
    ],
  },
]);
