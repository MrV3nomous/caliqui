import { Outlet } from 'react-router';

export function RootLayout() {
  return (
    <div className="w-screen h-screen bg-background text-primary overflow-hidden">
      <Outlet />
    </div>
  );
}
