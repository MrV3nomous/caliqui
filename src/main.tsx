import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { EditorLayout } from '@/ui/layouts/EditorLayout';
import { RootLayout } from '@/ui/layouts/RootLayout';
import { Dashboard } from '@/ui/pages/Dashboard';
import { Editor } from '@/ui/pages/Editor';
import { Home } from '@/ui/pages/Home';
import './index.css';

import '@/shared/env';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'editor',
        element: <EditorLayout />,
        children: [
          {
            index: true,
            element: <Editor />,
          },
        ],
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
    ],
  },
]);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element. Check index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
