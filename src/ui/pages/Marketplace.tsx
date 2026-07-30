import { Globe, Heart, Search, ShoppingBag, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router';
import { env } from '@/shared/env';
import { Button, Card, Input } from '@/ui/design-system';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';

// Mock data for community designs
const MOCK_PRODUCTS = [
  {
    id: 1,
    title: 'Cyberpunk Skull',
    creator: '@neon_dreams',
    price: '$40.00',
    likes: 124,
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&q=80',
  },
  {
    id: 2,
    title: 'Minimalist Wave',
    creator: '@ocean_vibes',
    price: '$35.00',
    likes: 89,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
  },
  {
    id: 3,
    title: 'Retro Sunset',
    creator: '@vintage_co',
    price: '$38.00',
    likes: 256,
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&q=80',
  },
  {
    id: 4,
    title: 'Abstract Geometry',
    creator: '@shape_shift',
    price: '$42.00',
    likes: 67,
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&q=80',
  },
];

export function Marketplace() {
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { openCheckout } = useCheckoutStore();

  const handlePurchaseIntent = () => {
    if (!isAuthenticated) {
      openAuthModal();
    } else {
      openCheckout();
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-neutral-50 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-xl text-primary tracking-tight">
            {env.VITE_APP_NAME}{' '}
            <span className="text-secondary font-normal text-sm ml-2">Marketplace</span>
          </Link>
          <div className="hidden md:flex relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <Input placeholder="Search designs..." className="pl-9 h-9 bg-background" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/editor">
            <Button variant="outline" size="sm">
              Open Studio
            </Button>
          </Link>
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button variant="primary" size="sm">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Button variant="primary" size="sm" className="gap-2" onClick={openAuthModal}>
              <UserIcon size={16} /> Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-border pb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
                <Globe className="text-blue-500" /> Community Gallery
              </h1>
              <p className="text-secondary mt-2">
                Discover and purchase unique apparel designed by creators around the world.
              </p>
            </div>
            <div className="flex gap-2">
              {/* FIXED: Replaced isActive with the secondary variant to denote active state */}
              <Button variant="secondary" size="sm">
                Trending
              </Button>
              <Button variant="outline" size="sm">
                Newest
              </Button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {MOCK_PRODUCTS.map((product) => (
              <Card key={product.id} className="overflow-hidden group flex flex-col">
                <div className="aspect-4/5 bg-neutral-200 relative overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-surface/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1 text-xs font-medium text-primary shadow-sm">
                    <Heart size={12} className="text-red-500" /> {product.likes}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1 gap-3">
                  <div>
                    <h3 className="font-semibold text-primary truncate">{product.title}</h3>
                    <p className="text-xs text-secondary mt-0.5">{product.creator}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                    <span className="font-bold text-primary">{product.price}</span>
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-2 h-8 px-3"
                      onClick={handlePurchaseIntent}
                    >
                      <ShoppingBag size={14} /> Buy
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
