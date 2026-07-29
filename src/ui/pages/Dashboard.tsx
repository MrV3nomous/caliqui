import { Image as ImageIcon, LogOut, Package, Settings } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import { env } from '@/shared/env';
import { Button, Card } from '@/ui/design-system';
import { useAuthStore } from '@/ui/store/auth-store';

export function Dashboard() {
  const { user, isAuthenticated, logout } = useAuthStore();

  // Protect the route: if not logged in, boot them back to the editor
  if (!isAuthenticated) {
    return <Navigate to="/editor" replace />;
  }

  return (
    <div className="w-screen h-screen flex bg-background font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-surface flex flex-col shrink-0">
        <div className="h-14 border-b border-border flex items-center px-6 shrink-0">
          <Link
            to="/editor"
            className="font-bold text-primary tracking-tight hover:opacity-80 transition-opacity"
          >
            {env.VITE_APP_NAME}
          </Link>
        </div>

        <div className="p-4 flex-1 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-secondary mb-4 px-2">
            Menu
          </div>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 bg-primary/10 text-primary rounded-md font-medium text-sm transition-colors"
          >
            <Package size={18} /> My Orders
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 text-secondary hover:bg-background hover:text-primary rounded-md font-medium text-sm transition-colors"
          >
            <ImageIcon size={18} /> Saved Designs
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 text-secondary hover:bg-background hover:text-primary rounded-md font-medium text-sm transition-colors"
          >
            <Settings size={18} /> Settings
          </button>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="text-sm font-medium text-primary truncate">{user?.email}</div>
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={logout}>
            <LogOut size={16} /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-neutral-50">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-primary">Welcome back</h1>
            <p className="text-secondary mt-1">Manage your orders and custom apparel designs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 flex flex-col gap-2">
              <span className="text-secondary text-sm font-medium">Total Orders</span>
              <span className="text-3xl font-bold text-primary">1</span>
            </Card>
            <Card className="p-5 flex flex-col gap-2">
              <span className="text-secondary text-sm font-medium">Saved Designs</span>
              <span className="text-3xl font-bold text-primary">0</span>
            </Card>
            <Card className="p-5 flex flex-col gap-2 bg-primary text-primary-foreground border-transparent">
              <span className="text-primary-foreground/80 text-sm font-medium">New Project</span>
              <Link to="/editor" className="mt-1">
                <Button variant="secondary" size="sm" className="w-full">
                  Open Studio
                </Button>
              </Link>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
              Recent Orders
            </h2>
            <Card className="overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface text-secondary border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium">Order ID</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  <tr className="hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary">#ORD-001</td>
                    <td className="px-6 py-4 text-secondary">Today</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Processing
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-primary">$40.00</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
