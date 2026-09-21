import {
  ArrowLeft,
  Box,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Package,
  Pencil,
  Percent,
  Plus,
  Search,
  Send,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { env } from '@/shared/env';
import { supabase } from '@/shared/lib/supabase';
import { generatePrintFile } from '@/shared/utils/export-engine';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { Input, Label } from '@/ui/design-system';
import { type OrderLineItem, useAdminStore } from '@/ui/store/admin-store';
import { type DecalData, useEditorStore } from '@/ui/store/editor-store';

interface MarketplaceItemData {
  id: string;
  name: string;
  description: string;
  price: number;
  collection: string;
  discount_percentage: number;
  is_new: boolean;
  is_bestseller: boolean;
  is_trending: boolean;
  is_active: boolean;
  thumbnail_url?: string;
  canvas_state?: Record<string, unknown>[];
  tshirt_color?: string;
  apparel_model?: string;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { init } = useEditorStore();
  const {
    adminRole,
    orders,
    adminDesigns,
    tickets,
    isLoading,
    verifyAdminAccess,
    fetchAdminData,
    fetchAdminDesigns,
    fetchTickets,
    replyToTicket,
    resolveTicket,
    updateOrderItemStatus,
    uploadMarketplaceAsset,
    createMarketplaceItem,
  } = useAdminStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'catalog' | 'support'>(
    'orders',
  );
  const [orderFilter, setOrderFilter] = useState<'all' | 'processing' | 'shipped' | 'delivered'>(
    'all',
  );

  // RBAC Role Checking Engine
  const isSuper = adminRole === 'super_admin';
  const canFulfill = isSuper || adminRole === 'fulfillment_manager';
  const canCatalog = isSuper || adminRole === 'catalog_manager';
  const canSupport = isSuper || adminRole === 'support_agent';

  // Support Desk State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Accordion & Item Dispatch State
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [dispatchState, setDispatchState] = useState<{ itemId: string } | null>(null);
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');

  // Track generating state for UI feedback
  const [generatingPrintFileId, setGeneratingPrintFileId] = useState<string | null>(null);

  // CMS State (Create)
  const [isCMSOpen, setIsCMSOpen] = useState(false);
  const [cmsType, setCmsType] = useState<'photo' | '3d'>('photo');
  const [cmsName, setCmsName] = useState('');
  const [cmsPrice, setCmsPrice] = useState('1499');
  const [cmsDesc, setCmsDesc] = useState('');
  const [cmsFiles, setCmsFiles] = useState<File[]>([]);
  const [cmsSelectedDesignId, setCmsSelectedDesignId] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);

  // New CMS Extended Fields
  const [cmsCollection, setCmsCollection] = useState('');
  const [cmsDiscount, setCmsDiscount] = useState('0');
  const [cmsIsNew, setCmsIsNew] = useState(false);
  const [cmsIsBestseller, setCmsIsBestseller] = useState(false);
  const [cmsIsTrending, setCmsIsTrending] = useState(false);

  // Catalog Management State
  const [catalogItems, setCatalogItems] = useState<MarketplaceItemData[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  // Catalog Filter & Search State
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogActiveCategory, setCatalogActiveCategory] = useState<string>('All');

  // Edit Catalog Item State
  const [editingItem, setEditingItem] = useState<MarketplaceItemData | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    price: '',
    collection: '',
    discount_percentage: '0',
    is_new: false,
    is_bestseller: false,
    is_trending: false,
  });

  const loadCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    const { data } = await supabase
      .from('marketplace_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCatalogItems(data);
    setIsCatalogLoading(false);
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      const isAllowed = await verifyAdminAccess();
      if (isAllowed) {
        // Intelligently fetch only what this user's role is allowed to see
        const role = useAdminStore.getState().adminRole;
        if (role === 'super_admin' || role === 'fulfillment_manager') fetchAdminData();
        if (role === 'super_admin' || role === 'catalog_manager') {
          fetchAdminDesigns();
          loadCatalog();
        }
        if (role === 'super_admin' || role === 'support_agent') {
          fetchTickets();
          fetchAdminData(); // Fetched so support agents have order context
        }

        // Auto-route them to their primary allowed tab if they don't have Orders access
        if (role === 'catalog_manager') setActiveTab('inventory');
        if (role === 'support_agent') setActiveTab('support');
      } else if (isAllowed === false) {
        navigate('/');
      }
    };
    checkAccess();
  }, [verifyAdminAccess, fetchAdminData, fetchAdminDesigns, loadCatalog, fetchTickets, navigate]);

  const toggleOrderAccordion = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleItemDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchState || !courier || !tracking)
      return alert('Please provide courier and tracking details.');

    await updateOrderItemStatus(dispatchState.itemId, 'shipped', courier, tracking);
    setDispatchState(null);
    setCourier('');
    setTracking('');
  };

  const handleProductClick = (item: OrderLineItem) => {
    if (item.type === 'marketplace') {
      navigate(`/marketplace?item=${item.product_id}`);
    } else if (item.type === 'custom') {
      const workspaceStr = localStorage.getItem('caliqui_workspace');
      if (workspaceStr) {
        try {
          const parsed = JSON.parse(workspaceStr);
          parsed.activeDesignId = item.product_id;
          localStorage.setItem('caliqui_workspace', JSON.stringify(parsed));
          init();
        } catch (e) {
          console.error(e);
        }
      }
      navigate('/editor');
    }
  };

  const handleDownloadPrintFile = async (
    item: OrderLineItem,
    canvasState: Record<string, unknown>[] | null,
  ) => {
    if (!canvasState || canvasState.length === 0) {
      return alert(
        'This item does not contain a Studio canvas state. Print files cannot be generated for standard photography pieces.',
      );
    }

    setGeneratingPrintFileId(item.id);
    try {
      const blob = await generatePrintFile(canvasState as unknown as DecalData[]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PrintFile-${item.order_id.split('-')[0]}-${item.name.replace(/\s+/g, '')}.png`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Failed to render the high-resolution print file from canvas state.');
    } finally {
      setGeneratingPrintFileId(null);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      const basePayload = {
        name: cmsName,
        description: cmsDesc,
        price: Number(cmsPrice),
        collection: cmsCollection || 'Core',
        available_sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        discount_percentage: Number(cmsDiscount),
        is_new: cmsIsNew,
        is_bestseller: cmsIsBestseller,
        is_trending: cmsIsTrending,
      };

      if (cmsType === 'photo') {
        if (cmsFiles.length === 0) throw new Error('Upload at least one image.');
        const uploadedUrls = await Promise.all(cmsFiles.map((f) => uploadMarketplaceAsset(f)));
        await createMarketplaceItem({
          ...basePayload,
          thumbnail_url: uploadedUrls[0],
          gallery_urls: uploadedUrls,
        });
      } else {
        if (!cmsSelectedDesignId) throw new Error('Select a 3D design.');
        const design = adminDesigns.find((d) => d.id === cmsSelectedDesignId);
        if (!design) throw new Error('Design not found.');

        await createMarketplaceItem({
          ...basePayload,
          thumbnail_url: design.thumbnail_url,
          canvas_state: design.canvas_state,
          tshirt_color: design.tshirt_color,
          apparel_model: design.apparel_model || 'tshirtman',
        });
      }
      setIsCMSOpen(false);
      resetCmsForm();
      alert('Product successfully published to Marketplace!');
      loadCatalog();
    } catch (err) {
      alert((err as Error).message || 'Failed to publish item.');
    } finally {
      setIsPublishing(false);
    }
  };

  const resetCmsForm = () => {
    setCmsName('');
    setCmsDesc('');
    setCmsFiles([]);
    setCmsCollection('');
    setCmsDiscount('0');
    setCmsIsNew(false);
    setCmsIsBestseller(false);
    setCmsIsTrending(false);
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item permanently?')) return;
    await supabase.from('marketplace_items').delete().eq('id', id);
    loadCatalog();
  };

  const handleToggleVisibility = async (id: string, currentStatus: boolean) => {
    await supabase.from('marketplace_items').update({ is_active: !currentStatus }).eq('id', id);
    loadCatalog();
  };

  const handleOpenEditModal = (item: MarketplaceItemData) => {
    setEditingItem(item);
    setEditForm({
      name: item.name || '',
      description: item.description || '',
      price: String(item.price || '0'),
      collection: item.collection || '',
      discount_percentage: String(item.discount_percentage || '0'),
      is_new: !!item.is_new,
      is_bestseller: !!item.is_bestseller,
      is_trending: !!item.is_trending,
    });
  };

  const handleUpdateCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsPublishing(true);
    try {
      const payload = {
        name: editForm.name,
        description: editForm.description,
        price: Number(editForm.price),
        collection: editForm.collection || 'Core',
        discount_percentage: Number(editForm.discount_percentage),
        is_new: editForm.is_new,
        is_bestseller: editForm.is_bestseller,
        is_trending: editForm.is_trending,
      };
      await supabase.from('marketplace_items').update(payload).eq('id', editingItem.id);
      setEditingItem(null);
      loadCatalog();
    } catch (_err) {
      alert('Failed to update product details.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReplyToTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyText.trim()) return;
    await replyToTicket(selectedTicketId, replyText);
    setReplyText('');
  };

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true;
    if (o.status === orderFilter) return true;
    if (o.order_items?.some((item) => item.status === orderFilter)) return true;
    return false;
  });

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + (o.amount || 0), 0);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const dynamicCategories = useMemo(() => {
    const categories = new Set(catalogItems.map((i) => i.collection || 'Core'));
    return ['All', ...Array.from(categories)];
  }, [catalogItems]);

  const filteredCatalogItems = catalogItems.filter((item) => {
    const queryWords = catalogSearchQuery.toLowerCase().split(' ').filter(Boolean);
    const searchableText =
      `${item.name} ${item.description || ''} ${item.collection || ''}`.toLowerCase();

    const matchesSearch = queryWords.every((word) => searchableText.includes(word));
    const matchesCategory =
      catalogActiveCategory === 'All' || item.collection === catalogActiveCategory;

    return matchesSearch && matchesCategory;
  });

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  if (isLoading || adminRole === null) {
    return <PremiumLoader fullScreen={true} />;
  }

  // Generate Available Tabs dynamically based on RBAC matrix
  const availableTabs = [];
  if (canFulfill)
    availableTabs.push({
      id: 'orders',
      label: 'Fulfillment Pipeline',
      icon: <Package size={14} strokeWidth={1.5} />,
    });
  if (canCatalog) {
    availableTabs.push({
      id: 'inventory',
      label: 'Publish Item',
      icon: <Plus size={14} strokeWidth={1.5} />,
    });
    availableTabs.push({
      id: 'catalog',
      label: 'Manage Catalog',
      icon: <Box size={14} strokeWidth={1.5} />,
    });
  }
  if (canSupport)
    availableTabs.push({
      id: 'support',
      label: 'Support Desk',
      icon: <LifeBuoy size={14} strokeWidth={1.5} />,
    });

  const Switch = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: () => void;
    label: string;
  }) => (
    <button
      type="button"
      className="w-full flex items-center justify-between p-3 bg-[#fbfbfd] border border-black/[0.04] rounded-2xl cursor-pointer hover:border-black/10 transition-colors outline-none"
      onClick={onChange}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-600">
        {label}
      </span>
      <div
        className={`w-10 h-5.5 rounded-full transition-colors relative shadow-inner ${checked ? 'bg-black' : 'bg-neutral-200'}`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white absolute top-[3px] shadow-sm transition-transform ${checked ? 'translate-x-[20px]' : 'translate-x-[3px]'}`}
        />
      </div>
    </button>
  );

  return (
    <div className="w-full h-[100dvh] bg-white text-black font-sans flex flex-col overflow-y-auto overflow-x-hidden select-none">
      {/* EDIT CATALOG ITEM MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm outline-none cursor-default border-0 p-0 m-0 animate-in fade-in duration-300"
            onClick={() => setEditingItem(null)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-2xl animate-in zoom-in-95 duration-300 ease-out max-h-[90dvh] overflow-y-auto hide-scrollbar">
            <div className="flex justify-between items-center mb-8 border-b border-black/[0.04] pb-6 sticky top-0 bg-white z-20">
              <div>
                <h2 className="text-xl font-light tracking-tight text-black">Edit Product</h2>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mt-1">
                  Catalog Item Update
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-10 h-10 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-black rounded-full transition-colors outline-none"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleUpdateCatalogItem} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                    Product Name
                  </Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-[#fbfbfd] h-12 rounded-2xl border-black/[0.05] focus:bg-white text-sm"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                    Collection Category
                  </Label>
                  <Input
                    value={editForm.collection}
                    onChange={(e) => setEditForm({ ...editForm, collection: e.target.value })}
                    className="bg-[#fbfbfd] h-12 rounded-2xl border-black/[0.05] focus:bg-white text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                    Base Price (₹)
                  </Label>
                  <Input
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="bg-[#fbfbfd] h-12 rounded-2xl border-black/[0.05] focus:bg-white text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block flex items-center gap-1">
                    <Percent size={10} /> Discount Percentage
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.discount_percentage}
                    onChange={(e) =>
                      setEditForm({ ...editForm, discount_percentage: e.target.value })
                    }
                    className="bg-[#fbfbfd] h-12 rounded-2xl border-black/[0.05] focus:bg-white text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                  Editorial Description
                </Label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  className="w-full bg-[#fbfbfd] border border-black/[0.05] focus:bg-white focus:border-black/20 transition-all text-sm font-light leading-relaxed rounded-2xl px-5 py-4 outline-none text-black placeholder:text-neutral-300 resize-none"
                  required
                />
              </div>

              <div className="bg-[#fbfbfd] border border-black/[0.04] rounded-3xl p-5 space-y-1">
                <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5 mb-4">
                  <Tags size={12} strokeWidth={1.5} /> Promotional Tags
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Switch
                    checked={editForm.is_new}
                    onChange={() => setEditForm({ ...editForm, is_new: !editForm.is_new })}
                    label="New Arrival"
                  />
                  <Switch
                    checked={editForm.is_bestseller}
                    onChange={() =>
                      setEditForm({ ...editForm, is_bestseller: !editForm.is_bestseller })
                    }
                    label="Best Seller"
                  />
                  <Switch
                    checked={editForm.is_trending}
                    onChange={() =>
                      setEditForm({ ...editForm, is_trending: !editForm.is_trending })
                    }
                    label="Trending"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPublishing}
                className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-2xl font-medium text-[11px] uppercase tracking-[0.2em] flex items-center justify-center transition-all shadow-md mt-4 outline-none"
              >
                {isPublishing ? (
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <header className="h-[70px] w-full bg-white/95 backdrop-blur-md border-b border-black/[0.04] flex items-center justify-between px-5 sm:px-8 z-50 sticky top-0 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:opacity-60 transition-opacity outline-none">
            <img
              src="/logo.png"
              alt={env.VITE_APP_NAME}
              className="h-5 sm:h-6 w-auto object-contain"
            />
          </Link>
          <div className="w-px h-4 bg-neutral-200 mx-1" />
          <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.2em] text-red-500">
            Admin Console
          </span>
          <span className="hidden md:inline-block px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[8px] font-bold uppercase tracking-widest border border-red-100">
            {adminRole?.replace('_', ' ')}
          </span>
        </div>

        <Link
          to="/dashboard"
          className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400 hover:text-black transition-colors outline-none flex items-center gap-1.5"
        >
          <ArrowLeft size={14} strokeWidth={1.5} /> Exit
        </Link>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 sm:px-12 py-10 pb-32">
        {/* KPI DASHBOARD (Strictly Super Admin Only) */}
        {isSuper && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 animate-in fade-in slide-in-from-top-4">
            <div className="bg-[#fbfbfd] border border-black/[0.04] rounded-[2rem] p-6 shadow-sm hover:border-black/10 transition-colors">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-3">
                Total Revenue
              </p>
              <p className="text-3xl font-light text-black tracking-tight">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-[#fbfbfd] border border-black/[0.04] rounded-[2rem] p-6 shadow-sm hover:border-black/10 transition-colors">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-3">
                Total Orders
              </p>
              <p className="text-3xl font-light text-black tracking-tight">{orders.length}</p>
            </div>
            <div className="bg-[#fff9f0] border border-amber-500/10 rounded-[2rem] p-6 shadow-sm hover:border-amber-500/30 transition-colors">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-amber-500 mb-3">
                Pending
              </p>
              <p className="text-3xl font-light text-amber-600 tracking-tight">
                {orders.filter((o) => o.status === 'processing').length}
              </p>
            </div>
            <div className="bg-[#f0fdf4] border border-green-500/10 rounded-[2rem] p-6 shadow-sm hover:border-green-500/30 transition-colors">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-green-500 mb-3">
                Delivered
              </p>
              <p className="text-3xl font-light text-green-600 tracking-tight">
                {orders.filter((o) => o.status === 'delivered').length}
              </p>
            </div>
          </div>
        )}

        {/* ADMIN TABS (Role-Filtered) */}
        <div className="flex items-center gap-6 border-b border-black/[0.04] mb-10 overflow-x-auto hide-scrollbar">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'orders' | 'inventory' | 'catalog' | 'support')}
              className={`flex items-center gap-2 pb-4 text-[10px] font-medium uppercase tracking-[0.15em] transition-all whitespace-nowrap outline-none border-b-2 shrink-0 ${
                activeTab === tab.id
                  ? 'text-black border-black'
                  : 'text-neutral-400 border-transparent hover:text-black hover:border-black/20'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && canFulfill && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {['all', 'processing', 'shipped', 'delivered'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setOrderFilter(f as 'all' | 'processing' | 'shipped' | 'delivered')
                  }
                  className={`px-5 py-2 rounded-full text-[10px] font-medium uppercase tracking-[0.1em] border transition-all shrink-0 outline-none ${orderFilter === f ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-neutral-500 border-black/10 hover:border-black/30'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrders.has(order.id);

                // Deterministically sort items to prevent React re-order bugs during optimistic updates
                const sortedItems = [...(order.order_items || [])].sort((a, b) =>
                  a.id.localeCompare(b.id),
                );

                return (
                  <div
                    key={order.id}
                    className="bg-white border border-black/[0.04] rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                  >
                    {/* ACCORDION HEADER (COMPACT) */}
                    <button
                      type="button"
                      onClick={() => toggleOrderAccordion(order.id)}
                      className="w-full px-5 sm:px-8 py-5 flex items-center justify-between bg-[#fbfbfd] hover:bg-neutral-50 transition-colors outline-none text-left"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 flex-1">
                        {/* Dynamic Item-Level Badges instead of Single Global Badge */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {!order.order_items ||
                          order.order_items.length === 0 ||
                          order.status === 'draft' ? (
                            <span className="px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] rounded-md shrink-0 bg-neutral-100 text-neutral-500">
                              {order.status}
                            </span>
                          ) : (
                            ['processing', 'shipped', 'delivered'].map((status) => {
                              const count =
                                order.order_items?.filter((i) => i.status === status).length || 0;
                              if (count === 0) return null;
                              return (
                                <span
                                  key={status}
                                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] rounded-md shrink-0 ${
                                    status === 'processing'
                                      ? 'bg-amber-100 text-amber-700'
                                      : status === 'shipped'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {count} {status}
                                </span>
                              );
                            })
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-mono font-medium text-neutral-500 uppercase tracking-widest">
                            #{order.id.slice(0, 8)}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-1 tracking-wider">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                        <div className="hidden sm:block pl-8 border-l border-black/5">
                          <p className="text-sm font-medium text-black">{order.customer_name}</p>
                          <p className="text-[10px] text-neutral-400 mt-1 uppercase tracking-widest">
                            {order.order_items?.length || 0} Items
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 shrink-0 pl-4">
                        <span className="text-lg font-light tracking-tight text-black">
                          ₹{(order.amount || 0).toLocaleString('en-IN')}
                        </span>
                        <ChevronDown
                          className={`text-neutral-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                          size={18}
                        />
                      </div>
                    </button>

                    {/* EXPANDED CONTENT: ITEM-LEVEL FULFILLMENT */}
                    {isExpanded && (
                      <div className="p-5 sm:p-8 border-t border-black/5 space-y-6 bg-white animate-in slide-in-from-top-4 duration-300">
                        {sortedItems.map((item) => {
                          // Lookups for visual data
                          let thumbnail = '';
                          let canvasState = null;
                          let tshirtColor = '#ffffff';
                          let apparelModel = 'tshirtman';
                          let collectionName =
                            item.type === 'custom' ? 'Studio Bespoke' : 'Marketplace Piece';

                          if (item.type === 'marketplace') {
                            const catItem = catalogItems.find((c) => c.id === item.product_id);
                            if (catItem) {
                              thumbnail = catItem.thumbnail_url || '';
                              canvasState = catItem.canvas_state;
                              tshirtColor = catItem.tshirt_color || '#ffffff';
                              apparelModel = catItem.apparel_model || 'tshirtman';
                              if (catItem.collection) collectionName = catItem.collection;
                            }
                          } else if (item.type === 'custom') {
                            const desItem = adminDesigns.find((d) => d.id === item.product_id);
                            if (desItem) {
                              thumbnail = desItem.thumbnail_url || '';
                              canvasState = desItem.canvas_state;
                              tshirtColor = desItem.tshirt_color || '#ffffff';
                              apparelModel =
                                (desItem as { apparel_model?: string }).apparel_model ||
                                'tshirtman';
                            }
                          }

                          // Address strictly for this item (fallback to global order address)
                          const itemAddress = item.shipping_snapshot || order.shipping_snapshot;

                          // Explicit Manual Override State logic
                          const itemStatus = item.status || 'draft';
                          const isDispatching = dispatchState?.itemId === item.id;
                          const isGenerating = generatingPrintFileId === item.id;

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-4 p-6 bg-[#fbfbfd] border border-black/5 rounded-2xl"
                            >
                              {/* META HEADER FOR DB TRACKING */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 pb-4">
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-[0.2em]">
                                    Item Record ID: {item.id}
                                  </span>
                                  <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-[0.2em]">
                                    Origin Product ID: {item.product_id}
                                  </span>
                                </div>
                                <div className="flex flex-col sm:text-right gap-1">
                                  <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                                    Created:{' '}
                                    {item.created_at
                                      ? formatDate(item.created_at)
                                      : formatDate(order.created_at)}
                                  </span>
                                  <span className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em]">
                                    Last Update:{' '}
                                    {item.updated_at
                                      ? formatDate(item.updated_at)
                                      : formatDate(order.updated_at || order.created_at)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col lg:flex-row gap-6">
                                {/* 1. Item Visuals & Meta */}
                                <div className="flex flex-col gap-4 lg:w-[35%]">
                                  <button
                                    type="button"
                                    onClick={() => handleProductClick(item)}
                                    className="flex gap-5 text-left outline-none group cursor-pointer w-full"
                                  >
                                    <div className="w-28 h-36 shrink-0 bg-[#fbfbfd] rounded-xl flex items-center justify-center relative overflow-hidden border border-black/5 p-1 transition-colors group-hover:border-black/15 group-hover:bg-[#f5f5f7]">
                                      {canvasState && canvasState.length > 0 ? (
                                        <div className="absolute inset-0 pointer-events-none mix-blend-multiply p-2">
                                          <Mini3DViewer
                                            canvasState={canvasState}
                                            tshirtColor={tshirtColor}
                                            apparelModel={apparelModel}
                                            fallbackImage={thumbnail || undefined}
                                          />
                                        </div>
                                      ) : thumbnail ? (
                                        <img
                                          src={thumbnail}
                                          className="w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                                          alt="Product"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <Box
                                          size={24}
                                          className="text-neutral-300 transition-transform duration-500 group-hover:scale-110"
                                        />
                                      )}
                                    </div>
                                    <div className="flex-1 flex flex-col justify-start">
                                      <h5 className="font-medium text-sm text-black leading-tight group-hover:underline underline-offset-4">
                                        {item.name}
                                      </h5>
                                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400 mt-1 mb-3">
                                        {collectionName}
                                      </p>

                                      <div className="flex flex-wrap gap-2 mb-4">
                                        {item.sizes &&
                                          Object.entries(item.sizes)
                                            .filter(([_, q]) => (q as number) > 0)
                                            .map(([s, q]) => (
                                              <span
                                                key={s}
                                                className="text-[10px] font-medium bg-white px-2 py-1 rounded border border-black/10 shadow-sm"
                                              >
                                                {s}:{' '}
                                                <strong className="text-black">
                                                  {q as number}
                                                </strong>
                                              </span>
                                            ))}
                                      </div>
                                    </div>
                                  </button>

                                  {canvasState && canvasState.length > 0 && (
                                    <button
                                      type="button"
                                      disabled={isGenerating}
                                      onClick={() => handleDownloadPrintFile(item, canvasState)}
                                      className="self-start flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-blue-600 hover:text-blue-800 disabled:text-neutral-400 transition-colors bg-blue-50 disabled:bg-neutral-100 px-3 py-1.5 rounded-lg border border-blue-100 disabled:border-neutral-200 outline-none"
                                    >
                                      {isGenerating ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Download size={12} strokeWidth={2} />
                                      )}
                                      {isGenerating ? 'Rendering...' : 'Extract Print File'}
                                    </button>
                                  )}
                                </div>

                                {/* 2. Item Specific Address */}
                                <div className="lg:w-[30%] border-t lg:border-t-0 lg:border-l border-black/5 pt-5 lg:pt-0 lg:pl-6 flex flex-col justify-start">
                                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                                    Deliver To
                                  </p>
                                  <p className="text-sm font-medium text-black mb-1">
                                    {itemAddress?.label || order.customer_name}
                                  </p>
                                  <p className="text-xs font-light text-neutral-500 leading-relaxed">
                                    {itemAddress?.address}
                                  </p>
                                  <p className="text-[11px] font-medium text-neutral-400 mt-2 tracking-wider">
                                    Tel: {itemAddress?.phone}
                                  </p>
                                </div>

                                {/* 3. Item specific Fulfillment Actions */}
                                <div className="lg:w-[35%] border-t lg:border-t-0 lg:border-l border-black/5 pt-5 lg:pt-0 lg:pl-6 flex flex-col justify-start h-full">
                                  <div className="flex items-center justify-between mb-4">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                                      Fulfillment Stage
                                    </p>
                                    {/* Dynamic Stage Dropdown */}
                                    <div className="relative">
                                      <select
                                        value={isDispatching ? 'shipped' : itemStatus}
                                        onChange={(e) => {
                                          const newStatus = e.target.value as
                                            | 'draft'
                                            | 'processing'
                                            | 'shipped'
                                            | 'delivered';
                                          if (newStatus === 'shipped') {
                                            setDispatchState({ itemId: item.id });
                                          } else {
                                            setDispatchState(null);
                                            updateOrderItemStatus(item.id, newStatus);
                                          }
                                        }}
                                        className="appearance-none text-[10px] font-bold uppercase tracking-widest bg-[#fbfbfd] border border-black/10 hover:border-black/30 rounded-lg pl-3 pr-8 py-1.5 outline-none cursor-pointer transition-colors text-black"
                                      >
                                        <option value="draft">Draft</option>
                                        <option value="processing">Processing</option>
                                        <option value="shipped">Shipped</option>
                                        <option value="delivered">Delivered</option>
                                      </select>
                                      <ChevronDown
                                        size={12}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                                      />
                                    </div>
                                  </div>

                                  {/* Dispatch Form Intercept */}
                                  {isDispatching && (
                                    <form
                                      onSubmit={handleItemDispatchSubmit}
                                      className="space-y-3 bg-white p-4 rounded-xl border border-black/10 shadow-sm animate-in fade-in"
                                    >
                                      <div>
                                        <Input
                                          value={courier}
                                          onChange={(e) => setCourier(e.target.value)}
                                          placeholder="Courier (e.g. BlueDart)"
                                          className="h-9 text-xs bg-[#fbfbfd] border-black/5"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <Input
                                          value={tracking}
                                          onChange={(e) => setTracking(e.target.value)}
                                          placeholder="AWB Tracking Number"
                                          className="h-9 text-xs bg-[#fbfbfd] border-black/5"
                                          required
                                        />
                                      </div>
                                      <div className="flex gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setDispatchState(null)}
                                          className="flex-1 h-9 rounded-lg text-[9px] uppercase tracking-widest font-bold text-neutral-500 hover:bg-neutral-100 transition-colors outline-none"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="submit"
                                          className="flex-1 h-9 rounded-lg text-[9px] uppercase tracking-widest font-bold bg-black text-white hover:bg-neutral-800 transition-colors outline-none shadow-sm"
                                        >
                                          Confirm
                                        </button>
                                      </div>
                                    </form>
                                  )}

                                  {/* Logistics Shipped Info */}
                                  {!isDispatching && itemStatus === 'shipped' && (
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col mt-2 animate-in fade-in">
                                      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-blue-400 mb-2">
                                        Logistics Dispatch
                                      </p>
                                      <p className="text-xs font-medium text-blue-900 mb-0.5">
                                        {item.courier_name || 'N/A'}
                                      </p>
                                      <p className="text-[11px] font-mono text-blue-800 tracking-widest">
                                        {item.tracking_number || 'N/A'}
                                      </p>
                                    </div>
                                  )}

                                  {/* Visual Badges for other states */}
                                  {!isDispatching && itemStatus === 'delivered' && (
                                    <div className="h-full flex items-center justify-center bg-green-50/50 border border-green-100 rounded-xl mt-2 p-4 animate-in fade-in">
                                      <div className="text-center">
                                        <CheckCircle2
                                          size={24}
                                          className="text-green-500 mx-auto mb-2"
                                          strokeWidth={2}
                                        />
                                        <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">
                                          Item Delivered
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {!isDispatching && itemStatus === 'processing' && (
                                    <div className="h-full flex flex-col justify-center items-center p-4 border border-dashed border-amber-200 bg-amber-50/30 rounded-xl mt-2">
                                      <Package size={20} className="text-amber-400 mb-2" />
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 text-center">
                                        In Production
                                      </p>
                                    </div>
                                  )}

                                  {!isDispatching && itemStatus === 'draft' && (
                                    <div className="h-full flex flex-col justify-center items-center p-4 border border-dashed border-neutral-200 bg-[#fbfbfd] rounded-xl mt-2">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-center">
                                        Awaiting Payment Sync
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {(!order.order_items || order.order_items.length === 0) && (
                          <p className="text-xs text-neutral-500 italic text-center py-6">
                            No item details recorded for this order.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredOrders.length === 0 && (
                <div className="text-center py-20 text-neutral-400 font-medium text-sm tracking-wide">
                  No orders found in this queue.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PUBLISH CMS */}
        {activeTab === 'inventory' && canCatalog && (
          <div className="animate-in fade-in duration-500">
            {!isCMSOpen ? (
              <div className="bg-[#fbfbfd] border border-black/[0.04] rounded-[3rem] p-12 md:p-20 text-center shadow-sm flex flex-col items-center">
                <Box size={40} strokeWidth={1} className="text-neutral-300 mb-8" />
                <h2 className="text-2xl font-light tracking-tight mb-4">Marketplace CMS</h2>
                <p className="text-neutral-500 font-light text-sm tracking-wide mb-10 max-w-lg leading-relaxed">
                  Publish high-end photography products or convert 3D Studio concepts into standard
                  Marketplace Collection pieces.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCMSOpen(true)}
                  className="inline-flex items-center gap-3 h-14 px-10 bg-black hover:bg-neutral-800 text-white rounded-full font-medium text-[11px] uppercase tracking-[0.15em] transition-transform active:scale-95 shadow-md outline-none"
                >
                  <Plus size={16} strokeWidth={1.5} /> Create Listing
                </button>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto bg-white border border-black/[0.04] rounded-[2.5rem] p-8 sm:p-12 shadow-xl">
                <div className="flex justify-between items-center mb-10 border-b border-black/[0.04] pb-6">
                  <div>
                    <h2 className="text-2xl font-light tracking-tight text-black">New Product</h2>
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mt-2">
                      Marketplace Listing
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCMSOpen(false)}
                    className="w-10 h-10 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-black rounded-full transition-colors outline-none"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>

                <form onSubmit={handlePublish} className="space-y-8">
                  {/* TYPE TOGGLE */}
                  <div className="flex gap-2 p-1.5 bg-[#fbfbfd] border border-black/[0.04] rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setCmsType('photo')}
                      className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-[11px] font-medium tracking-widest uppercase transition-all outline-none ${cmsType === 'photo' ? 'bg-white shadow-sm text-black border border-black/5' : 'text-neutral-400 hover:text-black'}`}
                    >
                      <ImageIcon size={14} strokeWidth={1.5} /> Photography
                    </button>
                    <button
                      type="button"
                      onClick={() => setCmsType('3d')}
                      className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-[11px] font-medium tracking-widest uppercase transition-all outline-none ${cmsType === '3d' ? 'bg-white shadow-sm text-black border border-black/5' : 'text-neutral-400 hover:text-black'}`}
                    >
                      <Layers size={14} strokeWidth={1.5} /> 3D Design
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                        Product Name
                      </Label>
                      <Input
                        value={cmsName}
                        onChange={(e) => setCmsName(e.target.value)}
                        placeholder="e.g. Minimalist Core Tee"
                        className="bg-[#fbfbfd] h-12 rounded-2xl border-black/[0.05] focus:bg-white text-sm"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                        Collection Category
                      </Label>
                      <Input
                        value={cmsCollection}
                        onChange={(e) => setCmsCollection(e.target.value)}
                        placeholder="e.g. Summer Drop"
                        className="bg-[#fbfbfd] h-12 rounded-2xl border-black/[0.05] focus:bg-white text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                        Base Price (₹)
                      </Label>
                      <Input
                        type="number"
                        value={cmsPrice}
                        onChange={(e) => setCmsPrice(e.target.value)}
                        className="bg-[#fbfbfd] h-12 rounded-2xl border-black/[0.05] focus:bg-white text-sm font-mono"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block flex items-center gap-1">
                        <Percent size={10} /> Discount Percentage
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={cmsDiscount}
                        onChange={(e) => setCmsDiscount(e.target.value)}
                        className="bg-[#fbfbfd] h-12 rounded-2xl border-black/[0.05] focus:bg-white text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block">
                      Editorial Description
                    </Label>
                    <textarea
                      value={cmsDesc}
                      onChange={(e) => setCmsDesc(e.target.value)}
                      rows={4}
                      className="w-full bg-[#fbfbfd] border border-black/[0.05] focus:bg-white focus:border-black/20 transition-all text-sm font-light leading-relaxed rounded-2xl px-5 py-4 outline-none text-black placeholder:text-neutral-300 resize-none"
                      placeholder="A luxury engineered piece..."
                      required
                    />
                  </div>

                  {/* Tag Toggles */}
                  <div className="bg-[#fbfbfd] border border-black/[0.04] rounded-3xl p-5 space-y-1">
                    <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5 mb-4">
                      <Tags size={12} strokeWidth={1.5} /> Promotional Tags
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Switch
                        checked={cmsIsNew}
                        onChange={() => setCmsIsNew(!cmsIsNew)}
                        label="New Arrival"
                      />
                      <Switch
                        checked={cmsIsBestseller}
                        onChange={() => setCmsIsBestseller(!cmsIsBestseller)}
                        label="Best Seller"
                      />
                      <Switch
                        checked={cmsIsTrending}
                        onChange={() => setCmsIsTrending(!cmsIsTrending)}
                        label="Trending"
                      />
                    </div>
                  </div>

                  {/* CONDITIONAL ASSET SELECTORS */}
                  {cmsType === 'photo' ? (
                    <div>
                      <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-3 block">
                        Campaign Imagery (Multiple Allowed)
                      </Label>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => e.target.files && setCmsFiles(Array.from(e.target.files))}
                        className="block w-full text-xs text-neutral-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-medium file:bg-black file:text-white hover:file:bg-neutral-800 transition-all outline-none"
                        required
                      />
                      {cmsFiles.length > 0 && (
                        <p className="text-[10px] text-green-600 font-medium mt-3 pl-1 uppercase tracking-widest">
                          {cmsFiles.length} file(s) ready.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-3 block">
                        Select 3D Origin Design
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-64 overflow-y-auto pr-2 hide-scrollbar">
                        {adminDesigns.map((design) => (
                          <button
                            key={design.id}
                            type="button"
                            onClick={() => setCmsSelectedDesignId(design.id)}
                            className={`relative aspect-[4/5] rounded-2xl overflow-hidden border-2 cursor-pointer transition-all outline-none ${cmsSelectedDesignId === design.id ? 'border-black shadow-md' : 'border-transparent opacity-60 hover:opacity-100 bg-[#f8f8f8]'}`}
                          >
                            <div className="absolute inset-0 pointer-events-none p-4">
                              <Mini3DViewer
                                canvasState={design.canvas_state as Record<string, unknown>[]}
                                tshirtColor={design.tshirt_color}
                                fallbackImage={design.thumbnail_url}
                                apparelModel={
                                  (design as { apparel_model?: string }).apparel_model ||
                                  'tshirtman'
                                }
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                      {adminDesigns.length === 0 && (
                        <p className="text-[10px] text-red-500 uppercase tracking-widest font-medium mt-2">
                          No studio designs found in your account.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPublishing}
                    className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-2xl font-medium text-[11px] uppercase tracking-[0.2em] flex items-center justify-center transition-all shadow-md mt-8 outline-none"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 size={16} strokeWidth={1.5} className="animate-spin mr-3" />{' '}
                        Publishing Listing...
                      </>
                    ) : (
                      'Publish to Storefront'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MANAGE CATALOG */}
        {activeTab === 'catalog' && canCatalog && (
          <div className="animate-in fade-in duration-500">
            {/* CATALOG SEARCH & FILTER HEADER */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
                {dynamicCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogActiveCategory(cat)}
                    className={`text-[10px] uppercase tracking-[0.15em] px-4 py-2 rounded-full whitespace-nowrap outline-none transition-colors border ${
                      catalogActiveCategory === cat
                        ? 'font-medium bg-black text-white border-black'
                        : 'font-medium text-neutral-500 bg-white border-black/5 hover:border-black/20 hover:text-black'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 bg-white border border-black/5 px-4 py-2.5 rounded-full w-full sm:w-64 focus-within:border-black/20 transition-all duration-300 shadow-sm">
                <Search size={14} strokeWidth={1.5} className="text-neutral-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search catalog..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-[10px] uppercase tracking-[0.15em] outline-none w-full text-black placeholder:text-neutral-400 font-medium"
                />
              </div>
            </div>

            {isCatalogLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-neutral-300" size={32} />
              </div>
            ) : filteredCatalogItems.length === 0 ? (
              <div className="text-center py-20 text-neutral-400 font-medium text-sm tracking-wide">
                No items found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCatalogItems.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white border border-black/[0.04] rounded-[2rem] p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all ${!item.is_active ? 'opacity-60 grayscale-[50%]' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className="w-20 h-20 bg-[#f8f8f8] rounded-2xl overflow-hidden shrink-0 relative flex items-center justify-center cursor-pointer transition-colors hover:bg-[#f0f0f0] outline-none text-left"
                        onClick={() => handleOpenEditModal(item)}
                      >
                        {item.canvas_state ? (
                          <div className="absolute inset-0 p-2 pointer-events-none mix-blend-multiply">
                            <Mini3DViewer
                              canvasState={item.canvas_state}
                              tshirtColor={item.tshirt_color || '#ffffff'}
                              fallbackImage={item.thumbnail_url}
                              apparelModel={item.apparel_model || 'tshirtman'}
                            />
                          </div>
                        ) : item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.name}
                            className="w-full h-full object-cover mix-blend-multiply"
                          />
                        ) : (
                          <Box className="w-full h-full p-6 text-neutral-300" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left outline-none"
                        onClick={() => handleOpenEditModal(item)}
                      >
                        <h3 className="font-medium text-sm tracking-tight truncate text-black hover:underline underline-offset-2">
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1 mb-2 truncate">
                          {item.collection}
                        </p>
                        <div className="flex gap-2 items-center">
                          <span className="text-[11px] font-mono font-medium bg-[#fbfbfd] px-2 py-0.5 rounded-md border border-black/[0.04]">
                            ₹{item.price}
                          </span>
                          {item.discount_percentage > 0 && (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                              -{item.discount_percentage}%
                            </span>
                          )}
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between border-t border-black/5 pt-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {item.is_new && (
                          <span className="text-[8px] uppercase tracking-widest font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">
                            New
                          </span>
                        )}
                        {item.is_bestseller && (
                          <span className="text-[8px] uppercase tracking-widest font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded">
                            Best
                          </span>
                        )}
                        {item.is_trending && (
                          <span className="text-[8px] uppercase tracking-widest font-bold bg-purple-50 text-purple-600 px-2 py-1 rounded">
                            Trend
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="w-8 h-8 rounded-full bg-[#fbfbfd] hover:bg-neutral-100 text-neutral-600 flex items-center justify-center transition-colors outline-none border border-black/5"
                          title="Edit Item"
                        >
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(item.id, item.is_active)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors outline-none ${item.is_active ? 'bg-[#fbfbfd] hover:bg-neutral-100 text-neutral-600 border border-black/5' : 'bg-black text-white hover:bg-neutral-800'}`}
                          title={item.is_active ? 'Hide from Store' : 'Show in Store'}
                        >
                          {item.is_active ? (
                            <Eye size={14} strokeWidth={1.5} />
                          ) : (
                            <EyeOff size={14} strokeWidth={1.5} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCatalogItem(item.id)}
                          className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors outline-none"
                          title="Delete Item"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SUPPORT DESK */}
        {activeTab === 'support' && canSupport && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row h-[700px] border border-black/5 rounded-[2rem] overflow-hidden bg-white shadow-sm">
              {/* Left Column: Inbox List */}
              <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-black/5 bg-[#fbfbfd] flex flex-col h-[300px] lg:h-full">
                <div className="p-5 border-b border-black/5 flex items-center justify-between bg-white shrink-0">
                  <h3 className="text-sm font-semibold text-black tracking-tight flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-500" /> Support Inbox
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5 rounded-full">
                    {tickets.filter((t) => t.status === 'open').length} Open
                  </span>
                </div>

                <div className="overflow-y-auto flex-1 hide-scrollbar">
                  {tickets.length === 0 ? (
                    <div className="p-8 text-center text-neutral-400 text-xs font-medium uppercase tracking-widest mt-10">
                      Inbox is completely empty.
                    </div>
                  ) : (
                    tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={`w-full text-left p-5 border-b border-black/[0.03] transition-colors outline-none cursor-pointer ${
                          selectedTicketId === ticket.id
                            ? 'bg-blue-50/50 border-l-4 border-l-blue-500'
                            : 'hover:bg-white border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                              ticket.status === 'open'
                                ? 'text-red-500'
                                : ticket.status === 'in_progress'
                                  ? 'text-amber-500'
                                  : 'text-green-500'
                            }`}
                          >
                            {ticket.status.replace('_', ' ')}
                          </span>
                          <span className="text-[9px] text-neutral-400 uppercase tracking-widest font-mono">
                            {formatDate(ticket.updated_at).split(',')[0]}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-black truncate mb-1 pr-4">
                          {ticket.subject}
                        </h4>
                        <p className="text-xs text-neutral-500 truncate">
                          {ticket.category}
                          {ticket.order_id && (
                            <span className="ml-2 px-1.5 py-0.5 bg-black/5 rounded-md font-mono text-[9px] text-black">
                              #{ticket.order_id.split('-')[0]}
                            </span>
                          )}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Active Thread & Context */}
              <div className="w-full lg:w-2/3 flex flex-col bg-white h-[400px] lg:h-full">
                {selectedTicket ? (
                  <>
                    {/* Thread Header */}
                    <div className="p-5 border-b border-black/5 flex items-center justify-between shrink-0 bg-white">
                      <div>
                        <h3 className="font-medium text-black text-lg tracking-tight mb-1">
                          {selectedTicket.subject}
                        </h3>
                        <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                          Ticket ID: {selectedTicket.id.split('-')[0]}
                        </p>
                      </div>
                      {selectedTicket.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => resolveTicket(selectedTicket.id)}
                          className="flex items-center gap-2 h-9 px-4 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors text-[10px] uppercase tracking-[0.15em] font-bold outline-none"
                        >
                          <CheckCircle2 size={14} strokeWidth={2} /> Resolve Issue
                        </button>
                      )}
                    </div>

                    {/* Order Context Bar (If Linked) */}
                    {selectedTicket.order_id && (
                      <div className="bg-[#fbfbfd] px-5 py-3 border-b border-black/5 flex items-center gap-3 shrink-0">
                        <Package size={14} className="text-neutral-400" />
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">
                          Regarding Order:{' '}
                          <strong className="text-black font-mono ml-1">
                            #{selectedTicket.order_id.split('-')[0]}
                          </strong>
                        </span>
                      </div>
                    )}

                    {/* Chat History */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-4 bg-white hide-scrollbar">
                      {selectedTicket.messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col w-full max-w-[85%] ${msg.is_admin_reply ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                        >
                          <div
                            className={`p-4 rounded-[1.25rem] text-sm leading-relaxed ${
                              msg.is_admin_reply
                                ? 'bg-black text-white rounded-tr-sm shadow-sm'
                                : 'bg-[#fbfbfd] border border-black/[0.04] text-black rounded-tl-sm shadow-sm'
                            }`}
                          >
                            {msg.message}
                          </div>
                          <span className="text-[9px] text-neutral-400 font-medium uppercase tracking-[0.15em] mt-2 px-1">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Reply Input */}
                    <div className="p-4 sm:p-5 bg-white border-t border-black/5 shrink-0">
                      <form onSubmit={handleReplyToTicket} className="relative flex items-center">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your official reply..."
                          disabled={selectedTicket.status === 'resolved'}
                          className="w-full h-12 pl-5 pr-14 bg-[#fbfbfd] border border-black/5 rounded-full text-sm outline-none focus:border-black/20 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          type="submit"
                          disabled={selectedTicket.status === 'resolved' || !replyText.trim()}
                          className="absolute right-1.5 w-9 h-9 flex items-center justify-center bg-black text-white rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 outline-none shadow-sm"
                        >
                          <Send size={14} strokeWidth={2} className="ml-0.5" />
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-300">
                    <MessageSquare size={48} strokeWidth={1} className="mb-4" />
                    <p className="text-[11px] uppercase tracking-[0.2em] font-medium">
                      Select a ticket to begin
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
