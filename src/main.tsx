import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { EditorLayout } from '@/ui/layouts/EditorLayout';
import { RootLayout } from '@/ui/layouts/RootLayout';
import { AdminDashboard } from '@/ui/pages/AdminDashboard';
import { CheckoutPage } from '@/ui/pages/CheckoutPage';
import { Dashboard } from '@/ui/pages/Dashboard';
import { Editor } from '@/ui/pages/Editor';
import { Home } from '@/ui/pages/Home';
import { Marketplace } from '@/ui/pages/Marketplace';
import { useAuthStore } from '@/ui/store/auth-store';
import './index.css';

import '@/shared/env';

// INITIALIZE AUTH LISTENER
// This prevents users from being signed out on page refresh
useAuthStore.getState().initAuth();

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
        path: 'checkout',
        element: <CheckoutPage />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'marketplace',
        element: <Marketplace />,
      },
      {
        path: 'admin',
        element: <AdminDashboard />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
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
