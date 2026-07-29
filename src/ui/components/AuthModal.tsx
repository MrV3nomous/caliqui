import { Loader2, Lock, Mail, X } from 'lucide-react';
import { useState } from 'react';
import { env } from '@/shared/env';
import { Button, IconButton, Input, Label } from '@/ui/design-system';
import { useAuthStore } from '@/ui/store/auth-store';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If the modal isn't supposed to be open, render nothing
  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    // Call the mock login function from our store
    await login(email);

    // Reset local state once finished
    setIsLoading(false);
    setEmail('');
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-primary">Sign In to {env.VITE_APP_NAME}</h2>
          <IconButton onClick={closeAuthModal} title="Close">
            <X size={20} />
          </IconButton>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="pl-9 bg-background"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-9 bg-background"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={isLoading || !email.trim() || !password.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" /> Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>

          <p className="text-xs text-secondary text-center mt-4">
            *Mock Authentication. Enter any email and password to test the flow.
          </p>
        </form>
      </div>
    </div>
  );
}
