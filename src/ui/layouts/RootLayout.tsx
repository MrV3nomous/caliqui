import { Outlet } from 'react-router';
import { AuthModal } from '@/ui/components/AuthModal';

export function RootLayout() {
  return (
    <div className="w-screen h-screen flex bg-background font-sans">
      <main className="flex-1 relative overflow-hidden">
        <Outlet />
      </main>

      {/* Global Modals overlay the entire app */}
      <AuthModal />
    </div>
  );
}
