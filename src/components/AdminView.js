import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { StatusBadge, statusStyle, statusPaletteKey } from '../utils/statusColors';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import AdminHomepageEditor from './AdminHomepageEditor';
import GroupBuyAdmin, { UnifiedGBOrderCard } from '../pages/GroupBuyAdmin';

const VALID_TABS = ['products', 'group-buys', 'orders', 'stats', 'homepage'];

async function uploadOptionImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const data = await apiFetch('/upload/single', { method: 'POST', body: fd });
  return data.url;
}

export default function AdminView({ products, fetchData, loading }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = VALID_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'products';
  const [tab, setTabState] = useState(initialTab);
  const setTab = (t) => {
    setTabState(t);
    setSearchParams(t === 'products' ? {} : { tab: t }, { replace: true });
  };
  const [showCreate, setShowCreate] = useState(false);
  const [orders, setOrders] = useState([]);
  const [gbOrders, setGbOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [expandedProductPanel, setExpandedProductPanel] = useState(null);

  // Group Buys toolbar state — lifted so it renders in the admin-actions slot
  const [gbSearchQuery, setGbSearchQuery] = useState('');
  const [gbSortBy, setGbSortBy] = useState('newest');
  const [gbShowArchived, setGbShowArchived] = useState(false);
  const [gbShowCreate, setGbShowCreate] = useState(false);

  const fetchOrders = () => {
    setOrdersLoading(true);
    Promise.all([
      apiFetch('/orders/all-orders').then(d => d.orders || []).catch(err => {
        console.error('In-stock orders fetch failed:', err);
        toast.error('Failed to load in-stock orders: ' + (err.message || 'unknown'));
        return [];
      }),
      apiFetch('/group-buys/all-orders').then(d => d.orders || []).catch(err => {
        console.error('Group-buy orders fetch failed:', err);
        toast.error('Failed to load group-buy orders: ' + (err.message || 'unknown'));
        return [];
      }),
    ])
      .then(([inStock, gb]) => { setOrders(inStock); setGbOrders(gb); })
      .finally(() => { setOrdersLoading(false); setOrdersLoaded(true); });
  };
  const updateOrderLocal = (id, patch) => setOrders(prev => prev.map(o => o._id === id ? { ...o, ...patch } : o));
  const updateGbOrderLocal = (id, patch) => setGbOrders(prev => prev.map(o => o._id === id ? { ...o, ...patch } : o));

  useEffect(() => {
    if ((tab === 'orders' || tab === 'stats') && !ordersLoaded) fetchOrders();
  }, [tab, ordersLoaded]);

  // Top-level products only — add-ons live inside their parent's "Add-ons" panel.
  const topLevelProducts = products.filter(p => !p.parentProductId);
  const activeCount = topLevelProducts.filter(p => p.isActive).length;
  const archivedCount = topLevelProducts.filter(p => !p.isActive).length;

  const filtered = (() => {
    let list = showArchived ? topLevelProducts : topLevelProducts.filter(p => p.isActive);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    const priceOf = p => p.price ?? p.basePrice ?? 0;
    const sorted = [...list];
    switch (sortBy) {
      case 'oldest': sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)); break;
      case 'name-asc': sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'name-desc': sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
      case 'price-asc': sorted.sort((a, b) => priceOf(a) - priceOf(b)); break;
      case 'price-desc': sorted.sort((a, b) => priceOf(b) - priceOf(a)); break;
      case 'newest':
      default: sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return sorted;
  })();

  if (loading && tab === 'products') return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="admin-dashboard-header" style={{ marginBottom: '36px' }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.4rem', letterSpacing: '-0.025em', marginBottom: '8px' }}>Dashboard</h1>
        <p className="admin-dashboard-subtitle" style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>Manage your products, images, and orders.</p>
      </div>

      <div className="admin-stats">
        <div className="admin-stat"><span className="admin-stat-n">{topLevelProducts.length}</span><span className="admin-stat-l">Total Products</span></div>
        <div className="admin-stat"><span className="admin-stat-n">{activeCount}</span><span className="admin-stat-l">Active</span></div>
        <div className="admin-stat"><span className="admin-stat-n">{archivedCount}</span><span className="admin-stat-l">Archived</span></div>
        <div className="admin-stat"><span className="admin-stat-n">{orders.length || '—'}</span><span className="admin-stat-l">Orders</span></div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>In Stock</button>
          <button className={`admin-tab ${tab === 'group-buys' ? 'active' : ''}`} onClick={() => setTab('group-buys')}>Group Buys</button>
          <button className={`admin-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>Orders</button>
          <button className={`admin-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Stats</button>
          <button className={`admin-tab ${tab === 'homepage' ? 'active' : ''}`} onClick={() => setTab('homepage')}>Homepage</button>
        </div>
        {tab === 'products' && (
          <div className="admin-actions">
            <div className="admin-search">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products..."
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="Clear">×</button>}
            </div>
            <select className="admin-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="price-desc">Price: high to low</option>
              <option value="price-asc">Price: low to high</option>
            </select>
            <button className="admin-toggle" onClick={() => setShowArchived(!showArchived)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                {showArchived ? (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>) : (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>)}
              </svg>
              <span>{showArchived ? 'Hide' : 'Show'} Archived</span>
            </button>
            <button className="btn-dark" onClick={() => setShowCreate(true)} style={{ padding: '10px 24px' }}><span>+ New Product</span></button>
          </div>
        )}
        {tab === 'group-buys' && (
          <div className="admin-actions">
            <div className="admin-search">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={gbSearchQuery}
                onChange={e => setGbSearchQuery(e.target.value)}
                placeholder="Search group buys..."
              />
              {gbSearchQuery && <button onClick={() => setGbSearchQuery('')} aria-label="Clear">×</button>}
            </div>
            <select className="admin-sort" value={gbSortBy} onChange={e => setGbSortBy(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="orders-desc">Most orders</option>
              <option value="price-desc">Price: high to low</option>
              <option value="price-asc">Price: low to high</option>
              <option value="status">By status</option>
            </select>
            <button className="admin-toggle" onClick={() => setGbShowArchived(!gbShowArchived)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                {gbShowArchived ? (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>) : (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>)}
              </svg>
              <span>{gbShowArchived ? 'Hide' : 'Show'} Archived</span>
            </button>
            <button className="btn-dark" onClick={() => setGbShowCreate(true)} style={{ padding: '10px 24px' }}><span>+ New Group Buy</span></button>
          </div>
        )}
      </div>

      {showCreate && <CreateProductModal onClose={() => setShowCreate(false)} onCreated={() => { fetchData(); setShowCreate(false); }} />}

      {tab === 'products' && (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', marginBottom: '20px' }}>
            Showing {filtered.length} of {topLevelProducts.length} product{topLevelProducts.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
            {!showArchived && archivedCount > 0 && ` (${archivedCount} archived hidden)`}
          </p>
          <div className="admin-grid">
            {filtered.map(p => (
              <ProductCard
                key={p._id}
                product={p}
                allProducts={products}
                fetchData={fetchData}
                orders={orders}
                ordersLoading={ordersLoading}
                ordersLoaded={ordersLoaded}
                fetchOrders={fetchOrders}
                updateOrderLocal={updateOrderLocal}
                panel={expandedProductId === p._id ? expandedProductPanel : null}
                onTogglePanel={(pn) => {
                  if (pn === null || (expandedProductId === p._id && expandedProductPanel === pn)) {
                    setExpandedProductId(null); setExpandedProductPanel(null);
                  } else {
                    setExpandedProductId(p._id); setExpandedProductPanel(pn);
                    if ((pn === 'orders' || pn === 'addons') && !ordersLoaded) fetchOrders();
                  }
                }}
              />
            ))}
            {filtered.length === 0 && <p style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-muted)' }}>No products to show.</p>}
          </div>
        </>
      )}

      {tab === 'group-buys' && (
        <GroupBuyAdmin
          embedded
          searchQuery={gbSearchQuery}
          sortBy={gbSortBy}
          showArchived={gbShowArchived}
          showCreate={gbShowCreate}
          setShowCreate={setGbShowCreate}
        />
      )}

      {tab === 'orders' && <OrdersPanel orders={orders} gbOrders={gbOrders} loading={ordersLoading} fetchOrders={fetchOrders} updateOrderLocal={updateOrderLocal} updateGbOrderLocal={updateGbOrderLocal} />}

      {tab === 'stats' && <StatsPanel orders={orders} loading={ordersLoading} />}

      {tab === 'homepage' && <AdminHomepageEditor />}

      <style>{`
        .admin-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 28px; }
        .admin-stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 20px; text-align: center; }
        .admin-stat-n { display: block; font-family: 'DM Serif Display', serif; font-size: 1.6rem; margin-bottom: 4px; }
        .admin-stat-l { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
        .admin-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 0; }
        .admin-tabs { display: flex; gap: 0; }
        .admin-tab { padding: 12px 24px; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 400; color: var(--ink-muted); background: none; border: none; cursor: pointer; border-bottom: 2px solid transparent; transition: all var(--transition); margin-bottom: -1px; }
        .admin-tab:hover { color: var(--ink); }
        .admin-tab.active { color: var(--ink); font-weight: 500; border-bottom-color: var(--accent); }
        .admin-actions { display: flex; align-items: center; gap: 8px; padding-bottom: 12px; flex-wrap: wrap; }
        .admin-toggle { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); font-family: 'DM Sans', sans-serif; font-size: 0.78rem; color: var(--ink-muted); cursor: pointer; transition: all var(--transition); }
        .admin-toggle:hover { border-color: var(--ink-muted); color: var(--ink); }
        .admin-search { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); color: var(--ink-muted); transition: all var(--transition); min-width: 220px; }
        .admin-search:focus-within { border-color: var(--ink-muted); color: var(--ink); }
        .admin-search input { flex: 1; border: none; outline: none; background: none; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; color: var(--ink); min-width: 0; }
        .admin-search input::placeholder { color: var(--ink-faint); }
        .admin-search button { background: none; border: none; cursor: pointer; color: var(--ink-faint); font-size: 1rem; line-height: 1; padding: 0 2px; }
        .admin-search button:hover { color: var(--ink); }
        .admin-sort { padding: 8px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); font-family: 'DM Sans', sans-serif; font-size: 0.78rem; color: var(--ink-muted); cursor: pointer; transition: all var(--transition); }
        .admin-sort:hover { border-color: var(--ink-muted); color: var(--ink); }
        .admin-grid { display: flex; flex-direction: column; gap: 16px; }
        .admin-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: box-shadow 0.2s, border-color 0.2s, opacity 0.2s; box-shadow: var(--shadow-card); }
        .admin-card.expanded { border-color: var(--accent); box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 0 0 3px var(--accent-light); }
        .admin-card-img { aspect-ratio: 16/10; background: var(--accent-light); position: relative; overflow: hidden; }
        .admin-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .admin-card-body { padding: 18px 20px; }
        .admin-card-name { font-family: 'DM Serif Display', serif; font-size: 1.05rem; margin-bottom: 4px; }
        .admin-card-meta { font-size: 0.78rem; color: var(--ink-muted); margin-bottom: 12px; }
        .admin-card-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .admin-card-price { font-size: 1rem; font-weight: 600; }
        .admin-card-stock { font-size: 0.78rem; color: var(--ink-muted); }
        .admin-card-actions { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 20px; border-top: 1px solid var(--border-subtle); }
        .admin-card-btn { padding: 6px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: none; font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all var(--transition); color: var(--ink-muted); }
        .admin-card-btn:hover { border-color: var(--ink-muted); color: var(--ink); background: var(--bg-secondary); }
        .admin-card-btn.danger { color: #c0392b; border-color: rgba(192,57,43,0.2); }
        .admin-card-btn.danger:hover { background: rgba(192,57,43,0.06); border-color: #c0392b; }
        .admin-card-btn.success { color: var(--accent); border-color: rgba(46,93,75,0.2); }
        .admin-card-btn.success:hover { background: var(--accent-light); border-color: var(--accent); }
        .admin-badge { display: inline-block; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; position: absolute; top: 10px; right: 10px; }
        .admin-badge.active { background: var(--accent-light); color: var(--accent); }
        .admin-badge.archived { background: #f8d7da; color: #721c24; }
        .admin-card.is-archived { opacity: 0.65; }
        .admin-card.is-archived:hover { opacity: 1; }
        .opt-val-row { display: grid; grid-template-columns: 1fr 70px 1fr auto; gap: 5px; align-items: center; margin-bottom: 5px; }
        .opt-val-row-compact { display: grid; grid-template-columns: 1fr 60px 1fr 26px; gap: 4px; align-items: center; margin-bottom: 4px; }
        .cfg-opt-row { display: grid; grid-template-columns: 1fr 60px 1fr 26px; gap: 4px; align-items: center; margin-bottom: 4px; }
        @media (max-width: 768px) {
          .admin-stats { grid-template-columns: repeat(2, 1fr); }
          .admin-toolbar { flex-direction: column; align-items: stretch; }
          .admin-actions { justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   SHARED CARD HELPERS
═══════════════════════════════════════════════ */
function Pill({ children, onClick, active }) {
  return <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: active ? 'var(--accent)' : 'none', color: active ? '#fff' : 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: 'var(--transition)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{children}</button>;
}

function Caret({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PanelHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      {onClose && (
        <button onClick={onClose} aria-label="Close" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
          ✕ Close
        </button>
      )}
      <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{title}</span>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PRODUCT CARD (Admin Grid View)
═══════════════════════════════════════════════ */
function ProductCard({ product, fetchData, panel, onTogglePanel, allProducts = [], orders = [], ordersLoading = false, ordersLoaded = true, fetchOrders, updateOrderLocal }) {
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [editMenuPos, setEditMenuPos] = useState({ top: 0, left: 0 });
  const [hoveredMenuKey, setHoveredMenuKey] = useState(null);
  const editMenuRef = useRef(null);
  const editBtnRef = useRef(null);

  const togglePanel = (p) => { setEditMenuOpen(false); onTogglePanel(p); };
  const closePanel = () => onTogglePanel(null);
  const toggleEditMenu = () => {
    if (!editMenuOpen && editBtnRef.current) {
      const r = editBtnRef.current.getBoundingClientRect();
      setEditMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setEditMenuOpen(o => !o);
  };

  useEffect(() => {
    if (!editMenuOpen) return;
    const onDocClick = (e) => {
      if (editMenuRef.current && !editMenuRef.current.contains(e.target) &&
          editBtnRef.current && !editBtnRef.current.contains(e.target)) setEditMenuOpen(false);
    };
    const onScroll = () => setEditMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [editMenuOpen]);

  const toggleActive = async () => {
    const action = product.isActive ? 'archive' : 'activate';
    try {
      await apiFetch(`/products/${product._id}/${action}`, { method: 'PATCH' });
      toast.success(product.isActive ? 'Product archived' : 'Product activated');
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const publish = async () => {
    try {
      await apiFetch(`/products/${product._id}/update`, { method: 'PATCH', body: JSON.stringify({ isQueued: false }) });
      toast.success('Published');
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const imgUrl = product.images?.[0]?.url;
  const hasOptions = (product.options?.length || 0) > 0;
  const useVariants = !!product.useVariants;
  const variantCount = product.variants?.length || 0;
  const displayPrice = hasOptions
    ? `From ₱${((product.price || 0) + Math.min(...product.options.flatMap(g => g.values.map(v => v.price || 0)))).toLocaleString()}`
    : `₱${product.price?.toLocaleString()}`;
  // Stock is unlimited if any tracked source returns -1/null, or there is no tracked source.
  const stockInfo = (() => {
    if (hasOptions) {
      const values = product.options.flatMap(g => g.values || []);
      let total = 0; let anyUnlimited = false;
      for (const v of values) { const n = v.stocks; if (n === -1 || n == null) anyUnlimited = true; else total += n; }
      return anyUnlimited ? { unlimited: true } : { total };
    }
    if (useVariants) {
      let total = 0; let anyUnlimited = false;
      for (const v of (product.variants || [])) { const n = v.stock; if (n === -1 || n == null) anyUnlimited = true; else total += n; }
      return anyUnlimited ? { unlimited: true } : { total };
    }
    if (product.stocks === -1 || product.stocks == null) return { unlimited: true };
    return { total: product.stocks };
  })();
  const totalStock = stockInfo.unlimited ? null : stockInfo.total;
  const stockText = useVariants
    ? `${variantCount} variant${variantCount === 1 ? '' : 's'}`
    : (stockInfo.unlimited ? 'Unlimited stock' : `${totalStock} in stock`);

  const editKeys = ['details', 'images', 'options', 'variants-config'];
  const isOpen = !!panel;
  const exportCSV = () => { toast('CSV export coming soon'); };

  return (
    <div style={{
      background: 'var(--surface)',
      border: isOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      boxShadow: isOpen ? '0 8px 24px rgba(0,0,0,0.12), 0 0 0 3px var(--accent-light)' : 'var(--shadow-card)',
      opacity: product.isActive ? 1 : 0.6,
      transition: 'box-shadow 0.2s, border-color 0.2s, opacity 0.2s'
    }}>
      <div className="admin-product-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', flexWrap: 'wrap' }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0 }}>
          {imgUrl ? (
            <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', serif", color: 'var(--accent)' }}>{product.name?.[0]}</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.08rem', margin: 0 }}>{product.name}</p>
            {useVariants && (
              <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '10px', background: 'rgba(120,80,200,0.1)', color: 'rgb(120,80,200)', whiteSpace: 'nowrap' }}>
                Variants
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', color: 'var(--ink-muted)', flexWrap: 'wrap' }}>
            <span>{displayPrice}</span><span>{stockText}</span>
            {!product.isActive && <span style={{ color: '#c0392b' }}>Archived</span>}
          </div>
        </div>
        <span className={`status-select ${product.isQueued ? 'status-purple' : (product.isActive ? 'status-green' : 'status-red')}`} style={{ cursor: 'default' }}>
          {product.isQueued ? 'Queued' : (product.isActive ? 'Active' : 'Archived')}
        </span>
        <div className="admin-product-actions" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <div ref={editBtnRef} style={{ display: 'inline-block' }}>
            <Pill onClick={toggleEditMenu} active={editMenuOpen || editKeys.includes(panel)}>
              Edit <Caret open={editMenuOpen} />
            </Pill>
          </div>
          {editMenuOpen && (
            <div ref={editMenuRef} style={{ position: 'fixed', top: editMenuPos.top, left: editMenuPos.left, zIndex: 1000, background: 'var(--surface)', border: '1px solid var(--ink-faint)', borderRadius: 'var(--radius-sm)', boxShadow: '0 14px 36px rgba(0,0,0,0.22), 0 3px 8px rgba(0,0,0,0.10)', minWidth: 180, overflow: 'hidden', padding: '4px' }}>
              <p style={{ margin: 0, padding: '4px 10px 6px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>Edit</p>
              {[
                { key: 'details', label: 'Details' },
                { key: 'images', label: 'Images' },
                { key: 'options', label: 'Options' },
                { key: 'variants-config', label: 'Variants / Config' },
              ].map(item => {
                const isActive = panel === item.key;
                const isHovered = hoveredMenuKey === item.key;
                const bg = isActive ? 'var(--accent)' : (isHovered ? 'var(--accent-light)' : 'transparent');
                const color = isActive ? '#fff' : (isHovered ? 'var(--accent)' : 'var(--ink)');
                return (
                  <button key={item.key} onClick={() => togglePanel(item.key)}
                    onMouseEnter={() => setHoveredMenuKey(item.key)}
                    onMouseLeave={() => setHoveredMenuKey(null)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: bg, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif", color, fontWeight: 500, borderRadius: '6px', transition: 'background 0.12s, color 0.12s' }}>
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
          <Pill onClick={() => togglePanel('orders')} active={panel === 'orders'}>
            Orders <Caret open={panel === 'orders'} />
          </Pill>
          <Pill onClick={() => togglePanel('addons')} active={panel === 'addons'}>
            Add-ons <Caret open={panel === 'addons'} />
          </Pill>
          <Pill onClick={exportCSV}>CSV</Pill>
          {product.isQueued && <Pill onClick={publish}>Publish</Pill>}
          <Pill onClick={toggleActive}>{product.isActive ? 'Archive' : 'Activate'}</Pill>
        </div>
      </div>
      {panel === 'details' && <EditProductCard product={product} fetchData={fetchData} onClose={closePanel} inline />}
      {panel === 'images' && <ImageManager product={product} fetchData={fetchData} onClose={closePanel} />}
      {panel === 'options' && <OptionsManager product={product} fetchData={fetchData} onClose={closePanel} />}
      {panel === 'variants-config' && <ProductConfigManager product={product} fetchData={fetchData} onClose={closePanel} />}
      {panel === 'orders' && (
        <ProductOrdersPanel
          product={product}
          allProducts={allProducts}
          orders={orders}
          loading={ordersLoading}
          ordersLoaded={ordersLoaded}
          fetchOrders={fetchOrders}
          updateOrderLocal={updateOrderLocal}
          onClose={closePanel}
        />
      )}
      {panel === 'addons' && (
        <ProductAddonsPanel
          parent={product}
          allProducts={allProducts}
          fetchData={fetchData}
          orders={orders}
          ordersLoading={ordersLoading}
          ordersLoaded={ordersLoaded}
          fetchOrders={fetchOrders}
          updateOrderLocal={updateOrderLocal}
          onClose={closePanel}
        />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PER-PRODUCT ORDERS PANEL
═══════════════════════════════════════════════ */
function ProductOrdersPanel({ product, allProducts, orders, loading, ordersLoaded, fetchOrders, updateOrderLocal, onClose }) {
  const familyIds = new Set([
    product._id,
    ...allProducts.filter(p => {
      const pid = typeof p.parentProductId === 'object' ? p.parentProductId?._id : p.parentProductId;
      return pid === product._id;
    }).map(p => p._id),
  ]);

  const filtered = orders.filter(o =>
    (o.productsOrdered || []).some(item => {
      const pid = typeof item.productId === 'object' ? item.productId?._id : item.productId;
      return familyIds.has(pid);
    })
  );

  if (loading || !ordersLoaded) {
    return (
      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-subtle)' }}>
        <PanelHeader title="Orders" onClose={onClose} />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
      <PanelHeader title={`Orders (${filtered.length})`} onClose={onClose} />
      {filtered.length === 0 ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', padding: '20px 0' }}>No orders for this product yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(o => (
            <OrderRow key={o._id} order={o} fetchOrders={fetchOrders} updateOrderLocal={updateOrderLocal} />
          ))}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PER-PRODUCT ADD-ONS PANEL
═══════════════════════════════════════════════ */
function ProductAddonsPanel({ parent, allProducts, fetchData, orders, ordersLoading, ordersLoaded, fetchOrders, updateOrderLocal, onClose }) {
  const [expandedId, setExpandedId] = useState(null);
  const [expandedSubPanel, setExpandedSubPanel] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const addons = allProducts.filter(p => {
    const pid = typeof p.parentProductId === 'object' ? p.parentProductId?._id : p.parentProductId;
    return pid === parent._id;
  });

  return (
    <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: '14px' }}>
        <PanelHeader title={`Add-ons (${addons.length})`} onClose={onClose} />
        <button type="button" onClick={() => setShowCreate(true)}
          style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
          + Add add-on
        </button>
      </div>

      {addons.length === 0 ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', padding: '20px 0' }}>No add-ons yet. Click "+ Add add-on" to create one tied to this product.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {addons.map(ao => (
            <ProductCard
              key={ao._id}
              product={ao}
              allProducts={allProducts}
              fetchData={fetchData}
              orders={orders}
              ordersLoading={ordersLoading}
              ordersLoaded={ordersLoaded}
              fetchOrders={fetchOrders}
              updateOrderLocal={updateOrderLocal}
              panel={expandedId === ao._id ? expandedSubPanel : null}
              onTogglePanel={(pn) => {
                if (pn === null || (expandedId === ao._id && expandedSubPanel === pn)) {
                  setExpandedId(null); setExpandedSubPanel(null);
                } else {
                  setExpandedId(ao._id); setExpandedSubPanel(pn);
                  if ((pn === 'orders' || pn === 'addons') && !ordersLoaded) fetchOrders?.();
                }
              }}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProductModal
          forcedParentId={parent._id}
          forcedParentName={parent.name}
          onClose={() => setShowCreate(false)}
          onCreated={() => { fetchData(); setShowCreate(false); }}
        />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   EDIT PRODUCT
═══════════════════════════════════════════════ */
function EditProductCard({ product, fetchData, onClose, inline }) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description,
    price: product.price,
    // -1 / null / undefined → empty string (means unlimited / untracked)
    stocks: product.stocks === -1 || product.stocks == null ? '' : product.stocks,
    category: product.category
  });
  const [specs, setSpecs] = useState((product.specifications || []).map(s => ({ label: s.label, value: s.value })));
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        stocks: form.stocks === '' || form.stocks == null ? -1 : Number(form.stocks),
        specifications: specs.filter(s => s.label.trim() && s.value.trim()),
      };
      await apiFetch(`/products/${product._id}/update`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      toast.success('Product updated'); onClose(); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const wrapperStyle = inline
    ? { padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)' }
    : { padding: '20px', border: '2px solid var(--accent)', background: 'var(--surface)', borderRadius: 'var(--radius)' };

  return (
    <div style={wrapperStyle}>
      <div>
        <PanelHeader title={inline ? 'Edit Details' : 'Edit Product'} onClose={onClose} />
        <div className="form-group"><label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        {/* Rich text description */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>Description</label>
            <button type="button" onClick={() => setShowPreview(p => !p)} style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {showPreview ? (
            <div style={{ minHeight: 80, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.88rem', lineHeight: 1.7 }}>
              <RichText content={form.description} />
            </div>
          ) : (
            <>
              <textarea className="form-input" style={{ minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: '4px' }}>
                Markdown: **bold** · *italic* · # Heading · - bullet · blank line = new paragraph
              </p>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group"><label className="form-label">Price (₱) — used when no options set</label>
            <input type="number" className="form-input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Stock <span style={{ fontWeight: 400, color: 'var(--ink-faint)', fontSize: '0.7rem' }}>— optional</span></label>
            <input type="number" className="form-input" min="0" value={form.stocks} onChange={e => setForm(f => ({ ...f, stocks: e.target.value }))} placeholder="Blank = unlimited / set per option or variant" />
          </div>
        </div>
        <div className="form-group"><label className="form-label">Category</label>
          <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
        </div>

        {/* Specifications editor */}
        <div className="form-group">
          <label className="form-label">Specifications <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(optional)</span></label>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginBottom: '8px', marginTop: '2px' }}>
            Custom rows shown on the product page (e.g. Layout → 65%, Weight → 1.2kg).
          </p>
          {specs.map((spec, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', marginBottom: '6px' }}>
              <input className="form-input" style={{ fontSize: '0.78rem', padding: '7px 9px' }} placeholder="Label"
                value={spec.label}
                onChange={e => setSpecs(s => s.map((r, j) => j !== i ? r : { ...r, label: e.target.value }))} />
              <input className="form-input" style={{ fontSize: '0.78rem', padding: '7px 9px' }} placeholder="Value"
                value={spec.value}
                onChange={e => setSpecs(s => s.map((r, j) => j !== i ? r : { ...r, value: e.target.value }))} />
              <button type="button" onClick={() => setSpecs(s => s.filter((_, j) => j !== i))}
                style={{ padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}>✕</button>
            </div>
          ))}
          <button type="button"
            onClick={() => setSpecs(s => [...s, { label: '', value: '' }])}
            style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            + Add Specification
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button className="btn-dark" disabled={saving} onClick={save} style={{ padding: '10px 24px' }}><span>{saving ? 'Saving...' : 'Save'}</span></button>
          <button className="btn-outline" onClick={onClose} style={{ padding: '10px 24px' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   IMAGE MANAGER
═══════════════════════════════════════════════ */
function ImageManager({ product, fetchData, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragSrcIdx, setDragSrcIdx] = useState(null);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append('images', files[i]);
    setUploading(true);
    try {
      await apiFetch(`/products/${product._id}/images`, { method: 'POST', body: formData });
      toast.success('Images uploaded'); fetchData();
    } catch (err) { toast.error(err.message); } finally { setUploading(false); e.target.value = ''; }
  };

  const handleAddUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setAddingUrl(true);
    try {
      await apiFetch(`/products/${product._id}/images/add-url`, {
        method: 'POST', body: JSON.stringify({ url }),
      });
      toast.success('Image added'); setUrlInput(''); fetchData();
    } catch (err) { toast.error(err.message); } finally { setAddingUrl(false); }
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      await apiFetch(`/products/${product._id}/images/${imageId}`, { method: 'DELETE' });
      toast.success('Image deleted'); fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const handleDrop = async (dropIdx) => {
    if (dragSrcIdx === null || dragSrcIdx === dropIdx) { setDragOverIdx(null); setDragSrcIdx(null); return; }
    const imgs = [...(product.images || [])];
    const [moved] = imgs.splice(dragSrcIdx, 1);
    imgs.splice(dropIdx, 0, moved);
    setDragOverIdx(null); setDragSrcIdx(null);
    try {
      await apiFetch(`/products/${product._id}/images/reorder`, {
        method: 'PATCH', body: JSON.stringify({ imageIds: imgs.map(i => i._id) }),
      });
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <PanelHeader title="Images" onClose={onClose} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <label className="admin-card-btn" style={{ cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
          {uploading ? 'Uploading...' : '+ Upload'}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input className="form-input" style={{ fontSize: '0.75rem', padding: '5px 8px', flex: 1 }}
          placeholder="Or paste image URL..." value={urlInput}
          onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddUrl()} />
        <button onClick={handleAddUrl} disabled={addingUrl || !urlInput.trim()}
          style={{ padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', opacity: (!urlInput.trim() || addingUrl) ? 0.5 : 1 }}>
          {addingUrl ? 'Adding...' : 'Add URL'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(product.images || []).map((img, idx) => (
          <div key={img._id} draggable
            onDragStart={() => setDragSrcIdx(idx)}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragOverIdx(null); setDragSrcIdx(null); }}
            style={{ position: 'relative', width: 72, height: 72, borderRadius: '8px', overflow: 'hidden',
              border: dragOverIdx === idx ? '2px dashed var(--accent)' : '1px solid var(--border)',
              cursor: 'grab', transition: 'border 0.15s', opacity: dragSrcIdx === idx ? 0.4 : 1 }}>
            <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            <button onClick={() => handleDelete(img._id)} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>✕</button>
            {idx === 0 && <span style={{ position: 'absolute', bottom: 3, left: 3, fontSize: '0.5rem', fontWeight: 700, background: 'var(--accent)', color: '#fff', padding: '1px 4px', borderRadius: '4px' }}>MAIN</span>}
          </div>
        ))}
        {(!product.images || product.images.length === 0) && <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', padding: '8px 0' }}>No images yet.</p>}
      </div>
      <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: '6px' }}>Drag thumbnails to reorder. First image is the main/cover image.</p>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   OPTIONS MANAGER
   Creates/manages option groups (e.g., Kit: Base Kit ₱7300, Novelties ₱2000)
   Each option value can have an image URL that replaces the product image when selected.
═══════════════════════════════════════════════ */
function OptionsManager({ product, fetchData, onClose }) {
  const [groups, setGroups] = useState(
    (product.options || []).map(g => ({
      ...g,
      values: (g.values || []).map(v => ({ ...v }))
    }))
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({});
  const [newGroup, setNewGroup] = useState({ name: '' });
  const [newValues, setNewValues] = useState({}); // keyed by group index

  const addGroup = () => {
    if (!newGroup.name.trim()) return;
    const idx = groups.length;
    setGroups(g => [...g, { name: newGroup.name.trim(), values: [] }]);
    setNewValues(v => ({ ...v, [idx]: { value: '', price: '', imageUrl: '' } }));
    setNewGroup({ name: '' });
  };

  const removeGroup = (gi) => setGroups(g => g.filter((_, i) => i !== gi));

  const addValue = (gi) => {
    const nv = newValues[gi];
    if (!nv?.value?.trim() || nv.price === '') return;
    setGroups(g => g.map((grp, i) => i !== gi ? grp : {
      ...grp,
      values: [...grp.values, {
        value: nv.value.trim(),
        price: Number(nv.price) || 0,
        stocks: nv.stocks !== '' && nv.stocks !== undefined ? Number(nv.stocks) : -1,
        available: true,
        image: { url: nv.imageUrl?.trim() || '', altText: nv.value.trim() }
      }]
    }));
    setNewValues(v => ({ ...v, [gi]: { value: '', price: '', stocks: '', imageUrl: '' } }));
  };

  const removeValue = (gi, vi) => setGroups(g => g.map((grp, i) => i !== gi ? grp : {
    ...grp, values: grp.values.filter((_, j) => j !== vi)
  }));

  const toggleAvailable = (gi, vi) => setGroups(g => g.map((grp, i) => i !== gi ? grp : {
    ...grp, values: grp.values.map((v, j) => j !== vi ? v : { ...v, available: !v.available })
  }));

  const updateValueField = (gi, vi, field, val) => setGroups(g => g.map((grp, i) => i !== gi ? grp : {
    ...grp, values: grp.values.map((v, j) => j !== vi ? v : field === 'imageUrl'
      ? { ...v, image: { ...v.image, url: val } }
      : { ...v, [field]: (field === 'price' || field === 'stocks') ? (val === '' || val === '-1' ? -1 : Number(val) || 0) : val }
    )
  }));

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/products/${product._id}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ options: groups })
      });
      toast.success('Options saved'); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  return (
    <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)' }}>
      <PanelHeader title="Options — additional-price selectors (added on top of base price)" onClose={onClose} />

      {groups.map((grp, gi) => (
        <div key={gi} style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{grp.name}</span>
            <button onClick={() => removeGroup(gi)} style={{ fontSize: '0.68rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove Group</button>
          </div>

          {/* Column headers */}
          {grp.values.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 1fr 56px 24px', gap: '4px', marginBottom: '4px' }}>
              {['Value', '+ ₱', 'Stock', 'Image URL (optional)', 'Avail.', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</span>
              ))}
            </div>
          )}

          {grp.values.map((val, vi) => (
            <div key={vi} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 1fr 56px 24px', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
              <input className="form-input" style={inputSm} value={val.value}
                onChange={e => updateValueField(gi, vi, 'value', e.target.value)} />
              <input type="number" className="form-input" style={inputSm} value={val.price}
                onChange={e => updateValueField(gi, vi, 'price', e.target.value)} />
              <input type="number" className="form-input" style={inputSm} value={val.stocks === -1 || val.stocks === undefined ? '' : val.stocks}
                placeholder="∞" title="-1 or empty = unlimited"
                onChange={e => updateValueField(gi, vi, 'stocks', e.target.value)} />
              <div style={{ display: 'flex', gap: '3px' }}>
                <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0 }} placeholder="https://..." value={val.image?.url || ''}
                  onChange={e => updateValueField(gi, vi, 'imageUrl', e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', flexShrink: 0, opacity: uploadingImg[`${gi}-${vi}`] ? 0.5 : 1 }} title="Upload image">
                  {uploadingImg[`${gi}-${vi}`] ? '…' : '↑'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploadingImg(p => ({ ...p, [`${gi}-${vi}`]: true }));
                    try { updateValueField(gi, vi, 'imageUrl', await uploadOptionImage(file)); }
                    catch { toast.error('Upload failed'); }
                    finally { setUploadingImg(p => ({ ...p, [`${gi}-${vi}`]: false })); e.target.value = ''; }
                  }} />
                </label>
              </div>
              <button onClick={() => toggleAvailable(gi, vi)} style={{
                fontSize: '0.62rem', padding: '3px 6px', borderRadius: '10px', border: '1px solid',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: val.available ? 'var(--accent-light)' : 'transparent',
                color: val.available ? 'var(--accent)' : 'var(--ink-faint)', borderColor: val.available ? 'var(--accent)' : 'var(--border)',
              }}>{val.available ? 'On' : 'Off'}</button>
              <button onClick={() => removeValue(gi, vi)} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
          ))}

          {/* Add new value row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 1fr auto', gap: '4px', alignItems: 'center', marginTop: '6px' }}>
            <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="Value (e.g. Base Kit)"
              value={newValues[gi]?.value || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), value: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="+ ₱"
              value={newValues[gi]?.price || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), price: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="∞"
              title="Stock (-1 or empty = unlimited)"
              value={newValues[gi]?.stocks || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), stocks: e.target.value } }))} />
            <div style={{ display: 'flex', gap: '3px' }}>
              <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed', flex: 1, minWidth: 0 }} placeholder="Image URL (opt.)"
                value={newValues[gi]?.imageUrl || ''}
                onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: e.target.value } }))} />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', flexShrink: 0, opacity: uploadingImg[`${gi}-new`] ? 0.5 : 1 }} title="Upload image">
                {uploadingImg[`${gi}-new`] ? '…' : '↑'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploadingImg(p => ({ ...p, [`${gi}-new`]: true }));
                  try { const url = await uploadOptionImage(file); setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: url } })); }
                  catch { toast.error('Upload failed'); }
                  finally { setUploadingImg(p => ({ ...p, [`${gi}-new`]: false })); e.target.value = ''; }
                }} />
              </label>
            </div>
            <button onClick={() => addValue(gi)} className="admin-card-btn success" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </div>
      ))}

      {/* Add new group */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
        <input className="form-input" style={{ fontSize: '0.75rem', padding: '6px 8px' }} placeholder="New group name (e.g. Kit)"
          value={newGroup.name} onChange={e => setNewGroup({ name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && addGroup()} />
        <button onClick={addGroup} className="admin-card-btn success" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>+ Add Group</button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={save} disabled={saving} className="btn-dark" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>
          <span>{saving ? 'Saving...' : 'Save Options'}</span>
        </button>
        {onClose && (
          <button onClick={onClose} className="btn-outline" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>Cancel</button>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PRODUCT CONFIG MANAGER
   Config groups add to the base/option price. Each option can have an image.
═══════════════════════════════════════════════ */
function ProductConfigManager({ product, fetchData, onClose }) {
  const [useVariants, setUseVariants] = useState(product.useVariants || !(product.configurations?.length > 0));
  const [togglingVariants, setTogglingVariants] = useState(false);

  const handleVariantToggle = async (val) => {
    if (val && product.variants?.length > 0) {
      setUseVariants(true); return;
    }
    if (!val && product.useVariants) {
      if (!window.confirm('Switch back to classic mode? Your variants will be preserved but hidden until you switch back.')) return;
      setTogglingVariants(true);
      try {
        await apiFetch(`/products/${product._id}/update`, { method: 'PATCH', body: JSON.stringify({ useVariants: false }) });
        toast.success('Switched to classic mode'); fetchData(); setUseVariants(false);
      } catch (err) { toast.error(err.message); } finally { setTogglingVariants(false); }
      return;
    }
    setUseVariants(val);
  };

  const [configs, setConfigs] = useState(
    (product.configurations || []).map(c => ({
      ...c,
      options: (c.options || []).map(o => ({ ...o, image: o.image || { url: '', altText: '' } }))
    }))
  );
  const [rules, setRules] = useState(
    (product.configAvailabilityRules || []).map(r => ({
      _id: r._id,
      conditions: Array.isArray(r.conditions) && r.conditions.length
        ? r.conditions.map(c => ({ configName: c.configName, selectedValue: c.selectedValue }))
        : [{ configName: r.configName || '', selectedValue: r.selectedValue || '' }],
      targetConfigName: r.targetConfigName || '',
      availableValues: r.availableValues || []
    }))
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({});
  const [newCfgName, setNewCfgName] = useState('');
  const [newOptInputs, setNewOptInputs] = useState({}); // keyed by config index

  const toggleAvail = (ci, oi) => setConfigs(p => p.map((c, i) => i !== ci ? c : {
    ...c, options: c.options.map((o, j) => j !== oi ? o : { ...o, available: !o.available })
  }));

  const removeConfig = (ci) => setConfigs(p => p.filter((_, i) => i !== ci));

  const removeOpt = (ci, oi) => setConfigs(p => p.map((c, i) => i !== ci ? c : {
    ...c, options: c.options.filter((_, j) => j !== oi)
  }));

  const updateOptField = (ci, oi, field, val) => setConfigs(p => p.map((c, i) => i !== ci ? c : {
    ...c, options: c.options.map((o, j) => j !== oi ? o : field === 'imageUrl'
      ? { ...o, image: { ...o.image, url: val } }
      : { ...o, [field]: (field === 'priceModifier' || field === 'stocks') ? (val === '' || val === '-1' ? -1 : Number(val) || 0) : val }
    )
  }));

  const addConfig = () => {
    if (!newCfgName.trim()) return;
    const ci = configs.length;
    setConfigs(p => [...p, { name: newCfgName.trim(), options: [] }]);
    setNewOptInputs(v => ({ ...v, [ci]: { value: '', priceModifier: 0, imageUrl: '' } }));
    setNewCfgName('');
  };

  const addOpt = (ci) => {
    const inp = newOptInputs[ci];
    if (!inp?.value?.trim()) return;
    setConfigs(p => p.map((c, i) => i !== ci ? c : {
      ...c, options: [...c.options, {
        value: inp.value.trim(),
        available: true,
        stocks: inp.stocks !== '' && inp.stocks !== undefined ? Number(inp.stocks) : -1,
        priceModifier: Number(inp.priceModifier) || 0,
        image: { url: inp.imageUrl?.trim() || '', altText: inp.value.trim() }
      }]
    }));
    setNewOptInputs(v => ({ ...v, [ci]: { value: '', priceModifier: 0, stocks: '', imageUrl: '' } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/products/${product._id}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ configurations: configs, configAvailabilityRules: rules })
      });
      toast.success('Configurations saved'); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  return (
    <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)' }}>
      <PanelHeader title="Configs" onClose={onClose} />
      {/* Variant system toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', padding: '8px 12px', background: useVariants ? 'var(--accent-light)' : 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: `1px solid ${useVariants ? 'var(--accent)' : 'var(--border)'}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: useVariants ? 'var(--accent)' : 'var(--ink)' }}>
          <input type="checkbox" checked={useVariants} disabled={togglingVariants}
            onChange={e => handleVariantToggle(e.target.checked)}
            style={{ width: 14, height: 14, cursor: 'pointer' }} />
          Use variant system (new)
        </label>
        <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
          {useVariants ? 'Each valid combination is one SKU with its own stock.' : 'Classic mode: options + configurations + rules.'}
        </span>
      </div>

      {useVariants ? (
        <VariantEditor product={product} fetchData={fetchData} onClose={onClose} embedded />
      ) : (
      <>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '10px' }}>
        Configs — add-on selectors that affect the final price
      </p>

      {configs.map((cfg, ci) => (
        <div key={ci} style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{cfg.name}</span>
            <button onClick={() => removeConfig(ci)} style={{ fontSize: '0.68rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
          </div>

          {cfg.options.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 45px 1fr 44px 22px', gap: '4px', marginBottom: '4px' }}>
              {['Value', '+₱', 'Stock', 'Image URL (opt.)', 'Avail.', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.61rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</span>
              ))}
            </div>
          )}

          {cfg.options.map((opt, oi) => (
            <div key={oi} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 45px 1fr 44px 22px', gap: '4px', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 500, padding: '4px 2px',
                textDecoration: opt.available ? 'none' : 'line-through', opacity: opt.available ? 1 : 0.45 }}>{opt.value}</span>
              <input type="number" className="form-input" style={inputSm} value={opt.priceModifier}
                onChange={e => updateOptField(ci, oi, 'priceModifier', e.target.value)} />
              <input type="number" className="form-input" style={inputSm}
                value={opt.stocks === -1 || opt.stocks === undefined ? '' : opt.stocks}
                placeholder="∞" title="-1 or empty = unlimited"
                onChange={e => updateOptField(ci, oi, 'stocks', e.target.value)} />
              <div style={{ display: 'flex', gap: '3px' }}>
                <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0 }} placeholder="https://..." value={opt.image?.url || ''}
                  onChange={e => updateOptField(ci, oi, 'imageUrl', e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', flexShrink: 0, opacity: uploadingImg[`${ci}-${oi}`] ? 0.5 : 1 }} title="Upload image">
                  {uploadingImg[`${ci}-${oi}`] ? '…' : '↑'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploadingImg(p => ({ ...p, [`${ci}-${oi}`]: true }));
                    try { updateOptField(ci, oi, 'imageUrl', await uploadOptionImage(file)); }
                    catch { toast.error('Upload failed'); }
                    finally { setUploadingImg(p => ({ ...p, [`${ci}-${oi}`]: false })); e.target.value = ''; }
                  }} />
                </label>
              </div>
              <button onClick={() => toggleAvail(ci, oi)} style={{
                fontSize: '0.6rem', padding: '2px 5px', borderRadius: '10px', border: '1px solid',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                background: opt.available ? 'var(--accent-light)' : 'transparent',
                color: opt.available ? 'var(--accent)' : 'var(--ink-faint)',
                borderColor: opt.available ? 'var(--accent)' : 'var(--border)',
              }}>{opt.available ? 'On' : 'Off'}</button>
              <button onClick={() => removeOpt(ci, oi)} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ))}

          {/* Add new option row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 1fr auto', gap: '4px', alignItems: 'center', marginTop: '6px' }}>
            <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="Option value"
              value={newOptInputs[ci]?.value || ''}
              onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), value: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="+₱"
              value={newOptInputs[ci]?.priceModifier || ''}
              onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), priceModifier: e.target.value } }))} />
            <div style={{ display: 'flex', gap: '3px' }}>
              <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed', flex: 1, minWidth: 0 }} placeholder="Image URL (opt.)"
                value={newOptInputs[ci]?.imageUrl || ''}
                onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), imageUrl: e.target.value } }))} />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', flexShrink: 0, opacity: uploadingImg[`${ci}-new`] ? 0.5 : 1 }} title="Upload image">
                {uploadingImg[`${ci}-new`] ? '…' : '↑'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploadingImg(p => ({ ...p, [`${ci}-new`]: true }));
                  try { const url = await uploadOptionImage(file); setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), imageUrl: url } })); }
                  catch { toast.error('Upload failed'); }
                  finally { setUploadingImg(p => ({ ...p, [`${ci}-new`]: false })); e.target.value = ''; }
                }} />
              </label>
            </div>
            <button onClick={() => addOpt(ci)} className="admin-card-btn success" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </div>
      ))}

      {/* Add new config group */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
        <input className="form-input" style={{ fontSize: '0.75rem', padding: '6px 8px' }} placeholder="Config group name (e.g. Layout)"
          value={newCfgName} onChange={e => setNewCfgName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addConfig()} />
        <button onClick={addConfig} className="admin-card-btn success" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>+ Add Config</button>
      </div>

      {/* ── Availability Rules ── */}
      {configs.length >= 2 && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '8px' }}>
            Availability Rules — restrict which options appear based on a combination of selections
          </p>
          <p style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginBottom: '10px' }}>
            Example: When Color = "Beige/Mint" AND Layout = "WK" → Grade allows: B-Stock
          </p>

          {rules.map((rule, ri) => {
            const conditionConfigNames = (rule.conditions || []).map(c => c.configName).filter(Boolean);
            const targetOptions = configs.filter(c => !conditionConfigNames.includes(c.name));
            return (
              <div key={ri} style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                {/* Conditions */}
                {(rule.conditions || []).map((cond, ci) => (
                  <div key={ci} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500, minWidth: 30 }}>{ci === 0 ? 'When' : 'AND'}</span>
                    <select className="form-input" style={{ ...inputSm, width: 'auto' }} value={cond.configName}
                      onChange={e => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                        ...rr, conditions: rr.conditions.map((cc, j) => j !== ci ? cc : { configName: e.target.value, selectedValue: '' })
                      }))}>
                      <option value="">Select config...</option>
                      {configs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <span>=</span>
                    <select className="form-input" style={{ ...inputSm, width: 'auto' }} value={cond.selectedValue}
                      onChange={e => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                        ...rr, conditions: rr.conditions.map((cc, j) => j !== ci ? cc : { ...cc, selectedValue: e.target.value })
                      }))}>
                      <option value="">Select value...</option>
                      {(configs.find(c => c.name === cond.configName)?.options || []).map(o => (
                        <option key={o.value} value={o.value}>{o.value}</option>
                      ))}
                    </select>
                    {(rule.conditions || []).length > 1 && (
                      <button onClick={() => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                        ...rr, conditions: rr.conditions.filter((_, j) => j !== ci)
                      }))} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                ))}

                {/* Add AND condition */}
                <button onClick={() => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                  ...rr, conditions: [...(rr.conditions || []), { configName: '', selectedValue: '' }]
                }))} style={{ fontSize: '0.64rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginBottom: '6px' }}>
                  + AND condition
                </button>

                {/* Target + allowed values */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                  <span style={{ fontWeight: 500 }}>→</span>
                  <select className="form-input" style={{ ...inputSm, width: 'auto' }} value={rule.targetConfigName}
                    onChange={e => setRules(r => r.map((rr, i) => i !== ri ? rr : { ...rr, targetConfigName: e.target.value, availableValues: [] }))}>
                    <option value="">Target config...</option>
                    {targetOptions.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <span style={{ fontWeight: 500 }}>allows:</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {(configs.find(c => c.name === rule.targetConfigName)?.options || []).map(o => {
                      const checked = (rule.availableValues || []).includes(o.value);
                      return (
                        <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', cursor: 'pointer',
                          padding: '2px 6px', borderRadius: '8px', border: '1px solid',
                          borderColor: checked ? 'var(--accent)' : 'var(--border)',
                          background: checked ? 'var(--accent-light)' : 'transparent',
                          color: checked ? 'var(--accent)' : 'var(--ink-muted)' }}>
                          <input type="checkbox" checked={checked} style={{ display: 'none' }}
                            onChange={() => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                              ...rr, availableValues: checked
                                ? rr.availableValues.filter(v => v !== o.value)
                                : [...(rr.availableValues || []), o.value]
                            }))} />
                          {o.value}
                        </label>
                      );
                    })}
                  </div>
                  {rule.conditions?.every(c => !c.configName || !c.selectedValue) && (
                    <span style={{ fontSize: '0.64rem', color: '#c0392b', marginLeft: 4 }}>⚠ incomplete conditions</span>
                  )}
                </div>

                {/* Remove rule */}
                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                  <button onClick={() => setRules(r => r.filter((_, i) => i !== ri))}
                    style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove rule</button>
                </div>
              </div>
            );
          })}

          <button onClick={() => setRules(r => [...r, { conditions: [{ configName: '', selectedValue: '' }], targetConfigName: '', availableValues: [] }])}
            className="admin-card-btn success" style={{ fontSize: '0.68rem', marginTop: '4px' }}>
            + Add Rule
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button onClick={save} disabled={saving} className="btn-dark" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>
          <span>{saving ? 'Saving...' : 'Save Configs'}</span>
        </button>
        {onClose && (
          <button onClick={onClose} className="btn-outline" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>Cancel</button>
        )}
      </div>
      </>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   VARIANT EDITOR
═══════════════════════════════════════════════ */
function VariantEditor({ product, fetchData, onClose, embedded }) {
  const [dims, setDims] = useState((product.variantDimensions || []).map(d => ({ name: d.name, values: [...(d.values || [])] })));
  const [variants, setVariants] = useState((product.variants || []).map(v => ({ _id: v._id, attributes: { ...(v.attributes || {}) }, stock: v.stock ?? -1, price: v.price ?? '', sku: v.sku || '', available: v.available !== false })));
  const [vImages, setVImages] = useState((product.variantImages || []).map(i => ({ _id: i._id, url: i.url, publicId: i.publicId || '', appliesTo: { ...(i.appliesTo || {}) } })));
  const [saving, setSaving] = useState(false);
  const [newDimName, setNewDimName] = useState('');
  const [newDimValues, setNewDimValues] = useState({});
  const [converting, setConverting] = useState(false);
  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  const generateCombos = () => {
    if (!dims.length || dims.some(d => !d.values.length)) return;
    const existing = variants.map(v => JSON.stringify(v.attributes));
    const combos = dims.reduce((acc, d) => acc.flatMap(a => d.values.map(v => ({ ...a, [d.name]: v }))), [{}]);
    const newOnes = combos.filter(c => !existing.includes(JSON.stringify(c)));
    setVariants(v => [...v, ...newOnes.map(attrs => ({ attributes: attrs, stock: -1, price: '', sku: '', available: true }))]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        useVariants: true,
        variantDimensions: dims,
        variants: variants.map(v => ({ ...v, stock: Number(v.stock), price: v.price === '' || v.price == null ? null : Number(v.price) })),
        variantImages: vImages
      };
      await apiFetch(`/products/${product._id}/update`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast.success('Variants saved'); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleImportJson = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await apiFetch(`/products/${product._id}/variants/import`, { method: 'POST', body: JSON.stringify(data) });
      toast.success('Variants imported'); fetchData();
    } catch (err) { toast.error(err.message || 'Import failed'); }
    e.target.value = '';
  };

  const handleConvert = async () => {
    if (!window.confirm('Convert legacy configurations to variants? This will set useVariants=true for this product.')) return;
    setConverting(true);
    try {
      const res = await apiFetch(`/products/${product._id}/variants/convert-from-legacy`, { method: 'POST' });
      toast.success(res.message); fetchData();
    } catch (err) { toast.error(err.message); } finally { setConverting(false); }
  };

  const handleUploadVImage = async (file, appliesTo) => {
    const fd = new FormData();
    fd.append('images', file);
    fd.append('appliesTo', JSON.stringify(appliesTo));
    try {
      const res = await apiFetch(`/products/${product._id}/variants/image`, { method: 'POST', body: fd });
      toast.success('Image uploaded'); fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteVImage = async (imgId) => {
    if (imgId) {
      try { await apiFetch(`/products/${product._id}/variants/image/${imgId}`, { method: 'DELETE' }); }
      catch (err) { toast.error(err.message); return; }
    }
    setVImages(v => v.filter(i => i._id?.toString() !== imgId?.toString()));
    if (imgId) fetchData();
  };

  const sampleJson = JSON.stringify({
    dimensions: dims.length ? dims : [{ name: 'Color', values: ['A', 'B'] }, { name: 'Grade', values: ['A-Stock', 'B-Stock'] }],
    variants: [{ attributes: { Color: 'A', Grade: 'A-Stock' }, stock: 1, price: null, sku: '' }],
    images: [{ url: 'https://...', appliesTo: { Color: 'A' } }],
    replace: true
  }, null, 2);

  const wrapperStyle = embedded
    ? { paddingTop: '12px' }
    : { padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)' };

  return (
    <div style={wrapperStyle}>
      {!embedded && <PanelHeader title="Variants — each row is one sellable SKU with its own stock" onClose={onClose} />}
      {embedded && (
        <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '10px' }}>
          Variant System — each row is one sellable SKU with its own stock
        </p>
      )}

      {product.configurations?.length > 0 && !product.useVariants && (
        <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--ink-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>This product has legacy configurations. You can auto-convert them to variants.</span>
          <button onClick={handleConvert} disabled={converting} className="admin-card-btn" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap', marginLeft: '12px' }}>
            {converting ? 'Converting...' : 'Convert from Legacy'}
          </button>
        </div>
      )}

      {/* ── Dimensions ── */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>Dimensions</p>
        {dims.map((d, di) => (
          <div key={di} style={{ marginBottom: '8px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
              <input className="form-input" style={{ ...inputSm, fontWeight: 600, width: 120 }} value={d.name}
                onChange={e => setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, name: e.target.value }))} />
              <button onClick={() => setDims(p => p.filter((_, i) => i !== di))} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
              {d.values.map((v, vi) => (
                <span key={vi} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 500 }}>
                  {v}
                  <button onClick={() => setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: dd.values.filter((_, j) => j !== vi) }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.7rem', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
                </span>
              ))}
              <input className="form-input" style={{ ...inputSm, width: 100, borderStyle: 'dashed' }} placeholder="+ value"
                value={newDimValues[di] || ''}
                onChange={e => setNewDimValues(p => ({ ...p, [di]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newDimValues[di]?.trim()) {
                    setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: [...dd.values, newDimValues[di].trim()] }));
                    setNewDimValues(p => ({ ...p, [di]: '' }));
                    e.preventDefault();
                  }
                }} />
              {newDimValues[di]?.trim() && (
                <button onClick={() => {
                  setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: [...dd.values, newDimValues[di].trim()] }));
                  setNewDimValues(p => ({ ...p, [di]: '' }));
                }} className="admin-card-btn success" style={{ fontSize: '0.65rem' }}>+</button>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input className="form-input" style={{ ...inputSm, width: 160, borderStyle: 'dashed' }} placeholder="Dimension name (e.g. Color)"
            value={newDimName} onChange={e => setNewDimName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newDimName.trim()) { setDims(p => [...p, { name: newDimName.trim(), values: [] }]); setNewDimName(''); e.preventDefault(); } }} />
          <button onClick={() => { if (!newDimName.trim()) return; setDims(p => [...p, { name: newDimName.trim(), values: [] }]); setNewDimName(''); }}
            className="admin-card-btn success" style={{ fontSize: '0.68rem' }}>+ Add Dimension</button>
          {dims.length > 0 && (
            <button onClick={generateCombos} className="admin-card-btn" style={{ fontSize: '0.68rem' }}>Generate All Combinations</button>
          )}
        </div>
      </div>

      {/* ── Variants table ── */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>
          Variants ({variants.length})
        </p>
        {variants.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {dims.map(d => <th key={d.name} style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{d.name}</th>)}
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Stock</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>+ Price (₱)</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>SKU</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Avail</th>
                  <th style={{ padding: '4px 6px' }}></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, vi) => (
                  <tr key={vi} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: v.available ? 1 : 0.5 }}>
                    {dims.map(d => (
                      <td key={d.name} style={{ padding: '3px 4px' }}>
                        <select className="form-input" style={{ ...inputSm, width: 'auto', minWidth: 80 }}
                          value={v.attributes[d.name] || ''}
                          onChange={e => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, attributes: { ...vv.attributes, [d.name]: e.target.value } }))}>
                          <option value="">—</option>
                          {d.values.map(val => <option key={val} value={val}>{val}</option>)}
                        </select>
                      </td>
                    ))}
                    <td style={{ padding: '3px 4px' }}>
                      <input type="number" className="form-input" style={{ ...inputSm, width: 55 }} value={v.stock === -1 ? '' : v.stock} placeholder="∞"
                        onChange={e => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, stock: e.target.value === '' ? -1 : Number(e.target.value) }))} />
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <input type="number" className="form-input" style={{ ...inputSm, width: 70 }} value={v.price ?? ''} placeholder="Base"
                        onChange={e => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, price: e.target.value === '' ? '' : Number(e.target.value) }))} />
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <input className="form-input" style={{ ...inputSm, width: 80 }} value={v.sku}
                        onChange={e => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, sku: e.target.value }))} />
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <button onClick={() => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, available: !vv.available }))}
                        style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px', border: '1px solid', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                          background: v.available ? 'var(--accent-light)' : 'transparent',
                          color: v.available ? 'var(--accent)' : 'var(--ink-faint)',
                          borderColor: v.available ? 'var(--accent)' : 'var(--border)' }}>
                        {v.available ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <button onClick={() => setVariants(p => p.filter((_, i) => i !== vi))}
                        style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button onClick={() => setVariants(p => [...p, { attributes: Object.fromEntries(dims.map(d => [d.name, d.values[0] || ''])), stock: -1, price: '', sku: '', available: true }])}
          className="admin-card-btn success" style={{ fontSize: '0.68rem', marginTop: '6px' }}>+ Add Variant</button>
      </div>

      {/* ── Variant Images ── */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>
          Variant Images — attach images to specific dimension combinations
        </p>
        <p style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', marginBottom: '8px' }}>
          Set "Any" for dimensions that should match all values. Most-specific image wins on the product page.
        </p>
        {vImages.map((img, ii) => (
          <div key={ii} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            {img.url && <img src={img.url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <input className="form-input" style={{ ...inputSm, width: '100%', marginBottom: '4px' }} placeholder="Image URL" value={img.url}
                onChange={e => setVImages(p => p.map((vv, i) => i !== ii ? vv : { ...vv, url: e.target.value }))} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {dims.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem' }}>
                    <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>{d.name}:</span>
                    <select className="form-input" style={{ ...inputSm, width: 'auto' }}
                      value={img.appliesTo?.[d.name] || ''}
                      onChange={e => setVImages(p => p.map((vv, i) => {
                        if (i !== ii) return vv;
                        const at = { ...vv.appliesTo };
                        if (e.target.value) at[d.name] = e.target.value; else delete at[d.name];
                        return { ...vv, appliesTo: at };
                      }))}>
                      <option value="">Any</option>
                      {d.values.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => handleDeleteVImage(img._id)}
              style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', paddingTop: '4px' }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={() => setVImages(p => [...p, { url: '', publicId: '', appliesTo: {} }])}
            className="admin-card-btn" style={{ fontSize: '0.68rem' }}>+ Add Image (URL)</button>
          <label className="admin-card-btn" style={{ fontSize: '0.68rem', cursor: 'pointer' }}>
            ↑ Upload Image
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              await handleUploadVImage(file, {});
              e.target.value = '';
            }} />
          </label>
        </div>
      </div>

      {/* ── JSON Import ── */}
      <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>JSON Import</p>
        <label className="admin-card-btn" style={{ fontSize: '0.68rem', cursor: 'pointer', display: 'inline-block' }}>
          Choose JSON File
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportJson} />
        </label>
        <details style={{ marginTop: '8px' }}>
          <summary style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', cursor: 'pointer' }}>Show sample JSON format</summary>
          <pre style={{ fontSize: '0.65rem', background: 'var(--surface)', padding: '8px', borderRadius: 'var(--radius-sm)', overflow: 'auto', maxHeight: 200, marginTop: '6px', border: '1px solid var(--border-subtle)' }}>{sampleJson}</pre>
        </details>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={save} disabled={saving} className="btn-dark" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>
          <span>{saving ? 'Saving...' : 'Save Variants'}</span>
        </button>
        {!embedded && onClose && (
          <button onClick={onClose} className="btn-outline" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>Cancel</button>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PRODUCTS TABLE (List View)
═══════════════════════════════════════════════ */
function ProductsTable({ products, fetchData }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['', 'Name', 'Category', 'Price', 'Stock', 'Status', ''].map(h => (
              <th key={h || Math.random()} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map(p => <TableRow key={p._id} product={p} fetchData={fetchData} />)}
          {products.length === 0 && <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-muted)' }}>No products.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({ product, fetchData }) {
  const imgUrl = product.images?.[0]?.url;
  const hasOptions = (product.options?.length || 0) > 0;
  const toggleActive = async () => {
    const action = product.isActive ? 'archive' : 'activate';
    try { await apiFetch(`/products/${product._id}/${action}`, { method: 'PATCH' }); toast.success(product.isActive ? 'Archived' : 'Activated'); fetchData(); }
    catch (err) { toast.error(err.message); }
  };
  const useVariants = !!product.useVariants;
  const displayPrice = hasOptions
    ? `From ₱${((product.price || 0) + Math.min(...product.options.flatMap(g => g.values.map(v => v.price || 0)))).toLocaleString()}`
    : `₱${product.price?.toLocaleString()}`;
  const stockDisplay = (() => {
    if (hasOptions) {
      const values = product.options.flatMap(g => g.values || []);
      let total = 0; let anyUnlimited = false;
      for (const v of values) { const n = v.stocks; if (n === -1 || n == null) anyUnlimited = true; else total += n; }
      return anyUnlimited ? '∞' : total;
    }
    if (useVariants) {
      let total = 0; let anyUnlimited = false;
      for (const v of (product.variants || [])) { const n = v.stock; if (n === -1 || n == null) anyUnlimited = true; else total += n; }
      return anyUnlimited ? '∞' : total;
    }
    if (product.stocks === -1 || product.stocks == null) return '∞';
    return product.stocks;
  })();
  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)', opacity: product.isActive ? 1 : 0.5 }}>
      <td style={{ padding: '10px 14px', width: 48 }}><div style={{ width: 40, height: 40, borderRadius: '8px', overflow: 'hidden', background: 'var(--accent-light)' }}>{imgUrl ? <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div></td>
      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{product.name}</td>
      <td style={{ padding: '10px 14px', color: 'var(--ink-muted)' }}>{product.category}</td>
      <td style={{ padding: '10px 14px' }}>{displayPrice}</td>
      <td style={{ padding: '10px 14px' }}>{stockDisplay}</td>
      <td style={{ padding: '10px 14px' }}><span className={`status-badge ${product.isActive ? 'status-green' : 'status-red'}`}>{product.isActive ? 'Active' : 'Archived'}</span></td>
      <td style={{ padding: '10px 14px' }}><button className="admin-card-btn" onClick={toggleActive} style={{ fontSize: '0.72rem' }}>{product.isActive ? 'Archive' : 'Activate'}</button></td>
    </tr>
  );
}


/* ═══════════════════════════════════════════════
   ORDERS PANEL
═══════════════════════════════════════════════ */
function OrdersPanel({ orders, gbOrders = [], loading, fetchOrders, updateOrderLocal, updateGbOrderLocal }) {
  const [view, setView] = useState('list');
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'instock' | 'gb'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // { orders: [], gbOrders: [] } | null
  const [searching, setSearching] = useState(false);

  const productNames = Array.from(
    new Set(orders.flatMap(o => (o.productsOrdered || []).map(p => p.productName).filter(Boolean)))
  ).sort();

  // Group GB orders by cartCheckoutId so a single cart shows as one row
  const gbGroups = (() => {
    const groups = [];
    const map = new Map();
    for (const o of gbOrders) {
      if (!o.cartCheckoutId) { groups.push({ key: o._id, items: [o], createdAt: o.createdAt }); continue; }
      if (!map.has(o.cartCheckoutId)) {
        const g = { key: o.cartCheckoutId, items: [], createdAt: o.createdAt };
        map.set(o.cartCheckoutId, g);
        groups.push(g);
      }
      const g = map.get(o.cartCheckoutId);
      g.items.push(o);
      if (new Date(o.createdAt) < new Date(g.createdAt)) g.createdAt = o.createdAt;
    }
    return groups;
  })();

  const filteredInStock = productFilter
    ? orders.filter(o => (o.productsOrdered || []).some(p => p.productName === productFilter))
    : orders;

  // Build a unified, type-tagged list sorted by createdAt desc
  const unified = [
    ...(typeFilter !== 'gb' ? filteredInStock.map(o => ({ type: 'instock', createdAt: o.createdAt, order: o })) : []),
    ...(typeFilter !== 'instock' ? gbGroups.map(g => ({ type: 'gb', createdAt: g.createdAt, group: g })) : []),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const runSearch = async (q) => {
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const data = await apiFetch(`/orders/admin/search?q=${encodeURIComponent(q.trim())}`);
      setSearchResults(data);
    } catch (err) { toast.error(err.message); setSearchResults({ orders: [], gbOrders: [] }); }
    finally { setSearching(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', flex: '1 1 240px', maxWidth: 420, minWidth: 0 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" style={{ color: 'var(--ink-faint)', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSearch(searchQuery); }}
            placeholder="Search by order ID or order code"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', color: 'var(--ink)', minWidth: 0 }} />
          {(searchQuery || searchResults) && <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: '1rem', lineHeight: 1, padding: '0 2px' }}>×</button>}
          <button onClick={() => runSearch(searchQuery)} disabled={searching || !searchQuery.trim()}
            style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.74rem', fontFamily: "'DM Sans', sans-serif", opacity: !searchQuery.trim() ? 0.5 : 1, flexShrink: 0 }}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {searchResults && (
        <div style={{ marginBottom: 18, padding: 14, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)' }}>
          <p style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginBottom: 10 }}>
            Search results: {searchResults.orders?.length || 0} in-stock · {searchResults.gbOrders?.length || 0} group buy
          </p>
          {(searchResults.orders?.length || 0) === 0 && (searchResults.gbOrders?.length || 0) === 0 ? (
            <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', textAlign: 'center', padding: '20px 0' }}>No orders match.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(searchResults.orders || []).map(o => (
                <OrderRow key={o._id} order={o} fetchOrders={() => runSearch(searchQuery)} updateOrderLocal={null} />
              ))}
              {(searchResults.gbOrders || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(searchResults.gbOrders || []).map(o => (
                    <div key={o._id} className="admin-search-result-row" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto auto', gap: 14, alignItems: 'center' }}>
                      <span className="status-badge status-red" style={{ fontSize: '0.6rem', padding: '3px 8px' }}>Group Buy</span>
                      <div>
                        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.9rem' }}>{o.cartOrderCode || o.orderCode}</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                          {o.groupBuyId?.parentGroupBuyId ? '↳ ' : ''}{o.groupBuyId?.name || 'Group Buy'}
                        </p>
                      </div>
                      <p style={{ fontSize: '0.84rem' }}>{typeof o.userId === 'object' ? `${o.userId.firstName || ''} ${o.userId.lastName || ''}`.trim() : '—'}</p>
                      <StatusBadge status={o.status} />
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>₱{o.totalPrice?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className={`admin-toggle ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} style={view === 'list' ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <span>List</span>
          </button>
          <button className={`admin-toggle ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')} style={view === 'calendar' ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Calendar</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'all', label: `All (${filteredInStock.length + gbGroups.length})` },
            { key: 'instock', label: `In Stock (${filteredInStock.length})` },
            { key: 'gb', label: `Group Buy (${gbGroups.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={`admin-toggle ${typeFilter === t.key ? 'active' : ''}`}
              style={typeFilter === t.key ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
              {t.label}
            </button>
          ))}
        </div>
        {productNames.length > 0 && (
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', color: productFilter ? 'var(--ink)' : 'var(--ink-muted)', cursor: 'pointer' }}>
            <option value="">All products</option>
            {productNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>
      {unified.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-muted)' }}>No orders yet.</div>
      ) : view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {unified.map(entry => entry.type === 'instock' ? (
            <OrderRow key={'is-' + entry.order._id} order={entry.order} fetchOrders={fetchOrders} updateOrderLocal={updateOrderLocal}
              typeTag={{ label: 'In Stock', className: 'status-amber' }} />
          ) : (
            <UnifiedGBOrderCard key={'gb-' + entry.group.key}
              items={entry.group.items}
              updateOrderLocal={updateGbOrderLocal}
              parentGbId={entry.group.items.find(i => !i.groupBuyId?.parentGroupBuyId)?.groupBuyId?._id || entry.group.items[0]?.groupBuyId?._id}
              fetchOrders={fetchOrders}
              typeTag={{ label: 'Group Buy', className: 'status-red' }} />
          ))}
        </div>
      ) : (
        <OrdersCalendar orders={filteredInStock} fetchOrders={fetchOrders} updateOrderLocal={updateOrderLocal} />
      )}
    </div>
  );
}

/* ─── ORDERS CALENDAR ─── */
function OrdersCalendar({ orders, fetchOrders, updateOrderLocal }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedKey, setSelectedKey] = useState(() => toKey(new Date()));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const byDay = {};
  for (const o of orders) {
    const k = toKey(new Date(o.createdAt));
    (byDay[k] ||= []).push(o);
  }

  const monthName = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: prevMonthDays - firstWeekday + i + 1, outside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, outside: false, date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - firstWeekday - daysInMonth + 1, outside: true });

  const todayKey = toKey(new Date());
  const selectedOrders = byDay[selectedKey] || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.4rem' }}>{monthName}</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="admin-toggle" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>‹ Prev</button>
          <button className="admin-toggle" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelectedKey(todayKey); }}>Today</button>
          <button className="admin-toggle" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>Next ›</button>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <div className="orders-calendar-week" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-secondary)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ padding: '10px', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', textAlign: 'center' }}>{d}</div>
          ))}
        </div>
        <div className="orders-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((c, i) => {
            const k = c.outside ? null : toKey(c.date);
            const dayOrders = k ? byDay[k] || [] : [];
            const count = dayOrders.length;
            const revenue = dayOrders.reduce((n, o) => n + (o.totalPrice || 0), 0);
            const isToday = k === todayKey;
            const isSelected = k === selectedKey;
            return (
              <button key={i}
                disabled={c.outside}
                onClick={() => k && setSelectedKey(k)}
                style={{
                  minHeight: 92, padding: '8px', border: '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--accent-light)' : (c.outside ? 'var(--bg-secondary)' : 'transparent'),
                  opacity: c.outside ? 0.4 : 1, cursor: c.outside ? 'default' : 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                  fontFamily: 'inherit', color: 'var(--ink)', textAlign: 'left',
                  position: 'relative',
                }}>
                <span style={{ fontSize: '0.82rem', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', border: isToday ? '1.5px solid var(--accent)' : 'none' }}>
                  {c.day}
                </span>
                {count > 0 && (
                  <>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '10px' }}>{count} order{count > 1 ? 's' : ''}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>₱{revenue.toLocaleString()}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '22px' }}>
        <h4 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', marginBottom: '12px' }}>
          {formatDateLabel(selectedKey)} · {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''}
        </h4>
        {selectedOrders.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem' }}>No orders on this day.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {selectedOrders.map(o => <OrderRow key={o._id} order={o} fetchOrders={fetchOrders} updateOrderLocal={updateOrderLocal} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function toKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function formatDateLabel(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/* ─── STATS PANEL ─── */
function StatsPanel({ orders, loading }) {
  useTheme(); // re-render when theme toggles so inline-styled charts pick up the dark palette
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>;

  const isCancelled = (o) => o.status === 'Cancelled';
  const active = orders.filter(o => !isCancelled(o));
  const refunds = orders.filter(isCancelled);

  const grossRevenue = active.reduce((n, o) => n + (o.totalPrice || 0), 0);
  const refundedAmount = refunds.reduce((n, o) => n + (o.totalPrice || 0), 0);
  const netRevenue = grossRevenue; // active already excludes cancelled; refunds shown separately
  const totalOrders = orders.length;
  const activeCount = active.length;
  const avgOrder = activeCount > 0 ? grossRevenue / activeCount : 0;

  const now = new Date();
  const sameMonth = (d, base) => d.getFullYear() === base.getFullYear() && d.getMonth() === base.getMonth();
  const thisMonth = active.filter(o => sameMonth(new Date(o.createdAt), now));
  const thisMonthRev = thisMonth.reduce((n, o) => n + (o.totalPrice || 0), 0);
  const lastMonthBase = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = active.filter(o => sameMonth(new Date(o.createdAt), lastMonthBase));
  const lastMonthRev = lastMonth.reduce((n, o) => n + (o.totalPrice || 0), 0);
  const momPct = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : null;

  const byStatus = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  const statusRows = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);

  const byProduct = {};
  for (const o of active) { // exclude cancelled from top products
    for (const p of (o.productsOrdered || [])) {
      const k = p.productName || 'Unknown';
      if (!byProduct[k]) byProduct[k] = { qty: 0, revenue: 0 };
      byProduct[k].qty += p.quantity || 0;
      byProduct[k].revenue += p.subtotal || 0;
    }
  }
  const topProducts = Object.entries(byProduct).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

  // Last 30 days series
  const DAYS = 30;
  const series = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    series.push({ date: d, key: toKey(d), revenue: 0, refunds: 0, count: 0 });
  }
  const seriesByKey = Object.fromEntries(series.map(s => [s.key, s]));
  for (const o of orders) {
    const k = toKey(new Date(o.createdAt));
    const s = seriesByKey[k];
    if (!s) continue;
    if (isCancelled(o)) s.refunds += o.totalPrice || 0;
    else { s.revenue += o.totalPrice || 0; s.count += 1; }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <StatTile accent label="Net Revenue" value={`₱${netRevenue.toLocaleString()}`} sub={`${activeCount} active order${activeCount !== 1 ? 's' : ''}`} />
        <StatTile
          label="This Month"
          value={`₱${thisMonthRev.toLocaleString()}`}
          sub={momPct == null ? `${thisMonth.length} order${thisMonth.length !== 1 ? 's' : ''}` : `${momPct >= 0 ? '↑' : '↓'} ${Math.abs(momPct).toFixed(0)}% vs last month`}
          subColor={momPct == null ? 'var(--ink-muted)' : momPct >= 0 ? '#15803d' : '#b91c1c'}
        />
        <StatTile label="Avg Order" value={`₱${Math.round(avgOrder).toLocaleString()}`} sub="Excludes refunds" />
        <StatTile label="Total Orders" value={totalOrders.toLocaleString()} sub={`${activeCount} active`} />
        <StatTile label="Refunds" value={`₱${refundedAmount.toLocaleString()}`} sub={`${refunds.length} cancelled`} subColor={refunds.length > 0 ? '#b91c1c' : 'var(--ink-muted)'} />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '22px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Last 30 Days — Revenue</p>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="18" height="10" style={{ display: 'block' }}><line x1="0" y1="5" x2="18" y2="5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" /></svg>Revenue
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="18" height="10" style={{ display: 'block' }}><line x1="0" y1="5" x2="18" y2="5" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round" /></svg>Refunds
            </span>
          </div>
        </div>
        <RevenueChart series={series} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '22px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '14px' }}>Orders by Status</p>
          {statusRows.length === 0 ? <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)' }}>No data yet.</p> : (
            <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusDonut rows={statusRows} total={totalOrders} />
              <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {statusRows.map(([s, c]) => {
                  const pct = (c / totalOrders) * 100;
                  const color = DONUT_COLORS[s] || '#94a3b8';
                  return (
                    <div key={s}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {s}
                        </span>
                        <span style={{ fontWeight: 500 }}>{c} <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--border-subtle)' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: color, opacity: 0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '22px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '14px' }}>Top Products (excl. cancelled)</p>
          {topProducts.length === 0 ? <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)' }}>No data yet.</p> : (() => {
            const maxRev = topProducts[0]?.[1].revenue || 1;
            return topProducts.map(([name, d], i) => (
              <div key={name} style={{ padding: '9px 0', borderBottom: i < topProducts.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-faint)', minWidth: 16 }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name} <span style={{ color: 'var(--ink-muted)', fontSize: '0.78rem' }}>× {d.qty}</span>
                  </span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, whiteSpace: 'nowrap' }}>₱{d.revenue.toLocaleString()}</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'var(--border-subtle)', marginLeft: 24 }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${(d.revenue / maxRev) * 100}%`, background: 'var(--accent)', opacity: 0.6 }} />
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

/* ─── Revenue line chart (last 30 days) ─── */
const REV_COLOR = '#22c55e';
const REF_COLOR = '#ef4444';

function RevenueChart({ series }) {
  const [hover, setHover] = useState(null);
  const W = 720, H = 220, PAD_L = 46, PAD_R = 16, PAD_T = 16, PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...series.map(s => Math.max(s.revenue, s.refunds)));
  const n = series.length;
  const stepX = n > 1 ? plotW / (n - 1) : plotW;

  const niceStep = (m) => {
    const pow = Math.pow(10, Math.floor(Math.log10(m)));
    const norm = m / pow;
    return (norm < 2 ? 0.5 : norm < 5 ? 1 : 2) * pow;
  };
  const step = niceStep(max);
  const ticks = [];
  for (let v = 0; v <= max + step; v += step) ticks.push(v);
  const yMax = ticks[ticks.length - 1];

  const xAt = (i) => PAD_L + i * stepX;
  const yAt = (v) => PAD_T + plotH - (v / yMax) * plotH;

  const pathFor = (getVal) => series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(getVal(s)).toFixed(2)}`).join(' ');
  const areaFor = (getVal) => {
    if (n === 0) return '';
    return `${pathFor(getVal)} L ${xAt(n - 1).toFixed(2)} ${yAt(0)} L ${xAt(0).toFixed(2)} ${yAt(0)} Z`;
  };
  const revPath = pathFor(s => s.revenue);
  const refPath = pathFor(s => s.refunds);
  const revArea = areaFor(s => s.revenue);
  const hasRefunds = series.some(s => s.refunds > 0);

  // x-axis: first + every ~7 days + last
  const xLabelIdxs = [0];
  for (let i = 7; i < n - 4; i += 7) xLabelIdxs.push(i);
  xLabelIdxs.push(n - 1);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const xInSvg = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round((xInSvg - PAD_L) / stepX);
          if (i >= 0 && i < n) setHover(i);
        }}
      >
        <defs>
          <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={REV_COLOR} stopOpacity="0.22" />
            <stop offset="100%" stopColor={REV_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines + y labels */}
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yAt(v)} y2={yAt(v)} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={PAD_L - 7} y={yAt(v) + 3.5} fontSize="9.5" textAnchor="end" fill="var(--ink-muted)">
              ₱{v >= 1000 ? `${Math.round(v / 1000)}k` : v}
            </text>
          </g>
        ))}
        {/* revenue area */}
        <path d={revArea} fill="url(#revGrad)" />
        {/* revenue line */}
        <path d={revPath} fill="none" stroke={REV_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* refunds line */}
        {hasRefunds && (
          <path d={refPath} fill="none" stroke={REF_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />
        )}
        {/* hover guide */}
        {hover != null && (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD_T} y2={PAD_T + plotH} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 3" />
        )}
        {/* data dots */}
        {series.map((s, i) => (
          <g key={i}>
            {s.revenue > 0 && <circle cx={xAt(i)} cy={yAt(s.revenue)} r={hover === i ? 4.5 : 3} fill={REV_COLOR} />}
            {s.refunds > 0 && <circle cx={xAt(i)} cy={yAt(s.refunds)} r={hover === i ? 4.5 : 3} fill={REF_COLOR} />}
          </g>
        ))}
        {/* x labels */}
        {xLabelIdxs.map(i => (
          <text key={i} x={xAt(i)} y={H - 6} fontSize="9.5"
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fill="var(--ink-muted)">
            {series[i].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
      {hover != null && (() => {
        const pct = (xAt(hover) / W) * 100;
        const clampedLeft = Math.min(Math.max(pct, 8), 92);
        return (
          <div style={{
            position: 'absolute', pointerEvents: 'none',
            left: `${clampedLeft}%`, top: 0,
            transform: 'translate(-50%, -110%)',
            background: 'var(--ink)', color: '#fff', fontSize: '0.72rem',
            padding: '7px 12px', borderRadius: 7, whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>
              {series[hover].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ color: REV_COLOR }}>₱{series[hover].revenue.toLocaleString()}</div>
            {series[hover].refunds > 0 && <div style={{ color: '#fca5a5' }}>Refunded: ₱{series[hover].refunds.toLocaleString()}</div>}
            <div style={{ color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              {series[hover].count} order{series[hover].count !== 1 ? 's' : ''}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ─── Status donut ─── */
const DONUT_COLORS = {
  Pending: '#f59e0b',
  Processing: '#3b82f6',
  Shipped: '#8b5cf6',
  Delivered: '#22c55e',
  Cancelled: '#ef4444',
};

function StatusDonut({ rows, total }) {
  const SIZE = 160, R = 64, CX = SIZE / 2, CY = SIZE / 2, STROKE = 22;
  let start = -Math.PI / 2;
  const GAP = 0.03; // small gap between segments
  const segs = rows.map(([s, c]) => {
    const frac = c / total;
    const span = Math.max(frac * 2 * Math.PI - GAP, 0.01);
    const end = start + span + GAP;
    const seg = { s, c, start: start + GAP / 2, end: start + GAP / 2 + span, color: DONUT_COLORS[s] || '#94a3b8' };
    start = end;
    return seg;
  });
  const arc = (a0, a1) => {
    const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
  };
  return (
    <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border-subtle)" strokeWidth={STROKE} />
      {segs.map((seg, i) => (
        <path key={i} d={arc(seg.start, seg.end)} stroke={seg.color} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      ))}
      <text x={CX} y={CY + 2} textAnchor="middle" fontFamily="'DM Serif Display', serif" fontSize="24" fill="var(--ink)">{total}</text>
      <text x={CX} y={CY + 16} textAnchor="middle" fontSize="9" fill="var(--ink-muted)" letterSpacing="0.1em">ORDERS</text>
    </svg>
  );
}

function StatTile({ label, value, sub, subColor, accent }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      padding: '14px 16px', borderLeft: accent ? '3px solid var(--accent)' : undefined, minWidth: 0,
    }}>
      <p style={{ fontSize: '0.63rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 5 }}>{label}</p>
      <p style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: accent ? '1.55rem' : '1.35rem',
        letterSpacing: '-0.02em', lineHeight: 1.15,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</p>
      {sub && <p style={{ fontSize: '0.7rem', color: subColor || 'var(--ink-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>}
    </div>
  );
}

function OrderRow({ order, fetchOrders, updateOrderLocal, typeTag }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const updateStatus = async (newStatus) => {
    const prev = order.status;
    setUpdating(true);
    if (updateOrderLocal) updateOrderLocal(order._id, { status: newStatus });
    try { await apiFetch(`/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }); toast.success(`Status updated to ${newStatus}`); }
    catch (err) {
      if (updateOrderLocal) updateOrderLocal(order._id, { status: prev });
      else fetchOrders?.();
      toast.error(err.message);
    }
    finally { setUpdating(false); }
  };
  const generateAddLink = async (payload) => {
    try {
      const res = await apiFetch('/orders/admin/add-link', { method: 'POST', body: JSON.stringify(payload) });
      // Server may return a relative path if CLIENT_URL env var is unset — anchor it to this app's origin.
      const fullUrl = /^https?:\/\//i.test(res.url) ? res.url : `${window.location.origin}${res.url.startsWith('/') ? '' : '/'}${res.url}`;
      try { await navigator.clipboard.writeText(fullUrl); toast.success('Add-link copied to clipboard'); }
      catch { window.prompt('Copy the add-to-order link:', fullUrl); }
    } catch (err) { toast.error(err.message); }
  };
  const updateItemStatus = async (itemId, newStatus) => {
    setUpdatingItemId(itemId);
    try {
      const res = await apiFetch(`/orders/${order._id}/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      // Server recalculates total + item statuses; sync the whole order locally
      if (res.order && updateOrderLocal) updateOrderLocal(order._id, res.order);
      else fetchOrders?.();
      toast.success(newStatus === 'Cancelled' ? 'Item cancelled — stock restored' : `Item → ${newStatus}`);
    } catch (err) { toast.error(err.message); fetchOrders?.(); }
    finally { setUpdatingItemId(null); }
  };
  const customer = order.userId;
  const name = typeof customer === 'object' ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Unknown';
  const email = typeof customer === 'object' ? customer.email : '';
  const orderNum = order._id.slice(-8).toUpperCase();
  const ship = order.shippingAddress;
  const bill = order.billingAddress;
  const billSameAsShip = !bill || !ship || (
    bill.fullName === ship.fullName && bill.phone === ship.phone &&
    bill.street === ship.street && bill.city === ship.city && bill.province === ship.province
  );
  const items = order.productsOrdered || [];
  const activeItems = items.filter(p => p.status !== 'Cancelled');
  const cancelledItems = items.filter(p => p.status === 'Cancelled');
  const subtotal = activeItems.reduce((n, p) => n + (p.subtotal || 0), 0);
  const cancelledTotal = cancelledItems.reduce((n, p) => n + (p.subtotal || 0), 0);
  const originalSubtotal = items.reduce((n, p) => n + (p.subtotal || 0), 0);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr auto auto',
          gap: '20px', alignItems: 'center',
          padding: '16px 22px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--ink)',
        }}
        className="admin-order-header"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--ink-muted)' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Order</p>
            {typeTag && <span className={`status-badge ${typeTag.className || 'status-amber'}`} style={{ fontSize: '0.55rem', padding: '2px 6px', letterSpacing: '0.04em' }}>{typeTag.label}</span>}
          </div>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.95rem', marginTop: 2 }}>{orderNum}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Customer</p>
          <p style={{ fontSize: '0.88rem', fontWeight: 500, marginTop: 2 }}>{name || '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Date</p>
          <p style={{ fontSize: '0.88rem', marginTop: 2 }}>{new Date(order.createdAt).toLocaleDateString()}</p>
        </div>
        <StatusBadge status={order.status} />
        <span style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>₱{order.totalPrice?.toLocaleString()}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '20px 24px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '18px' }}>
            <Detail label="Email" value={email || '—'} />
            <Detail label="Order ID" value={order._id} mono />
            <Detail label="Payment status" value={order.paymentStatus || 'n/a'} />
            <Detail label="Placed" value={new Date(order.createdAt).toLocaleString()} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }} className="admin-order-addresses">
            <AddressBlock title="Shipping Address" addr={ship} />
            <AddressBlock title="Billing Address" addr={billSameAsShip ? null : bill} sameAsShipping={billSameAsShip} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: 8 }}>
              <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Products ({items.length})</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => generateAddLink({ type: 'order', orderId: order._id })}
                  style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Send Add-Link to Customer
                </button>
                <button type="button" onClick={() => setShowAddItem(true)}
                  style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  + Add Item Directly
                </button>
              </div>
            </div>
            {showAddItem && (
              <AddProductToOrder orderId={order._id} onClose={() => setShowAddItem(false)} onAdded={(updated) => { setShowAddItem(false); if (updated && updateOrderLocal) updateOrderLocal(order._id, updated); else fetchOrders?.(); }} />
            )}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {items.map((item, i) => {
                const cancelled = item.status === 'Cancelled';
                return (
                  <div key={item._id || i} style={{ padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', opacity: cancelled ? 0.55 : 1, background: cancelled ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.02) 8px, rgba(0,0,0,0.02) 16px)' : 'transparent' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.86rem', minWidth: 0, textDecoration: cancelled ? 'line-through' : 'none' }}>
                        {item.addedAfterPurchase && (
                          <span className="status-badge status-green" style={{ fontSize: '0.58rem', padding: '2px 7px', marginRight: 8 }}>Added</span>
                        )}
                        {item.productName} <span style={{ color: 'var(--ink-muted)' }}>× {item.quantity}</span>
                      </span>
                      <select value={item.status || 'Pending'} onChange={e => updateItemStatus(item._id, e.target.value)}
                        disabled={updatingItemId === item._id || !item._id}
                        className={`status-select status-${statusPaletteKey(item.status || 'Pending')}`}
                        style={{ fontSize: '0.74rem' }}>
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span style={{ fontWeight: 500, textDecoration: cancelled ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>₱{item.subtotal?.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.86rem' }}>
                {cancelledTotal > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-muted)' }}>
                      <span>Original subtotal</span>
                      <span style={{ textDecoration: 'line-through' }}>₱{originalSubtotal.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-muted)' }}>
                      <span>Cancelled</span>
                      <span>−₱{cancelledTotal.toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>Subtotal</span>
                  <span>₱{subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>Shipping ({order.shippingRegion || '—'})</span>
                  <span>₱{(order.shippingFee || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.95rem', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                  <span>Total</span>
                  <span>₱{order.totalPrice?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Order status:</span>
            <select value={order.status} onChange={e => updateStatus(e.target.value)} disabled={updating} className="form-input" style={{ fontSize: '0.8rem', padding: '6px 10px', width: 'auto', borderRadius: 'var(--radius-pill)', cursor: 'pointer' }}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
      <style>{`
        .admin-order-header:hover { background: var(--bg-secondary) !important; }
        @media (max-width: 820px) {
          .admin-order-header { grid-template-columns: auto 1fr !important; row-gap: 8px !important; }
          .admin-order-addresses { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function AddProductToOrder({ orderId, onClose, onAdded }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [variantId, setVariantId] = useState('');
  const [configs, setConfigs] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch('/products/active').then(d => setProducts(Array.isArray(d) ? d : (d.products || []))).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);

  const filteredProducts = search
    ? products.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()))
    : products;

  const picked = products.find(p => p._id === pickedId);

  useEffect(() => {
    if (!picked) { setSelectedOption(null); setVariantId(''); setConfigs({}); return; }
    if (picked.useVariants && picked.variants?.length > 0) {
      const v = picked.variants.find(x => x.available !== false);
      setVariantId(v?._id || '');
    } else if (picked.options?.length > 0) {
      const grp = picked.options[0];
      const val = grp.values?.find(v => v.available !== false);
      if (val) setSelectedOption({ groupId: grp._id, groupName: grp.name, valueId: val._id, value: val.value, price: val.price });
    }
    const initialCfg = {};
    (picked.configurations || []).forEach(c => {
      const first = c.options?.find(o => o.available !== false);
      if (first) initialCfg[c.name] = first.value;
    });
    setConfigs(initialCfg);
  }, [pickedId, picked]);

  const submit = async () => {
    if (!picked || submitting) return;
    setSubmitting(true);
    try {
      const configurations = Object.entries(configs).map(([name, selected]) => ({ name, selected }));
      const body = {
        productId: pickedId,
        quantity: Math.max(1, Number(quantity) || 1),
        configurations,
      };
      if (picked.useVariants && variantId) body.variantId = variantId;
      if (selectedOption?.groupId) body.selectedOption = selectedOption;
      const res = await apiFetch(`/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify(body) });
      toast.success('Item added to order');
      onAdded?.(res.order);
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: '0.86rem', fontWeight: 600 }}>Add Product to Order</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>

      <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
        className="form-input" style={{ marginBottom: 10 }} />

      {loading ? <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
        <div className="form-group">
          <label className="form-label">Product</label>
          <select className="form-input" value={pickedId} onChange={e => setPickedId(e.target.value)}>
            <option value="">— Pick a product —</option>
            {filteredProducts.map(p => <option key={p._id} value={p._id}>{p.name} {p.useVariants ? '(variants)' : p.options?.length > 0 ? '(options)' : ''}</option>)}
          </select>
        </div>
      )}

      {picked?.useVariants && picked.variants?.length > 0 && (
        <div className="form-group">
          <label className="form-label">Variant</label>
          <select className="form-input" value={variantId} onChange={e => setVariantId(e.target.value)}>
            {picked.variants.filter(v => v.available !== false).map(v => {
              const attrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : (v.attributes || {});
              const label = Object.entries(attrs).map(([k, vv]) => `${k}: ${vv}`).join(', ');
              return <option key={v._id} value={v._id}>{label} — ₱{(v.price ?? picked.price)?.toLocaleString()}</option>;
            })}
          </select>
        </div>
      )}

      {picked && !picked.useVariants && picked.options?.length > 0 && (
        <div className="form-group">
          <label className="form-label">Option</label>
          <select className="form-input" value={selectedOption?.valueId || ''} onChange={e => {
            for (const grp of picked.options) {
              const val = grp.values?.find(v => v._id === e.target.value);
              if (val) { setSelectedOption({ groupId: grp._id, groupName: grp.name, valueId: val._id, value: val.value, price: val.price }); break; }
            }
          }}>
            {picked.options.flatMap(grp => (grp.values || []).filter(v => v.available !== false).map(v => (
              <option key={v._id} value={v._id}>{grp.name}: {v.value} — ₱{v.price?.toLocaleString()}</option>
            )))}
          </select>
        </div>
      )}

      {(picked?.configurations || []).map(cfg => (
        <div key={cfg.name} className="form-group">
          <label className="form-label">{cfg.name}</label>
          <select className="form-input" value={configs[cfg.name] || ''} onChange={e => setConfigs(c => ({ ...c, [cfg.name]: e.target.value }))}>
            {(cfg.options || []).filter(o => o.available !== false).map(o => (
              <option key={o.value} value={o.value}>{o.value}{o.priceModifier > 0 ? ` (+₱${o.priceModifier})` : ''}</option>
            ))}
          </select>
        </div>
      ))}

      {picked && (
        <div className="form-group">
          <label className="form-label">Quantity</label>
          <input type="number" min="1" className="form-input" value={quantity} onChange={e => setQuantity(e.target.value)} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={submit} disabled={!pickedId || submitting} className="btn-dark" style={{ padding: '8px 18px', fontSize: '0.82rem' }}>
          <span>{submitting ? 'Adding…' : 'Add to Order'}</span>
        </button>
        <button onClick={onClose} className="btn-outline" style={{ padding: '8px 18px', fontSize: '0.82rem' }}>Cancel</button>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div>
      <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '0.86rem', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value || '—'}</p>
    </div>
  );
}

function AddressBlock({ title, addr, sameAsShipping }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
      <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>{title}</p>
      {sameAsShipping ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>Same as shipping address</p>
      ) : addr ? (
        <>
          <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{addr.fullName || '—'}</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>{addr.phone || '—'}</p>
          <p style={{ fontSize: '0.84rem', marginTop: 6, lineHeight: 1.5 }}>
            {addr.street || '—'}<br />
            {[addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ') || '—'}
          </p>
        </>
      ) : (
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>No address recorded</p>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   CREATE PRODUCT MODAL
═══════════════════════════════════════════════ */
function CreateProductModal({ onClose, onCreated, forcedParentId, forcedParentName }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', stocks: '', category: '' });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [urlInputCreate, setUrlInputCreate] = useState('');
  const [urlPreviews, setUrlPreviews] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [descPreview, setDescPreview] = useState(false);

  // Option group builder state
  const [newOptGroup, setNewOptGroup] = useState({ name: '' });
  const [newOptValues, setNewOptValues] = useState({});

  // Variants state — dimensions + per-combination stock/price.
  // Two modes:
  //  • matrix → cartesian product auto-generated, bulk-fill helps fill the grid.
  //  • list   → admin manually adds the SKUs that actually exist; no shadow rows.
  const [variantMode, setVariantMode] = useState('matrix'); // 'matrix' | 'list'
  const [variantDimensions, setVariantDimensions] = useState([]); // [{ name, values: [] }]
  const [newDim, setNewDim] = useState({ name: '', values: '' });
  const [variantRows, setVariantRows] = useState([]); // [{ attrs: {dim:val}, stock, price }]
  const [bulkStock, setBulkStock] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');

  // Auto-generate cartesian product in matrix mode; in list mode, leave rows alone
  // and only prune values that no longer exist on a dimension.
  useEffect(() => {
    if (variantMode === 'list') {
      // Drop rows that reference values that no longer exist on a dimension.
      setVariantRows(prev => prev.filter(r => variantDimensions.every(d =>
        !r.attrs[d.name] || d.values.includes(r.attrs[d.name])
      )));
      return;
    }
    if (variantDimensions.length === 0) { setVariantRows([]); return; }
    const combos = variantDimensions.reduce(
      (acc, d) => acc.flatMap(a => d.values.map(v => ({ ...a, [d.name]: v }))),
      [{}]
    );
    setVariantRows(prev => combos.map(attrs => {
      const matchKey = JSON.stringify(attrs);
      const existing = prev.find(r => JSON.stringify(r.attrs) === matchKey);
      return existing || { attrs, stock: '', price: '' };
    }));
  }, [variantDimensions, variantMode]);

  // Switching modes: matrix→list keeps existing rows as-is; list→matrix regenerates.
  const switchVariantMode = (mode) => {
    if (mode === variantMode) return;
    setVariantMode(mode);
    if (mode === 'matrix' && variantDimensions.length > 0) {
      // useEffect will rebuild the grid, merging any rows that already match
    }
  };

  // List mode: append a blank SKU using the first available value per dimension.
  const addListVariant = () => {
    if (variantDimensions.length === 0) {
      toast.error('Add at least one dimension first.');
      return;
    }
    const attrs = {};
    for (const d of variantDimensions) attrs[d.name] = d.values[0] || '';
    setVariantRows(rows => [...rows, { attrs, stock: '', price: '' }]);
  };
  const updateListVariantAttr = (idx, dimName, val) => {
    setVariantRows(rows => rows.map((r, i) => i === idx ? { ...r, attrs: { ...r.attrs, [dimName]: val } } : r));
  };
  const removeListVariant = (idx) => setVariantRows(rows => rows.filter((_, i) => i !== idx));

  const addDimension = () => {
    const name = newDim.name.trim();
    const values = newDim.values.split(',').map(s => s.trim()).filter(Boolean);
    if (!name || values.length === 0) return;
    setVariantDimensions(d => [...d, { name, values }]);
    setNewDim({ name: '', values: '' });
  };
  const removeDimension = (di) => setVariantDimensions(d => d.filter((_, i) => i !== di));
  const updateVariantField = (idx, field, val) => setVariantRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  const applyBulkStock = () => {
    if (bulkStock === '') return;
    setVariantRows(rows => rows.map(r => ({ ...r, stock: bulkStock })));
  };
  const applyBulkPrice = () => {
    if (bulkPrice === '') return;
    setVariantRows(rows => rows.map(r => ({ ...r, price: bulkPrice })));
  };
  const clearBulkStock = () => setVariantRows(rows => rows.map(r => ({ ...r, stock: '' })));
  const clearBulkPrice = () => setVariantRows(rows => rows.map(r => ({ ...r, price: '' })));

  const importVariantsJson = () => {
    try {
      const data = JSON.parse(jsonImportText);
      const dims = Array.isArray(data.dimensions) ? data.dimensions
        .filter(d => d && d.name && Array.isArray(d.values))
        .map(d => ({ name: String(d.name).trim(), values: d.values.map(v => String(v).trim()).filter(Boolean) }))
        : [];
      if (dims.length === 0) {
        toast.error('JSON must include a non-empty "dimensions" array.');
        return;
      }
      setVariantDimensions(dims);
      const incoming = Array.isArray(data.variants) ? data.variants : [];

      if (variantMode === 'list') {
        // List mode: only import the SKUs listed; ignore unspecified combinations entirely.
        const rows = incoming.map(v => {
          const attrs = {};
          for (const d of dims) attrs[d.name] = String(v?.attributes?.[d.name] ?? '');
          return {
            attrs,
            stock: v.stock === -1 || v.stock == null ? '' : String(v.stock),
            price: v.price == null ? '' : String(v.price),
          };
        });
        setVariantRows(rows);
        setShowJsonImport(false);
        setJsonImportText('');
        toast.success(`Imported ${dims.length} dimension${dims.length === 1 ? '' : 's'} and ${rows.length} SKU${rows.length === 1 ? '' : 's'}.`);
        return;
      }

      // Matrix mode: build full cartesian product and merge incoming values.
      const combos = dims.reduce(
        (acc, d) => acc.flatMap(a => d.values.map(v => ({ ...a, [d.name]: v }))),
        [{}]
      );
      const findIncoming = (attrs) => incoming.find(v => {
        const va = v?.attributes || {};
        return dims.every(d => va[d.name] === attrs[d.name]);
      });
      setVariantRows(combos.map(attrs => {
        const m = findIncoming(attrs);
        if (!m) return { attrs, stock: '', price: '' };
        return {
          attrs,
          stock: m.stock === -1 || m.stock == null ? '' : String(m.stock),
          price: m.price == null ? '' : String(m.price),
        };
      }));
      setShowJsonImport(false);
      setJsonImportText('');
      toast.success(`Imported ${dims.length} dimension${dims.length === 1 ? '' : 's'} and ${combos.length} variant${combos.length === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error('Invalid JSON: ' + (err.message || 'parse error'));
    }
  };

  const sampleVariantJson = JSON.stringify({
    dimensions: [
      { name: 'Color', values: ['Red', 'Blue'] },
      { name: 'Size', values: ['S', 'M', 'L'] }
    ],
    variants: [
      { attributes: { Color: 'Red', Size: 'S' }, stock: 10, price: 0 },
      { attributes: { Color: 'Red', Size: 'M' }, stock: 5, price: 0 },
      { attributes: { Color: 'Blue', Size: 'L' }, stock: 8, price: 50 }
    ]
  }, null, 2);

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.dataset.enterAction) {
      e.preventDefault();
      const formElements = Array.from(e.currentTarget.querySelectorAll('input, textarea, select'));
      const idx = formElements.indexOf(e.target);
      if (idx > -1 && idx < formElements.length - 1) {
        formElements[idx + 1].focus();
      }
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...files.map(f => ({ name: f.name, url: URL.createObjectURL(f) }))]);
    e.target.value = '';
  };
  const removeImagePreview = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };
  const addUrlPreview = () => {
    const url = urlInputCreate.trim(); if (!url) return;
    setUrlPreviews(prev => [...prev, { url }]); setUrlInputCreate('');
  };
  const removeUrlPreview = (idx) => setUrlPreviews(prev => prev.filter((_, i) => i !== idx));

  // Option group helpers
  const addOptGroup = () => {
    if (!newOptGroup.name.trim()) return;
    const idx = optionGroups.length;
    setOptionGroups(g => [...g, { name: newOptGroup.name.trim(), values: [] }]);
    setNewOptValues(v => ({ ...v, [idx]: { value: '', price: '', stocks: '', imageUrl: '' } }));
    setNewOptGroup({ name: '' });
  };
  const addOptValue = (gi) => {
    const nv = newOptValues[gi];
    if (!nv?.value?.trim() || nv.price === '' || nv.stocks === '' || nv.stocks == null) return;
    setOptionGroups(g => g.map((grp, i) => i !== gi ? grp : {
      ...grp, values: [...grp.values, {
        value: nv.value.trim(), price: Number(nv.price) || 0, available: true,
        stocks: Number(nv.stocks),
        image: { url: nv.imageUrl?.trim() || '', altText: nv.value.trim() }
      }]
    }));
    setNewOptValues(v => ({ ...v, [gi]: { value: '', price: '', stocks: '', imageUrl: '' } }));
  };

  const submitProduct = async (queued) => {
    setSubmitting(true);
    try {
      const product = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: Number(form.price) || 0,
          stocks: form.stocks === '' || form.stocks == null ? -1 : Number(form.stocks),
          category: form.category,
          isQueued: !!queued,
          ...(forcedParentId ? { parentProductId: forcedParentId } : {}),
        })
      });

      if (images.length > 0) {
        const fd = new FormData();
        images.forEach(f => fd.append('images', f));
        await apiFetch(`/products/${product._id}/images`, { method: 'POST', body: fd });
      }

      for (const up of urlPreviews) {
        await apiFetch(`/products/${product._id}/images/add-url`, {
          method: 'POST', body: JSON.stringify({ url: up.url }),
        });
      }

      const filteredSpecs = specs.filter(s => s.label.trim() && s.value.trim());
      const buildVariants = () => {
        if (variantDimensions.length === 0) return null;
        // List mode: drop rows missing any attribute value (incomplete SKUs).
        const usable = variantMode === 'list'
          ? variantRows.filter(r => variantDimensions.every(d => r.attrs[d.name]))
          : variantRows;
        if (variantMode === 'list' && usable.length === 0) return null;
        const variants = usable.map(r => ({
          attributes: r.attrs,
          stock: r.stock === '' ? -1 : Number(r.stock),
          price: r.price === '' ? null : Number(r.price),
          available: true,
        }));
        return { useVariants: true, variantDimensions, variants };
      };
      const variantPayload = buildVariants();
      if (optionGroups.length > 0 || filteredSpecs.length > 0 || variantPayload) {
        await apiFetch(`/products/${product._id}/update`, {
          method: 'PATCH',
          body: JSON.stringify({
            options: optionGroups,
            specifications: filteredSpecs,
            ...(variantPayload || {}),
          })
        });
      }

      toast.success(queued ? 'Product queued' : 'Product created');
      onCreated();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitProduct(false);
  };

  const inputSm = { fontSize: '0.78rem', padding: '7px 9px' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-body" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{forcedParentId ? 'New Add-on' : 'New Product'}</h2>
        <p className="modal-subtitle">
          {forcedParentId
            ? <>This add-on will be tied to <strong>{forcedParentName}</strong> and hidden from the main product list.</>
            : 'Add a new in-stock product to your catalog.'}
        </p>

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
          {/* Basic Info */}
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" required value={form.name} onChange={set('name')} placeholder="e.g. GMK Olivia" />
          </div>

          {/* Rich text description */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Description</label>
              <button type="button" onClick={() => setDescPreview(p => !p)} style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {descPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {descPreview ? (
              <div style={{ minHeight: 80, padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.9rem', lineHeight: 1.75 }}>
                {form.description ? <RichText content={form.description} /> : <span style={{ color: 'var(--ink-faint)' }}>No description yet.</span>}
              </div>
            ) : (
              <>
                <textarea className="form-input" required value={form.description} onChange={set('description')}
                  style={{ minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  placeholder="Describe the product...&#10;&#10;Tip: Use **bold**, *italic*, # Heading, or - bullet points for rich formatting." />
                <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: '4px' }}>
                  Markdown: **bold** · *italic* · # Heading · - bullet · blank line = new paragraph
                </p>
              </>
            )}
          </div>

          <div className="modal-row-3">
            <div className="form-group">
              <label className="form-label">Price (₱)</label>
              <input type="number" className="form-input" min="0" value={form.price} onChange={set('price')} placeholder="Foundation; options/variants add on top" />
            </div>
            <div className="form-group">
              <label className="form-label">Stock <span style={{ fontWeight: 400, color: 'var(--ink-faint)', fontSize: '0.7rem' }}>— optional</span></label>
              <input type="number" className="form-input" min="0" value={form.stocks} onChange={set('stocks')} placeholder="Leave blank if unlimited or set per option/variant" />
            </div>
            <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={form.category} onChange={set('category')} placeholder="keyboards" /></div>
          </div>

          {/* Images */}
          <div className="modal-section">
            <p className="modal-section-title">Images</p>
            <div className="img-upload-zone">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p>Click or drag to upload images (max 10MB each)</p>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
            </div>
            {imagePreviews.length > 0 && (
              <div className="img-preview-row">
                {imagePreviews.map((p, i) => (
                  <div key={i} className="img-preview-thumb" style={{ position: 'relative' }}>
                    <img src={p.url} alt={p.name} />
                    <button type="button" onClick={() => removeImagePreview(i)} style={{
                      position: 'absolute', top: 3, right: 3, width: 18, height: 18,
                      borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', lineHeight: 1
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <input className="form-input" style={{ fontSize: '0.78rem', padding: '6px 9px', flex: 1 }}
                placeholder="Or paste image URL..." value={urlInputCreate}
                onChange={e => setUrlInputCreate(e.target.value)}
                data-enter-action="custom"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrlPreview(); } }} />
              <button type="button" onClick={addUrlPreview} disabled={!urlInputCreate.trim()}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif", opacity: !urlInputCreate.trim() ? 0.5 : 1 }}>
                + Add URL
              </button>
            </div>
            {urlPreviews.length > 0 && (
              <div className="img-preview-row" style={{ marginTop: '8px' }}>
                {urlPreviews.map((p, i) => (
                  <div key={i} className="img-preview-thumb" style={{ position: 'relative' }}>
                    <img src={p.url} alt="" />
                    <button type="button" onClick={() => removeUrlPreview(i)} style={{
                      position: 'absolute', top: 3, right: 3, width: 18, height: 18,
                      borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem'
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Specifications */}
          <div className="modal-section">
            <p className="modal-section-title">Specifications</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Optional. Add custom spec rows shown on the product page (e.g. Layout → 65%, Weight → 1.2kg).
            </p>
            {specs.map((spec, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', marginBottom: '6px' }}>
                <input className="form-input" style={inputSm} placeholder="Label (e.g. Layout)"
                  value={spec.label}
                  onChange={e => setSpecs(s => s.map((r, j) => j !== i ? r : { ...r, label: e.target.value }))} />
                <input className="form-input" style={inputSm} placeholder="Value (e.g. 65%, hotswap)"
                  value={spec.value}
                  onChange={e => setSpecs(s => s.map((r, j) => j !== i ? r : { ...r, value: e.target.value }))} />
                <button type="button" onClick={() => setSpecs(s => s.filter((_, j) => j !== i))}
                  style={{ padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}>✕</button>
              </div>
            ))}
            <button type="button"
              onClick={() => setSpecs(s => [...s, { label: '', value: '' }])}
              style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '5px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              + Add Specification
            </button>
          </div>

          {/* Add Options */}
          <div className="modal-section">
            <p className="modal-section-title">Add Options</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Each option's price is <strong>added on top of the base price</strong> above (e.g. base ₱5,000 + Novelties +₱2,300 = ₱7,300).
              Leave this section empty if the product has a single price.
            </p>

            {optionGroups.map((grp, gi) => (
              <div key={gi} style={{ marginBottom: '10px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{grp.name}</span>
                  <button type="button" onClick={() => setOptionGroups(g => g.filter((_, i) => i !== gi))} style={{ fontSize: '0.7rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                </div>
                {grp.values.map((v, vi) => (
                  <div key={vi} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.78rem' }}>
                    <span style={{ flex: 1 }}>{v.value}</span>
                    <span style={{ color: 'var(--ink-muted)' }}>{v.price > 0 ? `+₱${v.price.toLocaleString()}` : 'base'}</span>
                    <span style={{ color: 'var(--ink-muted)', fontSize: '0.72rem' }}>· {v.stocks} stock</span>
                    {v.image?.url && <span style={{ color: 'var(--accent)', fontSize: '0.68rem' }}>📷</span>}
                    <button type="button" onClick={() => setOptionGroups(g => g.map((gg, i) => i !== gi ? gg : { ...gg, values: gg.values.filter((_, j) => j !== vi) }))} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 1fr auto', gap: '5px', marginTop: '6px' }}>
                  <input className="form-input" style={inputSm} placeholder="Value (e.g. Base Kit)"
                    value={newOptValues[gi]?.value || ''}
                    onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), value: e.target.value } }))} />
                  <input type="number" className="form-input" style={inputSm} placeholder="+ ₱"
                    value={newOptValues[gi]?.price || ''}
                    onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), price: e.target.value } }))} />
                  <input type="number" className="form-input" style={inputSm} placeholder="Stock" min="0"
                    value={newOptValues[gi]?.stocks ?? ''}
                    onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), stocks: e.target.value } }))} />
                  <input className="form-input" style={inputSm} placeholder="Image URL (optional)"
                    value={newOptValues[gi]?.imageUrl || ''}
                    onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: e.target.value } }))} />
                  <button type="button" onClick={() => addOptValue(gi)} className="config-add-btn">+</button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="form-input" style={inputSm} placeholder="Option group name (e.g. Kit)"
                value={newOptGroup.name} onChange={e => setNewOptGroup({ name: e.target.value })}
                data-enter-action="custom"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOptGroup(); } }} />
              <button type="button" onClick={addOptGroup} className="config-add-btn">+ Add Group</button>
            </div>
          </div>

          {/* Variants */}
          <div className="modal-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
              <p className="modal-section-title" style={{ margin: 0 }}>Variants</p>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', fontSize: '0.7rem' }}>
                  <button type="button" onClick={() => switchVariantMode('matrix')}
                    style={{ padding: '4px 10px', background: variantMode === 'matrix' ? 'var(--accent)' : 'transparent', color: variantMode === 'matrix' ? '#fff' : 'var(--ink-muted)', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    Matrix
                  </button>
                  <button type="button" onClick={() => switchVariantMode('list')}
                    style={{ padding: '4px 10px', background: variantMode === 'list' ? 'var(--accent)' : 'transparent', color: variantMode === 'list' ? '#fff' : 'var(--ink-muted)', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    List
                  </button>
                </div>
                <button type="button" onClick={() => setShowJsonImport(s => !s)}
                  style={{ fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {showJsonImport ? 'Cancel import' : '↓ Import JSON'}
                </button>
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              {variantMode === 'matrix'
                ? <>Every combination of dimensions auto-generates as a row. Use bulk-fill when most rows share the same value, then override exceptions. Leave stock blank for unlimited; leave price blank for base price.</>
                : <>List only the SKUs you actually stock. Add a row, pick its dimension values, set stock + price. Combinations not listed simply don't exist for the customer. Best when most combinations don't apply.</>
              }
              {' '}Prices are <strong>added on top of the base price</strong>.
            </p>

            {showJsonImport && (
              <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', margin: '0 0 6px' }}>
                  Paste JSON with <code>dimensions</code> + <code>variants</code> arrays. Existing rows are replaced.
                </p>
                <textarea className="form-input" value={jsonImportText}
                  onChange={e => setJsonImportText(e.target.value)}
                  placeholder={sampleVariantJson}
                  style={{ minHeight: 140, fontFamily: 'monospace', fontSize: '0.74rem', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button type="button" onClick={importVariantsJson} disabled={!jsonImportText.trim()}
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif", opacity: !jsonImportText.trim() ? 0.5 : 1 }}>
                    Apply JSON
                  </button>
                  <button type="button" onClick={() => setJsonImportText(sampleVariantJson)}
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif" }}>
                    Insert sample
                  </button>
                </div>
              </div>
            )}

            {variantDimensions.map((d, di) => (
              <div key={di} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                <span style={{ color: 'var(--ink-muted)', flex: 1 }}>{d.values.join(', ')}</span>
                <button type="button" onClick={() => removeDimension(di)} style={{ fontSize: '0.7rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '6px', marginBottom: '12px' }}>
              <input className="form-input" style={inputSm} placeholder="Dimension (e.g. Color)"
                value={newDim.name} onChange={e => setNewDim(d => ({ ...d, name: e.target.value }))}
                data-enter-action="custom"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDimension(); } }} />
              <input className="form-input" style={inputSm} placeholder="Values, comma-separated (e.g. Red, Blue, Green)"
                value={newDim.values} onChange={e => setNewDim(d => ({ ...d, values: e.target.value }))}
                data-enter-action="custom"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDimension(); } }} />
              <button type="button" onClick={addDimension} className="config-add-btn">+ Add Dimension</button>
            </div>

            {variantMode === 'matrix' && variantRows.length > 0 && (
              <>
                {/* Bulk-fill controls — apply one value to every row at once */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', padding: '8px 10px', marginBottom: '8px', background: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem' }}>
                  <span style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>Bulk fill:</span>
                  <input type="number" min="0" placeholder="Stock" className="form-input"
                    style={{ ...inputSm, width: 80 }}
                    value={bulkStock} onChange={e => setBulkStock(e.target.value)}
                    data-enter-action="custom"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyBulkStock(); } }} />
                  <button type="button" onClick={applyBulkStock} disabled={bulkStock === ''}
                    style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.72rem', opacity: bulkStock === '' ? 0.5 : 1 }}>
                    Apply stock
                  </button>
                  <button type="button" onClick={clearBulkStock}
                    style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.72rem' }}>
                    Clear stock
                  </button>
                  <span style={{ width: 1, height: 16, background: 'var(--border)' }} />
                  <input type="number" min="0" placeholder="+ ₱" className="form-input"
                    style={{ ...inputSm, width: 80 }}
                    value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                    data-enter-action="custom"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyBulkPrice(); } }} />
                  <button type="button" onClick={applyBulkPrice} disabled={bulkPrice === ''}
                    style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.72rem', opacity: bulkPrice === '' ? 0.5 : 1 }}>
                    Apply price
                  </button>
                  <button type="button" onClick={clearBulkPrice}
                    style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.72rem' }}>
                    Clear price
                  </button>
                </div>
              </>
            )}

            {(variantRows.length > 0 || variantMode === 'list') && variantDimensions.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {variantDimensions.map(d => (
                        <th key={d.name} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>{d.name}</th>
                      ))}
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>Stock</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>+ Price (₱)</th>
                      {variantMode === 'list' && <th style={{ width: 28 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {variantRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {variantDimensions.map(d => (
                          <td key={d.name} style={{ padding: '6px 8px' }}>
                            {variantMode === 'list' ? (
                              <select className="form-input" style={{ ...inputSm, width: 'auto', minWidth: 90 }}
                                value={row.attrs[d.name] || ''}
                                onChange={e => updateListVariantAttr(idx, d.name, e.target.value)}>
                                <option value="">—</option>
                                {d.values.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            ) : row.attrs[d.name]}
                          </td>
                        ))}
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" min="0" placeholder={variantMode === 'list' ? '∞' : 'Use base'} className="form-input" style={{ ...inputSm, width: 80 }}
                            value={row.stock}
                            onChange={e => updateVariantField(idx, 'stock', e.target.value)} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" min="0" placeholder="0" className="form-input" style={{ ...inputSm, width: 100 }}
                            value={row.price}
                            onChange={e => updateVariantField(idx, 'price', e.target.value)} />
                        </td>
                        {variantMode === 'list' && (
                          <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                            <button type="button" onClick={() => removeListVariant(idx)}
                              style={{ fontSize: '0.7rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {variantMode === 'list' && variantDimensions.length > 0 && (
              <button type="button" onClick={addListVariant}
                style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '5px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                + Add Variant
              </button>
            )}
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-dark" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
              <span>{submitting ? 'Creating...' : (forcedParentId ? 'Create Add-on' : 'Create Product')}</span>
            </button>
            <button type="button" className="btn-outline" disabled={submitting} onClick={() => submitProduct(true)} title="Save as draft, hidden from customers">
              <span>{submitting ? '…' : 'Queue'}</span>
            </button>
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   RICH TEXT RENDERER
   Renders markdown-like syntax to styled JSX.
   Supported: # heading, **bold**, *italic*, - bullet, blank lines
═══════════════════════════════════════════════ */
export function RichText({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let bulletBuffer = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={key++} style={{ margin: '0 0 12px 0', paddingLeft: '20px', lineHeight: 1.75 }}>
        {bulletBuffer.map((b, i) => <li key={i}>{parseInline(b)}</li>)}
      </ul>
    );
    bulletBuffer = [];
  };

  const parseInline = (text) => {
    const parts = [];
    let remaining = text;
    let idx = 0;
    // Bold: **text**
    remaining = remaining.replace(/\*\*(.+?)\*\*/g, (_, m) => `\x00b${m}\x00`);
    // Italic: *text*
    remaining = remaining.replace(/\*(.+?)\*/g, (_, m) => `\x00i${m}\x00`);

    const chunks = remaining.split('\x00');
    return chunks.map((chunk, ci) => {
      if (chunk.startsWith('b')) return <strong key={ci}>{chunk.slice(1)}</strong>;
      if (chunk.startsWith('i')) return <em key={ci}>{chunk.slice(1)}</em>;
      return chunk;
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushBullets();
      elements.push(<div key={key++} style={{ height: '0.75em' }} />);
      continue;
    }

    // Heading: # or ## or ###
    const headMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headMatch) {
      flushBullets();
      const level = headMatch[1].length;
      const sizes = ['1.1rem', '1rem', '0.95rem'];
      elements.push(
        <p key={key++} style={{ fontWeight: 700, fontSize: sizes[level - 1], margin: '12px 0 4px', color: 'var(--ink)' }}>
          {parseInline(headMatch[2])}
        </p>
      );
      continue;
    }

    // Bullet: - or *
    if (/^[-*]\s+/.test(trimmed)) {
      bulletBuffer.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    flushBullets();
    elements.push(
      <p key={key++} style={{ margin: '0 0 6px', lineHeight: 1.75 }}>
        {parseInline(trimmed)}
      </p>
    );
  }

  flushBullets();
  return <div>{elements}</div>;
}
