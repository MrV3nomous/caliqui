import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Package,
  Plus,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { env } from '@/shared/env';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { Input, Label } from '@/ui/design-system';
import { useAdminStore } from '@/ui/store/admin-store';

export function AdminDashboard() {
  const navigate = useNavigate();
  const {
    isAdmin,
    orders,
    adminDesigns,
    isLoading,
    verifyAdminAccess,
    fetchAdminData,
    fetchAdminDesigns,
    updateOrderStatus,
    downloadPrintFile,
    uploadMarketplaceAsset,
    createMarketplaceItem,
  } = useAdminStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');
  const [orderFilter, setOrderFilter] = useState<'all' | 'processing' | 'shipped' | 'delivered'>(
    'all',
  );

  // Dispatch State
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');

  // CMS State
  const [isCMSOpen, setIsCMSOpen] = useState(false);
  const [cmsType, setCmsType] = useState<'photo' | '3d'>('photo');
  const [cmsName, setCmsName] = useState('');
  const [cmsPrice, setCmsPrice] = useState('1499');
  const [cmsDesc, setCmsDesc] = useState('');
  const [cmsFiles, setCmsFiles] = useState<File[]>([]);
  const [cmsSelectedDesignId, setCmsSelectedDesignId] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const isAllowed = await verifyAdminAccess();
      if (isAllowed) {
        fetchAdminData();
        fetchAdminDesigns();
      } else if (isAllowed === false) {
        navigate('/');
      }
    };
    checkAccess();
  }, [verifyAdminAccess, fetchAdminData, fetchAdminDesigns, navigate]);

  const handleDispatchSubmit = async (orderId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!courier || !tracking) return alert('Please provide courier and tracking details.');
    await updateOrderStatus(orderId, 'shipped', courier, tracking);
    setDispatchingId(null);
    setCourier('');
    setTracking('');
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      if (cmsType === 'photo') {
        if (cmsFiles.length === 0) throw new Error('Upload at least one image.');
        const uploadedUrls = await Promise.all(cmsFiles.map((f) => uploadMarketplaceAsset(f)));
        await createMarketplaceItem({
          name: cmsName,
          description: cmsDesc,
          price: Number(cmsPrice),
          thumbnail_url: uploadedUrls[0],
          gallery_urls: uploadedUrls,
          collection: 'core',
          available_sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        });
      } else {
        if (!cmsSelectedDesignId) throw new Error('Select a 3D design.');
        const design = adminDesigns.find((d) => d.id === cmsSelectedDesignId);
        if (!design) throw new Error('Design not found.');

        await createMarketplaceItem({
          name: cmsName,
          description: cmsDesc,
          price: Number(cmsPrice),
          thumbnail_url: design.thumbnail_url,
          canvas_state: design.canvas_state,
          tshirt_color: design.tshirt_color,
          apparel_model: design.apparel_model || 'tshirtman',
          collection: 'core',
          available_sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        });
      }
      setIsCMSOpen(false);
      setCmsName('');
      setCmsDesc('');
      setCmsFiles([]);
      alert('Product successfully published to Marketplace!');
    } catch (err) {
      alert((err as Error).message || 'Failed to publish item.');
    } finally {
      setIsPublishing(false);
    }
  };

  const filteredOrders = orders.filter((o) => orderFilter === 'all' || o.status === orderFilter);
  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.total_amount, 0);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading || isAdmin === null) {
    return <PremiumLoader />;
  }

  if (!isAdmin) return null;

  return (
    <div className="w-full h-[100dvh] bg-[#fbfbfd] text-black font-sans flex flex-col overflow-y-auto overflow-x-hidden">
      <header className="h-16 w-full bg-white/80 backdrop-blur-2xl border-b border-black/5 flex items-center justify-between px-4 sm:px-8 z-50 sticky top-0 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:opacity-70 transition-opacity outline-none">
            <img
              src="/logo.png"
              alt={env.VITE_APP_NAME}
              className="h-6 w-auto object-contain drop-shadow-sm"
            />
          </Link>
          <div className="w-px h-4 bg-black/10 mx-2" />
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-red-500">
            Admin Command
          </span>
        </div>

        <Link
          to="/dashboard"
          className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors outline-none flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Exit Admin
        </Link>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-8 py-8 lg:py-12 pb-24">
        {/* KPI DASHBOARD */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white border border-black/5 rounded-[1.5rem] p-5 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 mb-2">
              Total Revenue
            </p>
            <p className="text-2xl font-black text-black">₹{totalRevenue}</p>
          </div>
          <div className="bg-white border border-black/5 rounded-[1.5rem] p-5 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 mb-2">
              Total Orders
            </p>
            <p className="text-2xl font-black text-black">{orders.length}</p>
          </div>
          <div className="bg-white border border-black/5 rounded-[1.5rem] p-5 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 mb-2">
              Pending
            </p>
            <p className="text-2xl font-black text-amber-600">
              {orders.filter((o) => o.status === 'processing').length}
            </p>
          </div>
          <div className="bg-white border border-black/5 rounded-[1.5rem] p-5 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-green-500 mb-2">
              Delivered
            </p>
            <p className="text-2xl font-black text-green-600">
              {orders.filter((o) => o.status === 'delivered').length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 border-b border-black/10 mb-8 overflow-x-auto hide-scrollbar">
          {[
            { id: 'orders', label: 'Fulfillment Pipeline', icon: <Package size={16} /> },
            { id: 'inventory', label: 'Marketplace CMS', icon: <Box size={16} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'orders' | 'inventory')}
              className={`flex items-center gap-2 pb-4 text-xs font-extrabold uppercase tracking-widest transition-all whitespace-nowrap outline-none border-b-2 shrink-0 ${
                activeTab === tab.id
                  ? 'text-black border-black'
                  : 'text-neutral-400 border-transparent hover:text-neutral-600'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in">
            {/* ORDER FILTERS */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {['all', 'processing', 'shipped', 'delivered'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setOrderFilter(f as 'all' | 'processing' | 'shipped' | 'delivered')
                  }
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border transition-all shrink-0 outline-none ${orderFilter === f ? 'bg-black text-white border-black' : 'bg-white text-neutral-500 border-black/10 hover:border-black/30'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-black/5 rounded-[2rem] p-6 shadow-sm flex flex-col lg:flex-row gap-6 lg:items-start justify-between hover:shadow-md transition-shadow"
                >
                  {/* Order Details */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-full ${
                          order.status === 'processing'
                            ? 'bg-amber-100 text-amber-700'
                            : order.status === 'shipped'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="text-xs font-bold text-neutral-400 font-mono">
                        ID: {order.id.slice(0, 8)}
                      </span>
                      <span className="text-xs font-semibold text-neutral-400">
                        {formatDate(order.created_at)}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold">{order.customer_name}</h3>
                      <p className="text-sm font-medium text-neutral-500 mt-1">
                        {order.shipping_snapshot?.address}
                      </p>
                      <p className="text-xs font-semibold text-neutral-400 mt-1">
                        Phone: {order.shipping_snapshot?.phone}
                      </p>
                    </div>

                    <div className="bg-neutral-50 rounded-2xl p-4 border border-black/5">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 mb-3">
                        Order Items
                      </h4>
                      <div className="space-y-2">
                        {order.cart?.map((item, idx) => (
                          <div
                            key={item.cartId || idx}
                            className="flex justify-between items-center text-sm"
                          >
                            <span className="font-bold">
                              {item.name}{' '}
                              <span className="text-neutral-400 font-medium">({item.type})</span>
                            </span>
                            <span className="font-semibold bg-white px-2 py-1 rounded-lg border border-black/5">
                              {Object.entries(item.sizes)
                                .filter(([_, q]) => q > 0)
                                .map(([s, q]) => `${s}: ${q}`)
                                .join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Dispatch */}
                  <div className="w-full lg:w-80 shrink-0 space-y-4 flex flex-col justify-start border-t lg:border-t-0 lg:border-l border-black/5 pt-6 lg:pt-0 lg:pl-6">
                    <div className="flex justify-between items-center bg-black/5 p-4 rounded-2xl">
                      <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">
                        Revenue
                      </span>
                      <span className="text-xl font-black">₹{order.total_amount}</span>
                    </div>

                    {order.print_file_path && (
                      <button
                        type="button"
                        onClick={() =>
                          order.print_file_path && downloadPrintFile(order.print_file_path)
                        }
                        className="w-full flex items-center justify-center gap-2 h-12 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold text-xs transition-colors outline-none"
                      >
                        <Download size={14} /> Download Print File (.png)
                      </button>
                    )}

                    {order.status === 'processing' && dispatchingId !== order.id && (
                      <button
                        type="button"
                        onClick={() => setDispatchingId(order.id)}
                        className="w-full flex items-center justify-center gap-2 h-12 bg-black hover:bg-neutral-800 text-white rounded-xl font-bold text-xs transition-colors shadow-md outline-none"
                      >
                        <Truck size={14} /> Mark as Shipped
                      </button>
                    )}

                    {dispatchingId === order.id && (
                      <form
                        onSubmit={(e) => handleDispatchSubmit(order.id, e)}
                        className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-black/5 animate-in fade-in"
                      >
                        <div>
                          <Label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest">
                            Courier Partner
                          </Label>
                          <Input
                            value={courier}
                            onChange={(e) => setCourier(e.target.value)}
                            placeholder="e.g. BlueDart"
                            className="h-10 mt-1 text-xs"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest">
                            Tracking Number
                          </Label>
                          <Input
                            value={tracking}
                            onChange={(e) => setTracking(e.target.value)}
                            placeholder="Tracking ID"
                            className="h-10 mt-1 text-xs"
                            required
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setDispatchingId(null)}
                            className="flex-1 h-10 rounded-xl text-xs font-bold text-neutral-500 hover:bg-neutral-200 transition-colors outline-none"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 h-10 rounded-xl text-xs font-bold bg-black text-white hover:bg-neutral-800 transition-colors outline-none"
                          >
                            Confirm Dispatch
                          </button>
                        </div>
                      </form>
                    )}

                    {order.status === 'shipped' && (
                      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 space-y-1">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 mb-2">
                          Tracking Info
                        </p>
                        <p className="text-xs font-bold text-blue-900">{order.courier_name}</p>
                        <p className="text-xs font-mono text-blue-800">{order.tracking_number}</p>
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                          className="w-full mt-3 flex items-center justify-center gap-2 h-10 bg-white hover:bg-neutral-50 border border-black/5 text-black rounded-xl font-bold text-xs transition-colors shadow-sm outline-none"
                        >
                          <CheckCircle2 size={14} /> Mark Delivered
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filteredOrders.length === 0 && (
                <div className="text-center py-20 text-neutral-400 font-bold text-sm">
                  No orders found in this status.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="animate-in fade-in">
            {!isCMSOpen ? (
              <div className="bg-white border border-black/5 rounded-[2rem] p-8 md:p-12 text-center shadow-sm flex flex-col items-center">
                <Box size={40} className="text-neutral-300 mb-6" />
                <h2 className="text-xl font-extrabold mb-2">Marketplace Operations</h2>
                <p className="text-neutral-500 font-medium mb-8 max-w-md">
                  Publish new high-end photography products or convert 3D Studio concepts into
                  standard Marketplace Collection pieces.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCMSOpen(true)}
                  className="inline-flex items-center gap-2 h-14 px-8 bg-black hover:bg-neutral-800 text-white rounded-full font-extrabold text-sm transition-transform active:scale-95 shadow-lg outline-none"
                >
                  <Plus size={16} /> Create New Collection Item
                </button>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto bg-white border border-black/5 rounded-[2.5rem] p-6 sm:p-10 shadow-xl">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-extrabold">Product Details</h2>
                  <button
                    type="button"
                    onClick={() => setIsCMSOpen(false)}
                    className="text-neutral-400 hover:text-black outline-none"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handlePublish} className="space-y-6">
                  {/* TYPE TOGGLE */}
                  <div className="flex gap-2 p-1.5 bg-neutral-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setCmsType('photo')}
                      className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold transition-all outline-none ${cmsType === 'photo' ? 'bg-white shadow-sm text-black' : 'text-neutral-500 hover:text-black'}`}
                    >
                      <ImageIcon size={14} /> Photography
                    </button>
                    <button
                      type="button"
                      onClick={() => setCmsType('3d')}
                      className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold transition-all outline-none ${cmsType === '3d' ? 'bg-white shadow-sm text-black' : 'text-neutral-500 hover:text-black'}`}
                    >
                      <Layers size={14} /> 3D Studio Design
                    </button>
                  </div>

                  {/* COMMON FIELDS */}
                  <div>
                    <Label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1">
                      Product Name
                    </Label>
                    <Input
                      value={cmsName}
                      onChange={(e) => setCmsName(e.target.value)}
                      placeholder="e.g. Minimalist Core Tee"
                      className="bg-neutral-50 h-12 rounded-xl mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1">
                      Price (₹)
                    </Label>
                    <Input
                      type="number"
                      value={cmsPrice}
                      onChange={(e) => setCmsPrice(e.target.value)}
                      className="bg-neutral-50 h-12 rounded-xl mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1">
                      Editorial Description
                    </Label>
                    <textarea
                      value={cmsDesc}
                      onChange={(e) => setCmsDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-neutral-50 border border-transparent focus:bg-white focus:ring-2 focus:ring-black/10 transition-all text-sm font-semibold rounded-xl px-4 py-3 outline-none text-black placeholder:text-neutral-400 mt-1 resize-none"
                      placeholder="A luxury engineered piece..."
                      required
                    />
                  </div>

                  {/* CONDITIONAL ASSET SELECTORS */}
                  {cmsType === 'photo' ? (
                    <div>
                      <Label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1 mb-2 block">
                        Campaign Imagery (Multiple Allowed)
                      </Label>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => e.target.files && setCmsFiles(Array.from(e.target.files))}
                        className="block w-full text-sm text-neutral-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-neutral-100 file:text-black hover:file:bg-neutral-200 transition-all"
                        required
                      />
                      {cmsFiles.length > 0 && (
                        <p className="text-xs text-neutral-500 font-medium mt-3 pl-1">
                          {cmsFiles.length} file(s) selected.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1 mb-2 block">
                        Select 3D Origin Design
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                        {adminDesigns.map((design) => (
                          <button
                            key={design.id}
                            type="button"
                            onClick={() => setCmsSelectedDesignId(design.id)}
                            className={`relative aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer transition-all outline-none ${cmsSelectedDesignId === design.id ? 'border-black' : 'border-transparent opacity-60 hover:opacity-100 bg-neutral-100'}`}
                          >
                            {/* Disabled pointer events on the 3D Viewer wrapper so clicks trigger the parent button instead of 3D panning */}
                            <div className="absolute inset-0 pointer-events-none">
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
                        <p className="text-xs text-red-500 font-bold mt-2">
                          No studio designs found in your account.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPublishing}
                    className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl font-extrabold flex items-center justify-center transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] mt-6 outline-none"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" /> Publishing Collection...
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
      </main>
    </div>
  );
}
