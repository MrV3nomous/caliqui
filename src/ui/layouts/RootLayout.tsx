import { Outlet } from 'react-router';

export function RootLayout() {
  return (
    <div className="w-screen h-screen flex bg-background font-sans">
      <main className="flex-1 relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
