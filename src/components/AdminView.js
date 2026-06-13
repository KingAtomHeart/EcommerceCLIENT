import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { StatusBadge, statusStyle } from '../utils/statusColors';
import { useTheme } from '../context/ThemeContext';
import { useSiteStyle } from '../context/SiteStyleContext';
import toast from 'react-hot-toast';
import AdminHomepageEditor from './AdminHomepageEditor';
import GroupBuyAdmin, { UnifiedGBOrderCard } from '../pages/GroupBuyAdmin';
// Description stays short; the long-form marketing content lives in
// LandingPageEditor below the description as a section-based editor (Hero /
// Banner / Text+Image / Gallery / Feature grid). Renderer stays wired in
// ProductView.js so customer-side renders the assembled page.
import { LandingPageEditor, serializeLandingPage } from './LandingPage';
import { CUSTOM_PAGE_SKELETON, renderCustomPageTokens } from '../utils/customPage';
import { priceDelta } from '../utils/priceFormat';
import { useCategories } from '../utils/categories';
import { getDimValues } from '../utils/variants';

const VALID_TABS = ['products', 'group-buys', 'orders', 'stats', 'homepage', 'categories'];

export async function uploadOptionImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const data = await apiFetch('/upload/single', { method: 'POST', body: fd });
  return data.url;
}

/* Move an array element from `from` to `to` and return the new array. Used
   by every reorder-by-drag UI here (image previews, etc.). */
export function arrayMove(arr, from, to) {
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/* Generic drag-to-reorder thumbnail row. Used by the create-product modal so
   admins can reshuffle uploaded files and URL-added images before the product
   is saved. After save, the dedicated ImageManager handles reorder server-side.
   `items` is the array, `getSrc/getAlt` pull display fields, `onReorder(from,to)`
   commits the move, `onRemove(idx)` deletes one. */
export function DraggableThumbList({ items, getSrc, getAlt = () => '', onReorder, onRemove, extraStyle }) {
  const [dragSrc, setDragSrc] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  if (!items || items.length === 0) return null;
  return (
    <div className="img-preview-row" style={extraStyle}>
      {items.map((it, i) => (
        <div key={i} draggable
          onDragStart={() => setDragSrc(i)}
          onDragOver={e => { e.preventDefault(); setDragOver(i); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => { if (dragSrc !== null) onReorder(dragSrc, i); setDragSrc(null); setDragOver(null); }}
          onDragEnd={() => { setDragSrc(null); setDragOver(null); }}
          className="img-preview-thumb"
          style={{
            position: 'relative',
            cursor: 'grab',
            opacity: dragSrc === i ? 0.4 : 1,
            outline: dragOver === i && dragSrc !== i ? '2px dashed var(--accent)' : 'none',
            outlineOffset: -2,
            transition: 'opacity 0.12s, outline-color 0.12s',
          }}>
          <img src={getSrc(it)} alt={getAlt(it)} style={{ pointerEvents: 'none' }} />
          <button type="button" onClick={() => onRemove(i)} style={{
            position: 'absolute', top: 3, right: 3, width: 18, height: 18,
            borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff',
            border: 'none', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', lineHeight: 1,
          }}>✕</button>
          {i === 0 && <span style={{
            position: 'absolute', bottom: 3, left: 3, fontSize: '0.5rem', fontWeight: 700,
            background: 'var(--accent)', color: '#fff', padding: '1px 4px', borderRadius: '4px',
          }}>MAIN</span>}
        </div>
      ))}
    </div>
  );
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
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
          <button className={`admin-tab ${tab === 'homepage' ? 'active' : ''}`} onClick={() => setTab('homepage')}>Pages</button>
          <button className={`admin-tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>Categories</button>
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

      {showCreate && <CreateProductModal products={products} onClose={() => setShowCreate(false)} onCreated={() => { fetchData(); setShowCreate(false); }} />}

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

      {tab === 'homepage' && (
        <>
          <AppearancePanel />
          <AdminHomepageEditor />
        </>
      )}

      {tab === 'categories' && <CategoriesPanel />}

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

/* ═══════════════════════════════════════════════
   ACTION MENU — single-pill grouped dropdown
   ───────────────────────────────────────────────
   Used by ProductCard / GroupBuy admin cards to collapse the row of action
   pills (Edit ▼ | Orders ▼ | Add-ons | CSV | Publish | Archive) into one
   "Manage" pill with grouped sections.

   sections: [{ heading, items: [{ key, label, onClick, active, hidden,
                                   destructive, badge }] }]
═══════════════════════════════════════════════ */
export function ActionMenu({ label = 'Manage', active = false, sections = [], minWidth = 220 }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hovered, setHovered] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Anchor under the trigger; if the menu would overflow the right edge,
      // shift it left so it stays in-viewport (margin 16).
      const left = Math.min(r.left, window.innerWidth - minWidth - 16);
      setPos({ top: r.bottom + 4, left: Math.max(8, left) });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleItem = (item) => {
    setOpen(false);
    item.onClick && item.onClick();
  };

  // Drop empty sections so a hidden-all section doesn't leave an orphan heading.
  const visibleSections = sections
    .map(s => ({ ...s, items: (s.items || []).filter(i => !i.hidden) }))
    .filter(s => s.items.length > 0);

  return (
    <>
      <div ref={btnRef} style={{ display: 'inline-block' }}>
        <Pill onClick={toggle} active={open || active}>
          {label} <Caret open={open} />
        </Pill>
      </div>
      {open && (
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 14px 36px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.08)',
          minWidth, padding: 4,
        }}>
          {visibleSections.map((sec, si) => (
            <div key={sec.heading || si} style={{ marginTop: si === 0 ? 0 : 4, paddingTop: si === 0 ? 0 : 4, borderTop: si === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
              {sec.heading && (
                <p style={{
                  margin: 0, padding: '6px 10px 4px',
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'var(--ink-faint)',
                }}>
                  {sec.heading}
                </p>
              )}
              {sec.items.map(item => {
                const isHovered = hovered === item.key;
                const isActive = !!item.active;
                const destructive = !!item.destructive;
                let bg = 'transparent';
                let color = 'var(--ink)';
                if (isActive) { bg = 'var(--accent)'; color = '#fff'; }
                else if (isHovered) {
                  if (destructive) { bg = 'rgba(192,57,43,0.10)'; color = '#c0392b'; }
                  else { bg = 'var(--accent-light)'; color = 'var(--accent)'; }
                }
                return (
                  <button key={item.key} onClick={() => handleItem(item)}
                    onMouseEnter={() => setHovered(item.key)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      width: '100%', textAlign: 'left',
                      padding: '8px 12px', background: bg, border: 'none', cursor: 'pointer',
                      fontSize: '0.8rem', fontFamily: "'DM Sans', sans-serif",
                      color, fontWeight: 500, borderRadius: 6,
                      transition: 'background 0.12s, color 0.12s',
                    }}>
                    <span>{item.label}</span>
                    {item.badge != null && (
                      <span style={{
                        fontSize: '0.66rem', fontWeight: 600,
                        padding: '2px 8px', borderRadius: 10,
                        background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--border-subtle)',
                        color: isActive ? '#fff' : 'var(--ink-muted)',
                      }}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
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
  const closePanel = () => onTogglePanel(null);

  const toggleActive = async () => {
    const action = product.isActive ? 'archive' : 'activate';
    if (product.isActive) {
      const ok = window.confirm(
        `Archive "${product.name}"?\n\n• It will be hidden from the shop and product page.\n• Any customer carts that still contain it will have it removed.\n• Past orders are unaffected — the product stays visible in order history.\n\nYou can activate it again later.`
      );
      if (!ok) return;
    }
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

  const isOpen = !!panel;
  // CSV export — hits the manufacturer-friendly endpoint that returns one
  // row per line item plus a production-totals (BOM) block at the bottom.
  // apiFetch isn't used since we need the raw response stream for download.
  const exportCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const API = process.env.REACT_APP_API_BASE_URL;
      const res = await fetch(`${API}/products/${product._id}/export-orders-csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(product.name || 'product').replace(/[^a-zA-Z0-9]/g, '_')}_orders.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch (err) { toast.error(err.message); }
  };

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
          <ActionMenu
            label="Manage"
            active={isOpen}
            sections={[
              {
                heading: 'Edit',
                items: [
                  { key: 'details', label: 'Details', onClick: () => onTogglePanel('details'), active: panel === 'details' },
                  { key: 'images', label: 'Images', onClick: () => onTogglePanel('images'), active: panel === 'images' },
                  { key: 'options', label: 'Options', onClick: () => onTogglePanel('options'), active: panel === 'options' },
                  { key: 'variants-config', label: 'Variants / Config', onClick: () => onTogglePanel('variants-config'), active: panel === 'variants-config' },
                ],
              },
              {
                heading: 'View',
                items: [
                  { key: 'orders', label: 'Orders', onClick: () => onTogglePanel('orders'), active: panel === 'orders' },
                  { key: 'addons', label: 'Add-ons', onClick: () => onTogglePanel('addons'), active: panel === 'addons' },
                ],
              },
              {
                heading: 'Actions',
                items: [
                  { key: 'csv', label: 'Export CSV', onClick: exportCSV },
                  { key: 'publish', label: 'Publish', onClick: publish, hidden: !product.isQueued },
                  { key: 'toggle', label: product.isActive ? 'Archive' : 'Activate', onClick: toggleActive, destructive: product.isActive },
                ],
              },
            ]}
          />
        </div>
      </div>
      {panel === 'details' && <EditProductCard product={product} fetchData={fetchData} onClose={closePanel} inline allProducts={allProducts} />}
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
      <div className="admin-inline-panel">
        <PanelHeader title="Orders" onClose={onClose} />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="admin-inline-panel admin-inline-panel-muted">
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
    <div className="admin-inline-panel admin-inline-panel-muted">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: '10px' }}>
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
          products={allProducts}
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
function EditProductCard({ product, fetchData, onClose, inline, allProducts = [] }) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description,
    price: product.price,
    // -1 / null / undefined → empty string (means unlimited / untracked)
    stocks: product.stocks === -1 || product.stocks == null ? '' : product.stocks,
    category: product.category
  });
  const knownCategories = Array.from(new Set((allProducts || []).map(p => (p.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const [specs, setSpecs] = useState((product.specifications || []).map(s => ({ label: s.label, value: s.value })));
  // Edit landing-page sections in place. Pre-existing blocks keep their _id so
  // serializeLandingPage knows which ones to preserve vs. allocate fresh.
  const [landingPage, setLandingPage] = useState(Array.isArray(product.landingPage) ? product.landingPage : []);
  const [customPageHtml, setCustomPageHtml] = useState(product.customPageHtml || '');
  const [pinnedAddOnIds, setPinnedAddOnIds] = useState(Array.isArray(product.pinnedAddOnIds) ? product.pinnedAddOnIds : []);
  const [pinnedRelatedIds, setPinnedRelatedIds] = useState(Array.isArray(product.pinnedRelatedIds) ? product.pinnedRelatedIds : []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        stocks: form.stocks === '' || form.stocks == null ? -1 : Number(form.stocks),
        specifications: specs.filter(s => s.label.trim() && s.value.trim()),
        landingPage: serializeLandingPage(landingPage),
        customPageHtml,
        pinnedAddOnIds,
        pinnedRelatedIds,
      };
      await apiFetch(`/products/${product._id}/update`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      toast.success('Product updated'); onClose(); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const wrapperClass = inline ? 'admin-inline-panel admin-inline-panel-form' : '';
  const wrapperStyle = inline
    ? null
    : { padding: '20px', border: '2px solid var(--accent)', background: 'var(--surface)', borderRadius: 'var(--radius)' };

  // Summary counters drive the collapsed-section labels so admins can see
  // what's populated without expanding every panel — same UX as CreateProductModal.
  const specCount  = specs.filter(s => s.label.trim() && s.value.trim()).length;
  const landingLen = landingPage.length;
  const htmlLen    = (customPageHtml || '').trim().length;

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <div>
        <PanelHeader title={inline ? 'Edit Details' : 'Edit Product'} onClose={onClose} />

        {/* ── Header block — same always-visible fields as CreateProductModal:
              name, short description, then the price/stock/category row. ── */}
        <div className="form-group"><label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <MarkdownEditor
            value={form.description}
            onChange={v => setForm(f => ({ ...f, description: v }))}
            minHeight={80}
            placeholder="A short blurb shown next to the buy button. Use Product Page Sections below for long-form content." />
        </div>

        <div className="modal-row-3">
          <div className="form-group">
            <label className="form-label">Price (₱)</label>
            <input type="number" className="form-input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Foundation; options/variants add on top" />
          </div>
          <div className="form-group">
            <label className="form-label">Stock <span style={{ fontWeight: 400, color: 'var(--ink-faint)', fontSize: '0.7rem' }}>— optional</span></label>
            <input type="number" className="form-input" min="0" value={form.stocks} onChange={e => setForm(f => ({ ...f, stocks: e.target.value }))} placeholder="Blank = unlimited" />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <CategoryPicker value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={knownCategories} />
          </div>
        </div>

        {/* ── Optional sections — collapsibles, same titles/summaries as
              CreateProductModal so the look matches. Images + Variants live
              in their own dedicated panels (separate dropdowns on the row)
              and aren't repeated here. ── */}
        <CollapsibleSection title="Specifications" summary={specCount > 0 ? `${specCount} row${specCount === 1 ? '' : 's'}` : 'optional'}>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
            Custom rows shown on the product page (e.g. Layout → 65%, Weight → 1.2kg).
            <span style={{ display: 'block', marginTop: 4, color: 'var(--ink-faint)' }}>Tip: press Enter to jump from Label → Value, and again on Value to add the next row.</span>
          </p>
          <SpecsEditor value={specs} onChange={setSpecs} />
        </CollapsibleSection>

        <CollapsibleSection title="Product Page Sections" summary={landingLen > 0 ? `${landingLen} section${landingLen === 1 ? '' : 's'}` : 'optional'}>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
            Rendered <strong>below the buy section</strong>. Add a Hero image, Banner text, Text+Image split, Gallery, or Feature grid.
          </p>
          <LandingPageEditor value={landingPage} onChange={setLandingPage} />
        </CollapsibleSection>

        <CollapsibleSection title="Custom HTML" summary={htmlLen > 0 ? `${htmlLen.toLocaleString()} chars` : 'optional'}>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '8px' }}>
            Paste raw HTML + CSS. Rendered <strong>below the buy section</strong>, replacing Product Page Sections when set.
          </p>
          <CustomHtmlEditor value={customPageHtml} onChange={setCustomPageHtml} previewProduct={product} />
        </CollapsibleSection>

        <CollapsibleSection title="Add-ons" summary={pinnedAddOnIds.length > 0 ? `${pinnedAddOnIds.length} pinned` : 'auto'}>
          <PinnedProductsPicker
            value={pinnedAddOnIds}
            onChange={setPinnedAddOnIds}
            helpText="Items shown in the Add-ons section below the buy section. Leave empty to auto-show products tagged with this product as their parent." />
        </CollapsibleSection>

        <CollapsibleSection title="You might also like" summary={pinnedRelatedIds.length > 0 ? `${pinnedRelatedIds.length} pinned` : 'auto'}>
          <PinnedProductsPicker
            value={pinnedRelatedIds}
            onChange={setPinnedRelatedIds}
            helpText="Items shown in the 'You might also like' section at the bottom of the page. Leave empty to auto-pick from the same category." />
        </CollapsibleSection>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      // Chunked to 20 per request (multer cap). Selecting more than 20 files
      // at once would otherwise fail with "Unexpected field".
      const BATCH = 20;
      for (let i = 0; i < files.length; i += BATCH) {
        const slice = files.slice(i, i + BATCH);
        const formData = new FormData();
        slice.forEach(f => formData.append('images', f));
        await apiFetch(`/products/${product._id}/images`, { method: 'POST', body: formData });
      }
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
    <div className="admin-inline-panel">
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
   CATEGORY PICKER — combobox over existing categories with free-text fallback.
   Renders a native <datalist> so admins can pick an existing tag (avoiding
   typo-driven duplicates like "keyboards" vs "Keyboards") OR type a brand-new
   category inline. No extra buttons; typing a fresh value creates it on submit.
═══════════════════════════════════════════════ */
/* Chip-style category picker.
   Source of truth is the canonical Category collection (managed in the
   Categories admin tab) — pulled live via useCategories. The legacy
   `options` prop is intentionally ignored: it used to be built from
   `[...new Set(products.map(p => p.category))]` which dragged every typo
   and test entry into the picker. Renaming a category in the admin tab
   automatically cleans up what shows here.

   "+ New" opens an inline input — confirming POSTs a fresh Category
   record so it persists across reloads instead of being a one-off string
   on a single product. The product's `category` field is still a plain
   string (the canonical name), so callers don't change. */
export function CategoryPicker({ value, onChange, options: _ignored = [], placeholder = 'Select category', required }) {
  void _ignored;
  const { categories, refresh } = useCategories();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef(null);

  // Canonical names only. Preserves admin sortOrder from the Categories tab.
  const names = (categories || []).map(c => c.name).filter(Boolean);
  // If the stored value isn't in the canonical list (renamed / deleted),
  // surface it anyway so the admin can see + replace it.
  const list = [...names];
  if (value && !list.some(n => n.toLowerCase() === value.toLowerCase())) {
    list.unshift(value);
  }

  // Click-outside to close. Bound only while open so we don't leak listeners.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setAdding(false); setDraft('');
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (name) => {
    onChange(name);
    setOpen(false);
    setAdding(false);
    setDraft('');
  };

  const commitNew = async () => {
    const next = draft.trim();
    if (!next) { setAdding(false); return; }
    // Case-insensitive match → select existing instead of duplicating.
    const existing = list.find(n => n.toLowerCase() === next.toLowerCase());
    if (existing) { pick(existing); return; }

    // POST a real Category record so the new name persists. ensureCategoryExists
    // on the product save would create it anyway, but doing it here means the
    // canonical list shows it immediately for the next picker.
    setCreating(true);
    try {
      await apiFetch('/categories', { method: 'POST', body: JSON.stringify({ name: next }) });
      await refresh();
    } catch {
      /* swallow — pick() below still records the choice */
    } finally {
      setCreating(false);
    }
    pick(next);
  };

  const display = value || placeholder;
  const isPlaceholder = !value;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="form-input"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left', cursor: 'pointer',
          color: isPlaceholder ? 'var(--ink-faint)' : 'inherit',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
        <span aria-hidden="true" style={{
          color: 'var(--ink-faint)', fontSize: '0.7rem',
          transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 14px 36px rgba(0,0,0,0.22), 0 3px 8px rgba(0,0,0,0.10)',
          zIndex: 50, maxHeight: 280, overflowY: 'auto', overflowX: 'hidden',
          padding: 4, boxSizing: 'border-box',
        }}>
          {list.length === 0 && !adding && (
            <p style={{ fontSize: '0.76rem', color: 'var(--ink-faint)', padding: '10px 12px', margin: 0 }}>
              No categories yet — add one below.
            </p>
          )}
          {list.map(cat => {
            const active = (value || '').toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => pick(cat)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left',
                  padding: '8px 12px', borderRadius: 6,
                  border: 'none',
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--ink)',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.84rem', fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                {active && <span style={{ fontSize: '0.78rem' }}>✓</span>}
              </button>
            );
          })}

          {/* Footer: + New trigger / inline create input */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 4 }}>
            {adding ? (
              // `minWidth: 0` on the flex input lets it shrink to fit narrow
              // popover widths (default <input> minWidth would push the Add /
              // ✕ buttons off the edge and trigger horizontal scroll on the
              // surrounding modal). Flex-shrink: 0 on the buttons keeps them
              // sized; the input absorbs whatever's left.
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px', minWidth: 0 }}>
                <input
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitNew(); }
                    if (e.key === 'Escape') { e.preventDefault(); setAdding(false); setDraft(''); }
                  }}
                  placeholder="New category name"
                  style={{
                    flex: 1, minWidth: 0, padding: '6px 10px',
                    border: '1px solid var(--accent)', borderRadius: 6,
                    background: 'var(--bg-secondary)', color: 'inherit',
                    fontSize: '0.84rem', fontFamily: "'DM Sans', sans-serif",
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button type="button" onClick={commitNew} disabled={creating || !draft.trim()}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: 'none',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: '0.76rem', cursor: creating ? 'wait' : 'pointer',
                    opacity: (!draft.trim() || creating) ? 0.5 : 1,
                    flexShrink: 0,
                  }}>
                  {creating ? '…' : 'Add'}
                </button>
                <button type="button" onClick={() => { setAdding(false); setDraft(''); }}
                  aria-label="Cancel"
                  style={{
                    padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--ink-muted)',
                    fontSize: '0.76rem', cursor: 'pointer',
                    flexShrink: 0,
                  }}>
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: 'none', background: 'transparent',
                  color: 'var(--accent)', fontWeight: 500,
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: '0.82rem', fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                + New category
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden mirror input — preserves form-level `required` validation. */}
      {required && (
        <input
          type="text" required tabIndex={-1}
          value={value || ''}
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, padding: 0, border: 'none', pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   MARKDOWN EDITOR — single textarea with a formatting toolbar (Bold / Italic /
   H1 / H2 / Bullet list / Link). Used for product + group-buy descriptions.

   Images live in Product Page Sections (LandingPageEditor) rather than the
   description, since stuffing a tall image into the description pushed the
   buy/options below the fold on the customer product page. Preview swaps the
   textarea for the rendered RichText — same renderer the customer page uses.
═══════════════════════════════════════════════ */
export function MarkdownEditor({ value, onChange, minHeight = 120, placeholder, required }) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef(null);

  const wrap = (before, after = before, placeholderText = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const v = el.value;
    const selected = v.slice(start, end);
    const inner = selected || placeholderText;
    const next = v.slice(0, start) + before + inner + after + v.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const newStart = start + before.length;
      el.setSelectionRange(newStart, newStart + inner.length);
    });
  };
  const linePrefix = (prefix, placeholderText = 'item') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const v = el.value;
    const lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const block = v.slice(lineStart, end);
    const lines = block.length === 0 ? [placeholderText] : block.split('\n');
    const prefixed = lines.map(l => `${prefix}${l}`).join('\n');
    const next = v.slice(0, lineStart) + prefixed + v.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + prefixed.length);
    });
  };
  const insertLink = () => {
    const url = window.prompt('Link URL:');
    if (!url) return;
    wrap('[', `](${url})`, 'link text');
  };

  const btn = {
    fontSize: '0.72rem', fontWeight: 600,
    padding: '4px 9px', borderRadius: 4,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--ink)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
    minWidth: 24, lineHeight: 1,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, gap: 6, flexWrap: 'wrap' }}>
        {!preview ? (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => wrap('**', '**', 'bold')} title="Bold" style={{ ...btn, fontWeight: 700 }}>B</button>
            <button type="button" onClick={() => wrap('*', '*', 'italic')} title="Italic" style={{ ...btn, fontStyle: 'italic' }}>I</button>
            <button type="button" onClick={() => linePrefix('# ', 'Heading')} title="Heading 1" style={btn}>H1</button>
            <button type="button" onClick={() => linePrefix('## ', 'Heading')} title="Heading 2" style={btn}>H2</button>
            <button type="button" onClick={() => linePrefix('- ', 'item')} title="Bullet list" style={btn}>• List</button>
            <button type="button" onClick={insertLink} title="Insert link" style={btn}>🔗 Link</button>
          </div>
        ) : <span />}
        <button type="button" onClick={() => setPreview(p => !p)}
          style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {preview ? (
        <div style={{ minHeight, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.92rem', lineHeight: 1.75 }}>
          {value?.trim() ? <RichText content={value} /> : <span style={{ color: 'var(--ink-faint)' }}>Nothing to preview yet.</span>}
        </div>
      ) : (
        <textarea ref={textareaRef} className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          style={{ minHeight, resize: 'vertical', fontSize: '0.9rem', lineHeight: 1.6, width: '100%' }} />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   CUSTOM HTML EDITOR — escape hatch for admins who want a hand-coded landing
   page. Pastes raw HTML/CSS into a textarea; rendered customer-side via
   dangerouslySetInnerHTML below the buy section. Toggle Preview to see the
   token-substituted output rendered inline. Trusted-admin input only.
═══════════════════════════════════════════════ */
export function CustomHtmlEditor({ value, onChange, previewProduct }) {
  const [preview, setPreview] = useState(false);
  const loadSkeleton = () => {
    if (value && !window.confirm('Replace existing HTML with the Oblique-style skeleton?')) return;
    onChange(CUSTOM_PAGE_SKELETON);
  };
  const clearAll = () => {
    if (!value) return;
    if (!window.confirm('Clear all custom HTML?')) return;
    onChange('');
  };
  // Preview substitutes tokens against the current product so admins can sanity
  // check the layout with real data before saving. Falls back to a minimal
  // fake product when no preview source is passed (e.g. CreateProductModal).
  const previewHtml = renderCustomPageTokens(value || '', previewProduct || {
    name: 'Sample Product', description: 'Sample description text shown in place of {{description}}.',
    price: 5000, category: 'keyboards', images: [],
  });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={loadSkeleton}
            style={{ fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 11px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            {value ? '↻ Reload skeleton' : '↓ Load skeleton'}
          </button>
          {value && (
            <button type="button" onClick={clearAll}
              style={{ fontSize: '0.72rem', color: '#c0392b', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '4px 11px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Clear
            </button>
          )}
        </div>
        <button type="button" onClick={() => setPreview(p => !p)}
          style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', margin: '0 0 8px 0', lineHeight: 1.55 }}>
        Tokens: <code>{'{{name}}'}</code> · <code>{'{{description}}'}</code> · <code>{'{{price}}'}</code> · <code>{'{{category}}'}</code> · <code>{'{{image1}}'}</code> … <code>{'{{imageN}}'}</code>.
        Markup is rendered as-is below the buy section. Click <em>Load skeleton</em> for an Oblique-style starter.
      </p>
      {preview ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg)', minHeight: 240 }}>
          {value?.trim()
            ? <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            : <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '32px 0' }}>Nothing to preview. Paste HTML or load the skeleton.</p>}
        </div>
      ) : (
        <textarea className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder="Paste HTML + <style>. Leave blank to use the block editor above instead."
          spellCheck={false}
          style={{ minHeight: 280, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.78rem', lineHeight: 1.5, width: '100%', whiteSpace: 'pre' }} />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PINNED PRODUCTS PICKER — used for the "Addons" and "You might also like"
   admin fields on Product + GroupBuy modals. Empty selection = customer page
   falls back to auto-derived items (same-category related, parent-child
   addons). Loads /products/active + /group-buys/active once per instance,
   filters in-memory so multi-select clicks don't refetch.
═══════════════════════════════════════════════ */
export function PinnedProductsPicker({ value, onChange, includeGroupBuys = true, placeholder = 'Search by name…', label, helpText }) {
  const selectedIds = Array.isArray(value) ? value : [];
  const [products, setProducts] = useState([]);
  const [groupBuys, setGroupBuys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState('all'); // 'all' | 'product' | 'gb'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tasks = [apiFetch('/products/active').then(r => Array.isArray(r) ? r : (r.products || []))];
        if (includeGroupBuys) tasks.push(apiFetch('/group-buys/active').then(r => Array.isArray(r) ? r : (r.groupBuys || [])));
        const results = await Promise.all(tasks);
        if (cancelled) return;
        setProducts(results[0] || []);
        if (includeGroupBuys) setGroupBuys(results[1] || []);
      } catch { /* silent — picker just shows empty catalog */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [includeGroupBuys]);

  const idIndex = (id) => selectedIds.indexOf(id);
  const toggle = (id) => onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  const removeAt = (idx) => onChange(selectedIds.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= selectedIds.length) return;
    const next = selectedIds.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const q = filter.trim().toLowerCase();
  const matches = (name) => !q || (name || '').toLowerCase().includes(q);
  const visibleProducts = kind === 'gb' ? [] : products.filter(p => matches(p.name));
  const visibleGBs = !includeGroupBuys || kind === 'product' ? [] : groupBuys.filter(g => matches(g.name));

  // Resolve each selected id against both catalogs so the Selected row knows
  // what to display. Skips unknown ids (deleted/archived) but keeps them in
  // the underlying value array so a temporarily-missing item doesn't get
  // silently dropped from the admin's curated list.
  const resolveSelected = () => selectedIds.map(id => {
    const p = products.find(x => x._id === id);
    if (p) return { kind: 'product', id, name: p.name, image: p.images?.[0]?.url };
    const g = includeGroupBuys ? groupBuys.find(x => x._id === id) : null;
    if (g) return { kind: 'gb', id, name: g.name, image: g.images?.[0]?.url };
    return { kind: 'unknown', id, name: 'Unknown (deleted?)', image: null };
  });
  const selectedRows = resolveSelected();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(label || helpText) && (
        <div>
          {label && <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{label}</p>}
          {helpText && <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', margin: '2px 0 0' }}>{helpText}</p>}
        </div>
      )}

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Selected ({selectedRows.length})
          {selectedRows.length === 0 && ' · empty = auto-pick'}
        </p>
        {selectedRows.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', fontStyle: 'italic', margin: 0 }}>None pinned. The customer page will auto-pick.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selectedRows.map((row, i) => (
              <div key={`${row.kind}-${row.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', background: 'var(--surface)', borderRadius: 4, border: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden', flexShrink: 0 }}>
                  {row.image && <img src={row.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <span style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 48 }}>
                  {row.kind === 'product' ? 'Stock' : row.kind === 'gb' ? 'Group buy' : '?'}
                </span>
                <span style={{ flex: 1, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.4 : 1, fontSize: '0.7rem' }}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === selectedRows.length - 1} title="Move down"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', cursor: i === selectedRows.length - 1 ? 'not-allowed' : 'pointer', opacity: i === selectedRows.length - 1 ? 0.4 : 1, fontSize: '0.7rem' }}>↓</button>
                <button type="button" onClick={() => removeAt(i)} title="Remove"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: '#c0392b', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="form-input" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder={placeholder} style={{ flex: 1, minWidth: 160, fontSize: '0.82rem', padding: '6px 9px' }} />
        {includeGroupBuys && (
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', fontSize: '0.7rem' }}>
            {[{ k: 'all', label: 'All' }, { k: 'product', label: 'In stock' }, { k: 'gb', label: 'Group buys' }].map(opt => (
              <button key={opt.k} type="button" onClick={() => setKind(opt.k)}
                style={{ padding: '4px 10px', background: kind === opt.k ? 'var(--accent)' : 'transparent', color: kind === opt.k ? '#fff' : 'var(--ink-muted)', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>Loading catalog…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, maxHeight: 260, overflowY: 'auto', padding: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          {visibleProducts.map(p => (
            <PickerTile key={`p-${p._id}`} name={p.name} image={p.images?.[0]?.url} tag="Stock" selected={idIndex(p._id) >= 0} order={idIndex(p._id) + 1} onClick={() => toggle(p._id)} />
          ))}
          {visibleGBs.map(g => (
            <PickerTile key={`g-${g._id}`} name={g.name} image={g.images?.[0]?.url} tag="GB" selected={idIndex(g._id) >= 0} order={idIndex(g._id) + 1} onClick={() => toggle(g._id)} />
          ))}
          {visibleProducts.length === 0 && visibleGBs.length === 0 && (
            <p style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No matches.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PickerTile({ name, image, tag, selected, order, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
        background: selected ? 'var(--accent-light)' : 'var(--bg-secondary)',
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', padding: 4, cursor: 'pointer',
      }}>
      <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--surface)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        {image && <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      {selected && (
        <span style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{order}</span>
      )}
      <span style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tag}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </button>
  );
}


/* ═══════════════════════════════════════════════
   CATEGORIES PANEL — admin tab. Lists every known category (records + the
   stub entries derived from product/GB strings) and lets the admin promote
   stubs into full records, edit existing ones (image, description, order,
   pinned product/GB lists), and delete records.

   Deleting a record only removes the metadata — products/GBs that carry
   the slug continue to render the stub. To truly retire a category, the
   admin has to retag the underlying products.
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   APPEARANCE PANEL
   ───────────────────────────────────────────────
   Site-wide visual style toggle. Reads/writes the singleton SiteSettings
   document via /site-settings. Changing the style applies to every visitor
   on next render — the SiteStyleContext provider lives at App root and
   sets data-style on <html>, which globals.css keys off of.
═══════════════════════════════════════════════ */
function AppearancePanel() {
  const { style, setStyle } = useSiteStyle();
  const [saving, setSaving] = useState(false);

  const STYLES = [
    {
      id: 'classic',
      name: 'Classic',
      tagline: 'The original look',
      desc: 'Warm cream backgrounds, serif headings, rounded corners, soft shadows. The current site.',
    },
    {
      id: 'minimal',
      name: 'Origami',
      tagline: 'Crisp, modern, brand green',
      desc: 'Inter typography, sharp angular edges with the slightest softening, brand green accent. Smooth hover lifts, image zoom, frosted-glass navbar.',
    },
    {
      id: 'pastel-paper',
      name: 'Pastel Paper',
      tagline: 'Editorial cream with Apple-style polish',
      desc: 'Cream paper background, deep sage primary with rose / butter / sky pastel accents, Fraunces editorial serif headings, soft warm shadows, frosted-glass capsule notifications.',
    },
  ];

  const choose = async (next) => {
    if (next === style || saving) return;
    setSaving(true);
    try {
      await setStyle(next);
      toast.success(`Switched to ${STYLES.find(s => s.id === next)?.name || next}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update theme');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: 32, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem', letterSpacing: '-0.02em', marginBottom: 4 }}>Site appearance</h2>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>
          Visual style applied to every visitor. Light/dark mode stays per-visitor.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {STYLES.map(s => {
          const active = style === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => choose(s.id)}
              disabled={saving}
              style={{
                textAlign: 'left',
                padding: 18,
                borderRadius: 'var(--radius-sm)',
                border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                background: active ? 'var(--accent-light)' : 'var(--bg)',
                cursor: saving ? 'progress' : 'pointer',
                transition: 'all var(--transition)',
                fontFamily: 'inherit',
                color: 'var(--ink)',
                opacity: saving && !active ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.15rem' }}>{s.name}</span>
                {active && (
                  <span style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--surface)', padding: '3px 9px', borderRadius: 20 }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>
                {s.tagline}
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', lineHeight: 1.55 }}>
                {s.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoriesPanel() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // category being edited, or null

  const reload = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/categories');
      setList(Array.isArray(data) ? data : []);
    } catch (err) { toast.error(err.message || 'Failed to load categories'); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const startNew = () => setEditing({
    _id: null, name: '', slug: '',
    image: { url: '', altText: '' },
    description: '', sortOrder: 1000,
    pinnedProductIds: [], pinnedGroupBuyIds: [],
    hasRecord: false,
  });

  const onSaved = () => { setEditing(null); reload(); };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.6rem', margin: 0 }}>Categories</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', margin: '4px 0 0' }}>
            Manage the categories shown in the strip and dropdowns. Pin products to control what appears on each category's page.
          </p>
        </div>
        <button className="btn-dark" onClick={startNew} style={{ padding: '10px 22px' }}>
          <span>+ New Category</span>
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>Loading…</p>
      ) : list.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>No categories yet. Add one above, or create a product with a new category.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {list.map(cat => (
            <CategoryCard key={cat.slug} category={cat} onEdit={() => setEditing(cat)} onChanged={reload} />
          ))}
        </div>
      )}

      {editing && (
        <CategoryEditModal
          category={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function CategoryCard({ category, onEdit, onChanged }) {
  const isStub = !category.hasRecord;
  const pinned = (category.pinnedProductIds?.length || 0) + (category.pinnedGroupBuyIds?.length || 0);
  const deleteThis = async () => {
    if (!category._id) return;
    if (!window.confirm(`Delete the "${category.name}" category record? Products using this slug keep their tag and the slug stays in the strip — only the metadata (image/description/pinned list) is removed.`)) return;
    try {
      await apiFetch(`/categories/${category._id}`, { method: 'DELETE' });
      toast.success('Category record deleted');
      onChanged();
    } catch (err) { toast.error(err.message || 'Delete failed'); }
  };
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg-secondary)', position: 'relative' }}>
        {category.image?.url ? (
          <img src={category.image.url} alt={category.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontFamily: "'DM Serif Display', serif", fontSize: '2rem' }}>
            {category.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        {isStub && (
          <span style={{ position: 'absolute', top: 8, left: 8, background: 'var(--ink)', color: 'var(--bg)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999 }}>
            Auto-derived
          </span>
        )}
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.05rem', margin: 0, letterSpacing: '-0.01em' }}>{category.name}</p>
        <p style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', margin: 0, fontFamily: 'monospace' }}>/{category.slug}</p>
        {category.description && (
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', margin: '6px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{category.description}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            {pinned > 0 ? `${pinned} pinned · ` : ''}order {category.sortOrder ?? 1000}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={onEdit} className="btn-outline" style={{ padding: '6px 14px', fontSize: '0.78rem', flex: 1 }}>
            {isStub ? 'Set up' : 'Edit'}
          </button>
          <Link to={`/category/${category.slug}`} className="btn-outline" style={{ padding: '6px 14px', fontSize: '0.78rem', textDecoration: 'none' }}>
            View
          </Link>
          {!isStub && (
            <button onClick={deleteThis} style={{ padding: '6px 12px', fontSize: '0.78rem', background: 'none', border: '1px solid var(--border)', color: '#c0392b', borderRadius: 'var(--radius-pill)', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryEditModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: category.name || '',
    slug: category.slug || '',
    imageUrl: category.image?.url || '',
    imageAlt: category.image?.altText || '',
    description: category.description || '',
    sortOrder: category.sortOrder ?? 1000,
  });
  // Pinned ids — flatten populated docs to ids in case the parent passed
  // hydrated arrays.
  const [pinnedProductIds, setPinnedProductIds] = useState(
    (category.pinnedProductIds || []).map(p => p?._id ?? p)
  );
  const [pinnedGroupBuyIds, setPinnedGroupBuyIds] = useState(
    (category.pinnedGroupBuyIds || []).map(g => g?._id ?? g)
  );
  // Rich page content — same editors that EditProductCard uses, so admins
  // get the full block-editor (Hero / Banner / Text+Image / Gallery / Feature
  // grid) plus a custom HTML escape hatch.
  const [landingPage, setLandingPage] = useState(
    Array.isArray(category.landingPage) ? category.landingPage : []
  );
  const [customPageHtml, setCustomPageHtml] = useState(category.customPageHtml || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // The picker takes one combined id list and resolves each id against
  // products or group buys. Categories want two distinct lists, so we merge
  // them locally and split on save.
  const combinedPinned = [...pinnedProductIds, ...pinnedGroupBuyIds];
  const handleCombinedChange = (newIds) => {
    // Re-partition by checking each id against the current product/GB lists
    // we have. We don't have the catalog here, so we split by remembering
    // which list each id came from before. Newly added ids land in whichever
    // bucket their underlying object lives in — we figure that out by
    // fetching the active catalogs once.
    // For simplicity: we track each id's kind via membership in the prior
    // arrays. Newly-added unknown ids are tentatively products; the user can
    // remove and re-pick if wrong. The catalog fetch in PinnedProductsPicker
    // already covers both kinds so the visual is correct.
    const prevP = new Set(pinnedProductIds);
    const prevG = new Set(pinnedGroupBuyIds);
    const stillP = newIds.filter(id => prevP.has(id));
    const stillG = newIds.filter(id => prevG.has(id));
    const fresh = newIds.filter(id => !prevP.has(id) && !prevG.has(id));
    // Default fresh ids to "product"; CategoryEditModal's preview / save
    // resolves any miscategorisation when the backend populates.
    setPinnedProductIds([...stillP, ...fresh]);
    setPinnedGroupBuyIds(stillG);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadOptionImage(file);
      setForm(f => ({ ...f, imageUrl: url }));
    } catch (err) { toast.error(err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        image: { url: form.imageUrl.trim(), altText: form.imageAlt.trim() },
        description: form.description.trim(),
        sortOrder: Number(form.sortOrder) || 1000,
        pinnedProductIds,
        pinnedGroupBuyIds,
        landingPage: serializeLandingPage(landingPage),
        customPageHtml,
      };
      if (category._id) {
        await apiFetch(`/categories/${category._id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Category updated');
      } else {
        await apiFetch('/categories', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Category created');
      }
      onSaved();
    } catch (err) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-body">
        <h2 className="modal-title">{category._id ? `Edit ${category.name}` : (category.slug ? `Set up ${category.name}` : 'New Category')}</h2>
        <p className="modal-subtitle">
          Image and description appear on the per-category page hero. Pinned items show first; everything else in this category fills in below.
        </p>

        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Keyboards" />
        </div>

        <div className="form-group">
          <label className="form-label">
            Slug <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(URL — auto-derived from name)</span>
          </label>
          <input className="form-input" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="keyboards" style={{ fontFamily: 'monospace' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Cover Image</label>
          {form.imageUrl ? (
            <div style={{ marginBottom: 8 }}>
              <img src={form.imageUrl} alt="" style={{ width: 280, height: 158, objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }} />
            </div>
          ) : (
            <div style={{ width: 280, height: 158, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '0.82rem' }}>
              No image
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="Image URL or click Upload" style={{ flex: 1 }} />
            <label className="btn-outline" style={{ padding: '8px 16px', cursor: uploading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              {uploading ? '…' : '↑ Upload'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short blurb shown under the category title."
            style={{ minHeight: 80, resize: 'vertical' }} />
        </div>

        <div className="form-group">
          <label className="form-label">
            Sort Order <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(lower = earlier in the strip)</span>
          </label>
          <input type="number" className="form-input" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} style={{ maxWidth: 120 }} />
        </div>

        <div className="form-group">
          <label className="form-label">
            Pinned products + group buys{' '}
            <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>
              {combinedPinned.length > 0 ? `(${combinedPinned.length} pinned)` : '(auto)'}
            </span>
          </label>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginBottom: 8, marginTop: 2 }}>
            Pinned items show first on the category page in the order set. Leave empty to auto-show everything in the category.
          </p>
          <PinnedProductsPicker value={combinedPinned} onChange={handleCombinedChange} />
        </div>

        {/* ── Optional rich page content — same editor as product/GB landing
              pages. Renders between the category hero and the product grid. ── */}
        <CollapsibleSection title="Page Sections" summary={landingPage.length > 0 ? `${landingPage.length} section${landingPage.length === 1 ? '' : 's'}` : 'optional'}>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
            Hero image, Banner, Text + Image, Gallery, Feature grid — rendered between the category header and the product list. Same blocks as product pages.
          </p>
          <LandingPageEditor value={landingPage} onChange={setLandingPage} />
        </CollapsibleSection>

        <CollapsibleSection title="Custom HTML" summary={(customPageHtml || '').trim().length > 0 ? `${(customPageHtml || '').trim().length.toLocaleString()} chars` : 'optional'}>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '8px' }}>
            Raw HTML + CSS rendered <strong>below the product grid</strong>. Useful for one-off promo callouts.
          </p>
          <CustomHtmlEditor value={customPageHtml} onChange={setCustomPageHtml} />
        </CollapsibleSection>

        <div className="modal-actions">
          <button onClick={save} disabled={saving} className="btn-dark" style={{ flex: 1, justifyContent: 'center' }}>
            <span>{saving ? 'Saving…' : (category._id ? 'Save Category' : 'Create Category')}</span>
          </button>
          <button onClick={onClose} className="btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   SPECS EDITOR — label/value rows for product specifications.
   Keyboard flow: Enter on Label → focus Value; Enter on Value → focus next
   row's Label, OR add a fresh row and focus it when on the last value. Keeps
   admins on the keyboard instead of reaching for the mouse for every row.
═══════════════════════════════════════════════ */
export function SpecsEditor({ value, onChange }) {
  const specs = Array.isArray(value) ? value : [];
  const labelRefs = useRef([]);
  const valueRefs = useRef([]);
  const [pendingFocus, setPendingFocus] = useState(null); // { row, field: 'label' | 'value' }
  const inputSm = { fontSize: '0.78rem', padding: '7px 9px' };

  useEffect(() => {
    if (!pendingFocus) return;
    const refs = pendingFocus.field === 'value' ? valueRefs : labelRefs;
    const el = refs.current[pendingFocus.row];
    if (el) el.focus();
    setPendingFocus(null);
  }, [pendingFocus, specs.length]);

  const addRow = () => {
    const newIdx = specs.length;
    onChange([...specs, { label: '', value: '' }]);
    setPendingFocus({ row: newIdx, field: 'label' });
  };
  const updateRow = (i, field, val) =>
    onChange(specs.map((r, j) => j !== i ? r : { ...r, [field]: val }));
  const removeRow = (i) => onChange(specs.filter((_, j) => j !== i));

  const onLabelKey = (i) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      valueRefs.current[i]?.focus();
    }
  };
  const onValueKey = (i) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i === specs.length - 1) addRow();
      else labelRefs.current[i + 1]?.focus();
    }
  };

  return (
    <div>
      {specs.map((spec, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', marginBottom: '6px' }}>
          <input className="form-input" style={inputSm} placeholder="Label (e.g. Layout)"
            ref={el => { labelRefs.current[i] = el; }}
            value={spec.label}
            data-enter-action="custom"
            onKeyDown={onLabelKey(i)}
            onChange={e => updateRow(i, 'label', e.target.value)} />
          <input className="form-input" style={inputSm} placeholder="Value (e.g. 65%, hotswap)"
            ref={el => { valueRefs.current[i] = el; }}
            value={spec.value}
            data-enter-action="custom"
            onKeyDown={onValueKey(i)}
            onChange={e => updateRow(i, 'value', e.target.value)} />
          <button type="button" onClick={() => removeRow(i)}
            style={{ padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={addRow}
        style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '5px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
        + Add Specification
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   EDITABLE DIMENSION ROW — inline-edits a variant dimension (its name +
   value chips) so admins can fix typos instead of removing the whole
   dimension. Each value chip has an inline input and a ✕; a trailing
   input at the end accepts new values (Enter to add).
═══════════════════════════════════════════════ */
// Values are now { value, priceModifier } objects. EditableDimensionRow
// tolerates either shape on input (legacy bare strings get treated as
// { value, priceModifier: 0 }) but always emits the object form via
// onUpdateValue(vi, partial). Each value pill shows the name input plus a
// tiny ±₱ input so admins can set per-value modifiers without leaving the
// dimension row.
export function EditableDimensionRow({ dim, onRename, onUpdateValue, onRemoveValue, onAddValue, onRemove }) {
  const [newVal, setNewVal] = useState('');
  const commitNew = () => {
    if (!newVal.trim()) return;
    onAddValue(newVal);
    setNewVal('');
  };
  const normalize = (v) => (typeof v === 'string'
    ? { value: v, priceModifier: 0 }
    : { value: v?.value ?? '', priceModifier: Number(v?.priceModifier) || 0 });
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.82rem', flexWrap: 'wrap' }}>
      <input className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', fontWeight: 600, width: 'auto', minWidth: 100, maxWidth: 160 }}
        value={dim.name}
        onChange={e => onRename(e.target.value)}
        data-enter-action="custom"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 200 }}>
        {dim.values.map((raw, vi) => {
          const v = normalize(raw);
          return (
            <span key={vi} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '2px 4px 2px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.72rem' }}>
              <input value={v.value}
                onChange={e => onUpdateValue(vi, { value: e.target.value })}
                data-enter-action="custom"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                style={{ border: 'none', background: 'transparent', padding: 0, fontSize: '0.72rem', width: `${Math.max(4, v.value.length)}ch`, minWidth: '3ch', color: 'inherit', outline: 'none' }} />
              {/* Per-value price modifier. Empty / 0 hides the +/-₱ badge on
                  the customer page. Small width keeps the pill compact. */}
              <input type="number"
                value={v.priceModifier === 0 ? '' : v.priceModifier}
                onChange={e => onUpdateValue(vi, { priceModifier: e.target.value === '' ? 0 : Number(e.target.value) || 0 })}
                placeholder="±₱"
                title="Price modifier for this value"
                data-enter-action="custom"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                style={{ border: 'none', borderLeft: '1px solid var(--border-subtle)', background: 'transparent', padding: '0 2px 0 6px', marginLeft: 4, fontSize: '0.7rem', width: '5ch', color: 'var(--ink-muted)', outline: 'none', MozAppearance: 'textfield' }} />
              <button type="button" onClick={() => onRemoveValue(vi)} aria-label={`Remove ${v.value}`}
                style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.65rem', lineHeight: 1, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>✕</button>
            </span>
          );
        })}
        <input value={newVal}
          onChange={e => setNewVal(e.target.value)}
          data-enter-action="custom"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitNew(); } }}
          onBlur={commitNew}
          placeholder="+ value"
          style={{ border: '1px dashed var(--border)', background: 'transparent', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', width: '8ch', color: 'inherit', outline: 'none' }} />
      </div>
      <button type="button" onClick={onRemove}
        style={{ fontSize: '0.7rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>
        Remove
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   OPTION GROUPS FIELD — shared between create + edit flows so both have the
   full editor (image URL + upload, stocks, availability toggle, inline editing).
═══════════════════════════════════════════════ */
export function OptionGroupsField({ value, onChange }) {
  const groups = Array.isArray(value) ? value : [];
  const [uploadingImg, setUploadingImg] = useState({});
  const [newGroup, setNewGroup] = useState({ name: '' });
  const [newValues, setNewValues] = useState({});
  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  const setGroups = (updater) => onChange(typeof updater === 'function' ? updater(groups) : updater);

  const addGroup = () => {
    if (!newGroup.name.trim()) return;
    const idx = groups.length;
    setGroups(g => [...g, { name: newGroup.name.trim(), values: [] }]);
    setNewValues(v => ({ ...v, [idx]: { value: '', price: '', stocks: '', imageUrl: '' } }));
    setNewGroup({ name: '' });
  };
  const removeGroup = (gi) => setGroups(g => g.filter((_, i) => i !== gi));

  const addValue = (gi) => {
    const nv = newValues[gi];
    if (!nv?.value?.trim() || nv.price === '') return;
    setGroups(g => g.map((grp, i) => i !== gi ? grp : {
      ...grp,
      values: [...(grp.values || []), {
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
      ? { ...v, image: { ...(v.image || {}), url: val } }
      : { ...v, [field]: (field === 'price' || field === 'stocks') ? (val === '' || val === '-1' ? -1 : Number(val) || 0) : val }
    )
  }));

  const onUploadFor = async (gi, vi, file) => {
    const key = `${gi}-${vi == null ? 'new' : vi}`;
    setUploadingImg(p => ({ ...p, [key]: true }));
    try {
      const url = await uploadOptionImage(file);
      if (vi == null) setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: url } }));
      else updateValueField(gi, vi, 'imageUrl', url);
    } catch { toast.error('Upload failed'); }
    finally { setUploadingImg(p => ({ ...p, [key]: false })); }
  };

  return (
    <div>
      {groups.map((grp, gi) => (
        <div key={gi} style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <input className="form-input" style={{ ...inputSm, fontWeight: 600, fontSize: '0.82rem', width: 'auto', minWidth: 140 }}
              value={grp.name}
              onChange={e => setGroups(g => g.map((gg, i) => i !== gi ? gg : { ...gg, name: e.target.value }))} />
            <button type="button" onClick={() => removeGroup(gi)} style={{ fontSize: '0.68rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove Group</button>
          </div>

          {grp.values?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {grp.values.map((val, vi) => (
                <div key={vi} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', opacity: val.available === false ? 0.55 : 1 }}>
                  {val.image?.url
                    ? <img src={val.image.url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '0.9rem' }}>🖼</div>}
                  <input className="form-input" style={{ ...inputSm, flex: '1 1 120px', minWidth: 100 }} value={val.value}
                    placeholder="Value" onChange={e => updateValueField(gi, vi, 'value', e.target.value)} />
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.6rem', color: 'var(--ink-faint)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>± Price
                    <input type="number" className="form-input" style={{ ...inputSm, width: 70 }} value={val.price}
                      onChange={e => updateValueField(gi, vi, 'price', e.target.value)} />
                    {priceDelta(val.price) && (
                      <span style={{ fontSize: '0.6rem', textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: Number(val.price) >= 0 ? 'var(--accent)' : '#c0392b' }}>{priceDelta(val.price)}</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.6rem', color: 'var(--ink-faint)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>Stock
                    <input type="number" className="form-input" style={{ ...inputSm, width: 60 }} placeholder="∞" title="-1 or blank = unlimited"
                      value={val.stocks === -1 || val.stocks === undefined ? '' : val.stocks}
                      onChange={e => updateValueField(gi, vi, 'stocks', e.target.value)} />
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 160px', minWidth: 140 }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>Image</span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0 }} placeholder="URL or upload"
                        value={val.image?.url || ''}
                        onChange={e => updateValueField(gi, vi, 'imageUrl', e.target.value)} />
                      <label style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: uploadingImg[`${gi}-${vi}`] ? 'wait' : 'pointer', fontSize: '0.72rem' }} title="Upload image">
                        {uploadingImg[`${gi}-${vi}`] ? '…' : '↑'}
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await onUploadFor(gi, vi, f); }} />
                      </label>
                    </div>
                  </div>
                  <button type="button" onClick={() => toggleAvailable(gi, vi)} title="Toggle available"
                    style={{
                      fontSize: '0.62rem', padding: '4px 10px', borderRadius: '10px', border: '1px solid',
                      cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                      background: val.available !== false ? 'var(--accent-light)' : 'transparent',
                      color: val.available !== false ? 'var(--accent)' : 'var(--ink-faint)',
                      borderColor: val.available !== false ? 'var(--accent)' : 'var(--border)',
                    }}>
                    {val.available !== false ? 'On' : 'Off'}
                  </button>
                  <button type="button" onClick={() => removeValue(gi, vi)}
                    style={{ fontSize: '0.78rem', color: '#c0392b', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Add new value row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 8px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <input className="form-input" style={{ ...inputSm, flex: '1 1 120px', minWidth: 100, borderStyle: 'dashed' }} placeholder="Value (e.g. Base Kit)"
              value={newValues[gi]?.value || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), value: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, width: 70, borderStyle: 'dashed' }} placeholder="+ ₱"
              value={newValues[gi]?.price || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), price: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, width: 60, borderStyle: 'dashed' }} placeholder="∞"
              title="Stock (-1 or blank = unlimited)"
              value={newValues[gi]?.stocks || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), stocks: e.target.value } }))} />
            <div style={{ display: 'flex', gap: 3, flex: '1 1 160px', minWidth: 140 }}>
              <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0, borderStyle: 'dashed' }} placeholder="Image URL (opt.)"
                value={newValues[gi]?.imageUrl || ''}
                onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: e.target.value } }))} />
              <label style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: uploadingImg[`${gi}-new`] ? 'wait' : 'pointer', fontSize: '0.72rem' }} title="Upload image">
                {uploadingImg[`${gi}-new`] ? '…' : '↑'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await onUploadFor(gi, null, f); }} />
              </label>
            </div>
            <button type="button" onClick={() => addValue(gi)} className="config-add-btn" style={{ fontSize: '0.72rem' }}>+ Add</button>
          </div>
        </div>
      ))}

      {/* New group */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="form-input" style={inputSm} placeholder="Option group name (e.g. Kit)"
          value={newGroup.name} onChange={e => setNewGroup({ name: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }} />
        <button type="button" onClick={addGroup} className="config-add-btn">+ Add Group</button>
      </div>
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
    (product.options || []).map(g => ({ ...g, values: (g.values || []).map(v => ({ ...v })) }))
  );
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="admin-inline-panel">
      <PanelHeader title="Options — additional-price selectors (added on top of base price)" onClose={onClose} />
      <OptionGroupsField value={groups} onChange={setGroups} />
      <div style={{ display: 'flex', gap: '8px', marginTop: 12 }}>
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
    <div className="admin-inline-panel">
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: 8 }}>
            <input className="form-input" style={{ ...inputSm, fontWeight: 600, fontSize: '0.82rem', width: 'auto', minWidth: 140 }}
              value={cfg.name}
              onChange={e => setConfigs(p => p.map((c, i) => i !== ci ? c : { ...c, name: e.target.value }))} />
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
              <input className="form-input" style={{ ...inputSm, textDecoration: opt.available ? 'none' : 'line-through', opacity: opt.available ? 1 : 0.55 }}
                value={opt.value}
                onChange={e => updateOptField(ci, oi, 'value', e.target.value)} />
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
// Single variant row in the existing-product variant editor. Wrapping flex
// layout means even ten dimensions + image + stock + price stay within the
// current container width — no horizontal scrolling.
function EditVariantRowCard({ variant, idx, dimensions, onChange, onChangeAttr, onRemove }) {
  const [uploadingImg, setUploadingImg] = useState(false);
  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImg(true);
    try { onChange({ imageUrl: await uploadOptionImage(file) }); }
    catch (err) { toast.error(err.message || 'Upload failed'); }
    finally { setUploadingImg(false); }
  };
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10, opacity: variant.available ? 1 : 0.55 }}>
      {variant.imageUrl
        ? <img src={variant.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', flexShrink: 0 }} />
        : <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '1.3rem' }}>🖼</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', flex: '1 1 280px', minWidth: 0 }}>
        {dimensions.map(d => (
          <label key={d.name} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{d.name}</span>
            <select className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', width: 'auto', minWidth: 90 }}
              value={variant.attributes[d.name] || ''}
              onChange={e => onChangeAttr(d.name, e.target.value)}>
              <option value="">—</option>
              {getDimValues(d).map(({ value }) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Stock</span>
          <input type="number" className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', width: 70 }}
            value={variant.stock === '' || variant.stock == null ? '' : variant.stock}
            placeholder="0" title="Stock count. Blank = 0 (OOS). Type -1 for unlimited."
            onChange={e => onChange({ stock: e.target.value === '' ? '' : Number(e.target.value) })} />
        </label>
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>± Price</span>
          <input type="number" className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', width: 80 }}
            value={variant.price ?? ''} placeholder="Base"
            onChange={e => onChange({ price: e.target.value === '' ? '' : Number(e.target.value) })} />
          {priceDelta(variant.price) && (
            <span style={{ fontSize: '0.62rem', color: Number(variant.price) >= 0 ? 'var(--accent)' : '#c0392b' }}>{priceDelta(variant.price)}</span>
          )}
        </label>
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>SKU</span>
          <input className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', width: 90 }}
            value={variant.sku} onChange={e => onChange({ sku: e.target.value })} />
        </label>
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, flex: '1 1 200px', minWidth: 160 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Image</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="text" placeholder="URL or upload"
              className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', flex: 1, minWidth: 0 }}
              value={variant.imageUrl || ''} onChange={e => onChange({ imageUrl: e.target.value })} />
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '4px 8px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', background: 'var(--accent-light)',
                color: 'var(--accent)', cursor: uploadingImg ? 'wait' : 'pointer', fontSize: '0.72rem', whiteSpace: 'nowrap',
              }}>
              {uploadingImg ? '…' : '↑'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageFile} disabled={uploadingImg} style={{ display: 'none' }} />
            </label>
          </div>
        </label>
        <button type="button" onClick={() => onChange({ available: !variant.available })} title="Toggle available"
          style={{
            alignSelf: 'flex-end', fontSize: '0.66rem', padding: '5px 10px', borderRadius: '10px',
            border: '1px solid', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            background: variant.available ? 'var(--accent-light)' : 'transparent',
            color: variant.available ? 'var(--accent)' : 'var(--ink-faint)',
            borderColor: variant.available ? 'var(--accent)' : 'var(--border)',
          }}>
          {variant.available ? 'On' : 'Off'}
        </button>
      </div>
      <button type="button" onClick={onRemove}
        style={{ alignSelf: 'flex-start', fontSize: '0.78rem', color: '#c0392b', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer' }}>
        ✕
      </button>
    </div>
  );
}

function VariantEditor({ product, fetchData, onClose, embedded }) {
  // Normalise dim.values into the { value, priceModifier } object shape on
  // mount so the editor never has to branch on legacy bare strings.
  const [dims, setDims] = useState((product.variantDimensions || []).map(d => ({
    name: d.name,
    values: getDimValues(d).map(v => ({ ...v })),
  })));
  const [variants, setVariants] = useState((product.variants || []).map(v => {
    // Mongoose Map → plain object for editing
    const attrs = v.attributes && typeof v.attributes.get === 'function'
      ? Object.fromEntries(v.attributes) : { ...(v.attributes || {}) };
    return {
      _id: v._id, attributes: attrs, stock: v.stock ?? -1, price: v.price ?? '',
      sku: v.sku || '', available: v.available !== false,
      imageUrl: v.image?.url || '', imageAlt: v.image?.altText || '',
    };
  }));
  const [vImages, setVImages] = useState((product.variantImages || []).map(i => ({ _id: i._id, url: i.url, publicId: i.publicId || '', appliesTo: { ...(i.appliesTo || {}) } })));
  const [saving, setSaving] = useState(false);
  const [newDimName, setNewDimName] = useState('');
  const [newDimValues, setNewDimValues] = useState({});
  const [converting, setConverting] = useState(false);
  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  const generateCombos = () => {
    if (!dims.length || dims.some(d => !d.values.length)) return;
    const existing = variants.map(v => JSON.stringify(v.attributes));
    const combos = dims.reduce(
      (acc, d) => acc.flatMap(a => d.values.map(({ value }) => ({ ...a, [d.name]: value }))),
      [{}]
    );
    const newOnes = combos.filter(c => !existing.includes(JSON.stringify(c)));
    setVariants(v => [...v, ...newOnes.map(attrs => ({ attributes: attrs, stock: 0, price: '', sku: '', available: true }))]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        useVariants: true,
        variantDimensions: dims,
        variants: variants.map(v => {
          // Blank stock => 0 (OOS). Unlimited must be explicit (-1).
          const rawStock = (v.stock === '' || v.stock == null) ? 0 : Number(v.stock);
          return {
            _id: v._id,
            attributes: v.attributes,
            sku: v.sku,
            available: v.available,
            stock: Number.isNaN(rawStock) ? 0 : rawStock,
            price: v.price === '' || v.price == null ? null : Number(v.price),
            image: v.imageUrl?.trim() ? { url: v.imageUrl.trim(), altText: v.imageAlt || '' } : { url: '', altText: '' },
          };
        }),
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

  const wrapperClass = embedded ? '' : 'admin-inline-panel';
  const wrapperStyle = embedded ? { paddingTop: '12px' } : null;

  return (
    <div className={wrapperClass} style={wrapperStyle}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {d.values.map((v, vi) => (
                <span key={vi} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 4px 2px 10px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 500 }}>
                  {/* Value name — editable inline */}
                  <input
                    value={v.value}
                    onChange={e => setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: dd.values.map((x, j) => j !== vi ? x : { ...x, value: e.target.value }) }))}
                    style={{ border: 'none', background: 'transparent', padding: 0, fontSize: '0.72rem', width: `${Math.max(4, v.value.length)}ch`, minWidth: '3ch', color: 'inherit', outline: 'none', fontWeight: 500 }} />
                  {/* Per-value price modifier (blank/0 hides the badge customer-side). */}
                  <input type="number"
                    value={v.priceModifier === 0 ? '' : v.priceModifier}
                    onChange={e => setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: dd.values.map((x, j) => j !== vi ? x : { ...x, priceModifier: e.target.value === '' ? 0 : Number(e.target.value) || 0 }) }))}
                    placeholder="±₱"
                    title="Price modifier for this value"
                    style={{ border: 'none', borderLeft: '1px solid rgba(46,93,75,0.25)', background: 'transparent', padding: '0 2px 0 6px', fontSize: '0.68rem', width: '5ch', color: 'var(--accent)', outline: 'none' }} />
                  <button onClick={() => setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: dd.values.filter((_, j) => j !== vi) }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.7rem', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
                </span>
              ))}
              <input className="form-input" style={{ ...inputSm, width: 100, borderStyle: 'dashed' }} placeholder="+ value"
                value={newDimValues[di] || ''}
                onChange={e => setNewDimValues(p => ({ ...p, [di]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newDimValues[di]?.trim()) {
                    setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: [...dd.values, { value: newDimValues[di].trim(), priceModifier: 0 }] }));
                    setNewDimValues(p => ({ ...p, [di]: '' }));
                    e.preventDefault();
                  }
                }} />
              {newDimValues[di]?.trim() && (
                <button onClick={() => {
                  setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: [...dd.values, { value: newDimValues[di].trim(), priceModifier: 0 }] }));
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {variants.map((v, vi) => (
              <EditVariantRowCard key={vi}
                variant={v} idx={vi} dimensions={dims}
                onChange={patch => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, ...patch }))}
                onChangeAttr={(name, val) => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, attributes: { ...vv.attributes, [name]: val } }))}
                onRemove={() => setVariants(p => p.filter((_, i) => i !== vi))} />
            ))}
          </div>
        )}
        <button onClick={() => setVariants(p => [...p, { attributes: Object.fromEntries(dims.map(d => [d.name, d.values[0]?.value || ''])), stock: 0, price: '', sku: '', available: true, imageUrl: '', imageAlt: '' }])}
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
                      {d.values.map(({ value }) => <option key={value} value={value}>{value}</option>)}
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
    if (product.isActive) {
      const ok = window.confirm(
        `Archive "${product.name}"?\n\n• It will be hidden from the shop and product page.\n• Any customer carts that still contain it will have it removed.\n• Past orders are unaffected — the product stays visible in order history.\n\nYou can activate it again later.`
      );
      if (!ok) return;
    }
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
  // One card open at a time. Key includes type prefix so in-stock and GB IDs don't collide.
  const [expandedKey, setExpandedKey] = useState(null);
  const toggleExpanded = (key) => setExpandedKey(prev => prev === key ? null : key);

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
          {unified.map(entry => {
            const key = entry.type === 'instock' ? 'is-' + entry.order._id : 'gb-' + entry.group.key;
            return entry.type === 'instock' ? (
              <OrderRow key={key} order={entry.order} fetchOrders={fetchOrders} updateOrderLocal={updateOrderLocal}
                typeTag={{ label: 'In Stock', className: 'status-amber' }}
                expanded={expandedKey === key} onToggle={() => toggleExpanded(key)} />
            ) : (
              <UnifiedGBOrderCard key={key}
                items={entry.group.items}
                updateOrderLocal={updateGbOrderLocal}
                parentGbId={entry.group.items.find(i => !i.groupBuyId?.parentGroupBuyId)?.groupBuyId?._id || entry.group.items[0]?.groupBuyId?._id}
                fetchOrders={fetchOrders}
                typeTag={{ label: 'Group Buy', className: 'status-red' }}
                expanded={expandedKey === key} onToggle={() => toggleExpanded(key)} />
            );
          })}
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

function OrderRow({ order, fetchOrders, updateOrderLocal, typeTag, expanded: extExpanded, onToggle: extOnToggle }) {
  const [intExpanded, setIntExpanded] = useState(false);
  const expanded = extExpanded !== undefined ? extExpanded : intExpanded;
  const onToggle = () => (extOnToggle ? extOnToggle() : setIntExpanded(e => !e));
  const [updating, setUpdating] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const updateStatus = async (newStatus) => {
    if (newStatus === 'Cancelled' && order.status !== 'Cancelled' &&
        !window.confirm('Cancel the entire order?\n\nStock will be restored and the customer will be automatically refunded for every item. This is hard to undo cleanly.')) return;
    if (order.status === 'Cancelled' && newStatus !== 'Cancelled' &&
        !window.confirm('Reactivate this order?\n\nStock will be re-deducted and the customer will be automatically recharged. Proceed?')) return;
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
    const item = items.find(it => it._id === itemId);
    const wasCancelled = item?.status === 'Cancelled';
    if (newStatus === 'Cancelled' && !wasCancelled &&
        !window.confirm('Cancel this item?\n\nStock will be restored and the customer will be automatically refunded for this item. The item will appear struck-through in their order history.')) return;
    if (wasCancelled && newStatus !== 'Cancelled' &&
        !window.confirm('Reactivate this item?\n\nStock will be re-deducted and the customer will be automatically recharged for this item. Proceed?')) return;
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
  const togglePacked = async (itemId, current) => {
    setUpdatingItemId(itemId);
    try {
      const res = await apiFetch(`/orders/${order._id}/items/${itemId}/packed`, { method: 'PATCH', body: JSON.stringify({ packed: !current }) });
      if (res.order && updateOrderLocal) updateOrderLocal(order._id, res.order);
      else fetchOrders?.();
    } catch (err) { toast.error(err.message); fetchOrders?.(); }
    finally { setUpdatingItemId(null); }
  };
  const customer = order.userId;
  const name = typeof customer === 'object' ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Unknown';
  const email = typeof customer === 'object' ? customer.email : '';
  const phone = typeof customer === 'object' ? customer.mobileNo : '';
  const orderNum = order.orderNumber || order._id.slice(-8).toUpperCase();
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
  const primaryThumb = items[0]?.productImage || null;
  const primaryItemName = items[0]?.productName || 'Order';
  const extraItemCount = Math.max(0, items.length - 1);

  return (
    <div style={{
      background: 'var(--surface)',
      border: expanded ? '1px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      boxShadow: expanded ? '0 8px 24px rgba(0,0,0,0.12), 0 0 0 3px var(--accent-light)' : 'none',
      transition: 'box-shadow 0.2s, border-color 0.2s',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'grid', gridTemplateColumns: 'auto auto 1fr 1fr 1fr auto auto',
          gap: '16px', alignItems: 'center',
          padding: '14px 20px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--ink)',
        }}
        className="admin-order-header"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--ink-muted)' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {primaryThumb
            ? <img src={primaryThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.4rem', color: 'var(--accent)' }}>{primaryItemName?.[0] || 'O'}</span>}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Order</p>
            {typeTag && <span className={`status-badge ${typeTag.className || 'status-amber'}`} style={{ fontSize: '0.55rem', padding: '2px 6px', letterSpacing: '0.04em' }}>{typeTag.label}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.95rem' }}>{orderNum}</p>
            <CopyButton value={orderNum} label="Order number" />
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginTop: 2 }}>
            {primaryItemName}{extraItemCount > 0 && <span> + {extraItemCount} more</span>}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Customer</p>
          <p style={{ fontSize: '0.86rem', fontWeight: 500, marginTop: 2 }}>{name || '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Date</p>
          <p style={{ fontSize: '0.86rem', marginTop: 2 }}>{new Date(order.createdAt).toLocaleDateString()}</p>
        </div>
        <StatusBadge status={order.status} />
        <span style={{ fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
          ₱{(subtotal + (order.shippingFee || 0)).toLocaleString()}
          {cancelledTotal > 0 && <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400, color: 'var(--ink-faint)', textAlign: 'right' }}>−₱{cancelledTotal.toLocaleString()} cancelled</span>}
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '18px 22px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            <Detail label="Customer" value={name || '—'} copyable />
            <Detail label="Email" value={email || '—'} copyable />
            <Detail label="Phone" value={phone || ship?.phone || '—'} copyable />
            <Detail label="Placed" value={new Date(order.createdAt).toLocaleString()} />
            <Detail label="Payment status" value={order.paymentStatus || '—'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }} className="admin-order-addresses">
            <AddressBlock title="Shipping Address" addr={ship} />
            <AddressBlock title="Billing Address" addr={billSameAsShip ? null : bill} sameAsShipping={billSameAsShip} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: 8 }}>
              {(() => {
                const liveItems = items.filter(it => it.status !== 'Cancelled');
                const packedCount = liveItems.filter(it => it.packed).length;
                const allPacked = liveItems.length > 0 && packedCount === liveItems.length;
                return (
                  <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                    Items ({items.length})
                    {liveItems.length > 0 && (
                      <span style={{ marginLeft: 10, color: allPacked ? 'var(--accent)' : 'var(--ink-muted)' }}>
                        · {packedCount}/{liveItems.length} packed{allPacked ? ' ✓' : ''}
                      </span>
                    )}
                  </p>
                );
              })()}
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
                const busy = updatingItemId === item._id || !item._id;
                const itemThumb = item.productImage;
                const optionLabel = item.selectedOption?.value
                  ? `${item.selectedOption.groupName}: ${item.selectedOption.value}` : '';
                const variantLabel = item.variantAttributes
                  ? Object.entries(typeof item.variantAttributes === 'object' ? item.variantAttributes : {}).map(([k, v]) => `${k}: ${v}`).join(' · ')
                  : '';
                const configLabel = (item.configurations || []).map(c => `${c.name}: ${c.selected}`).join(' · ');
                return (
                  <div key={item._id || i} style={{ padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', opacity: cancelled ? 0.55 : 1, background: cancelled ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.02) 8px, rgba(0,0,0,0.02) 16px)' : 'transparent' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto auto', gap: 12, alignItems: 'center' }}>
                      {/* Packing checklist — admin ticks as items go into the customer's box */}
                      <label title={cancelled ? 'Cancelled — cannot pack' : (item.packed ? 'Packed — uncheck to revert' : 'Mark as packed')}
                        style={{ display: 'flex', alignItems: 'center', cursor: cancelled ? 'not-allowed' : 'pointer' }}>
                        <input type="checkbox" checked={!!item.packed} disabled={busy || cancelled}
                          onChange={() => togglePacked(item._id, item.packed)}
                          style={{ width: 16, height: 16, cursor: cancelled ? 'not-allowed' : 'pointer', accentColor: 'var(--accent)' }} />
                      </label>
                      <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {itemThumb
                          ? <img src={itemThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: 'var(--accent)' }}>{item.productName?.[0] || '?'}</span>}
                      </div>
                      <div style={{ minWidth: 0, color: item.packed && !cancelled ? 'var(--ink-muted)' : 'inherit' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                          {item.addedAfterPurchase && (
                            <span className="status-badge status-green" style={{ fontSize: '0.58rem', padding: '2px 6px' }}>Added</span>
                          )}
                          {/* Title includes the selected option inline so packers can scan at a glance. */}
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, textDecoration: cancelled ? 'line-through' : (item.packed ? 'line-through' : 'none') }}>
                            {item.productName}{optionLabel ? ` — ${optionLabel}` : ''}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>× {item.quantity}</span>
                        </div>
                        {(variantLabel || configLabel) && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>{variantLabel || configLabel}</p>
                        )}
                      </div>
                      {!cancelled ? (
                        <button type="button" onClick={() => updateItemStatus(item._id, 'Cancelled')} disabled={busy}
                          title="Cancel this item — restores stock"
                          style={{ fontSize: '0.7rem', color: '#c0392b', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '3px 9px', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      ) : (
                        <button type="button" onClick={() => updateItemStatus(item._id, 'Pending')} disabled={busy}
                          title="Reactivate this item"
                          style={{ fontSize: '0.7rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '3px 9px', cursor: 'pointer' }}>
                          Reactivate
                        </button>
                      )}
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', textDecoration: cancelled ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>₱{item.subtotal?.toLocaleString()}</span>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Order status:</span>
            <select value={order.status} onChange={e => updateStatus(e.target.value)} disabled={updating}
              style={{
                fontSize: '0.7rem', padding: '4px 26px 4px 12px', width: 'auto', borderRadius: 'var(--radius-pill)',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
                letterSpacing: '0.05em', textTransform: 'uppercase',
                ...statusStyle(order.status),
                border: 'none', outline: 'none',
                appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='${encodeURIComponent(statusStyle(order.status).color)}' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '10px 10px',
              }}>
              {statuses.map(s => <option key={s} value={s} style={{ background: 'var(--surface)', color: 'var(--ink)', fontWeight: 400 }}>{s}</option>)}
            </select>
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
              Processing+ locks the customer's add-link.
            </span>
          </div>
        </div>
      )}
      <style>{`
        .admin-order-header:hover { background: var(--bg-secondary) !important; }
        .copy-btn:hover { opacity: 0.95 !important; color: var(--accent) !important; }
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
              <option key={o.value} value={o.value}>{o.value}{priceDelta(o.priceModifier) ? ` (${priceDelta(o.priceModifier)})` : ''}</option>
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

// Small inline copy-to-clipboard button. Lowkey by default; brightens on hover.
export function CopyButton({ value, label }) {
  // Span (not button) so it can nest inside another <button> without invalid HTML.
  const onClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label || 'Value'} copied`);
    } catch {
      toast.error('Copy failed');
    }
  };
  return (
    <span role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { onClick(e); } }}
      title={`Copy ${label?.toLowerCase() || 'value'}`}
      className="copy-btn"
      style={{ display: 'inline-flex', cursor: 'pointer', padding: 2, lineHeight: 0, color: 'var(--ink-faint)', opacity: 0.45, transition: 'opacity 0.15s' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    </span>
  );
}

export function Detail({ label, value, mono, copyable, copyValue }) {
  const stringValue = typeof value === 'string' ? value : (value != null ? String(value) : '');
  return (
    <div>
      <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 2 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <p style={{ fontSize: '0.86rem', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value || '—'}</p>
        {copyable && stringValue && stringValue !== '—' && <CopyButton value={copyValue || stringValue} label={label} />}
      </div>
    </div>
  );
}

// Accepts either `postalCode` (in-stock orders) or `zipCode` (GB orders) so a single
// component can render both without prop juggling. Header has a copy button that copies
// the formatted address as a single block (good for pasting into shipping forms).
export function AddressBlock({ title, addr, sameAsShipping }) {
  const cityLine = addr ? [addr.city, addr.province, addr.postalCode || addr.zipCode].filter(Boolean).join(', ') : '';
  const addressOnly = addr ? [addr.street, cityLine].filter(Boolean).join('\n') : '';
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{title}</p>
        {!sameAsShipping && addr && addressOnly && <CopyButton value={addressOnly} label={`${title} (street only)`} />}
      </div>
      {sameAsShipping ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>Same as shipping address</p>
      ) : addr ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{addr.fullName || '—'}</p>
            {addr.fullName && <CopyButton value={addr.fullName} label="Name" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>{addr.phone || '—'}</p>
            {addr.phone && <CopyButton value={addr.phone} label="Phone" />}
          </div>
          <p style={{ fontSize: '0.84rem', marginTop: 6, lineHeight: 1.5 }}>
            {addr.street || '—'}<br />
            {cityLine || '—'}
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
export function CollapsibleSection({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="modal-section" style={{ padding: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif", textAlign: 'left',
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="modal-section-title" style={{ margin: 0 }}>{title}</span>
          {summary && (
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', fontWeight: 400 }}>
              {summary}
            </span>
          )}
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"
          style={{ color: 'var(--ink-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M3 5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
    </div>
  );
}

// Per-row variant editor — wraps to the container width so admins never have
// to scroll horizontally regardless of how many dimensions exist. Each row owns:
// dimension selectors (or read-only labels in matrix), stock, price, image URL.
export function VariantRowCard({ row, idx, mode, dimensions, onUpdateAttr, onUpdateField, onRemove }) {
  const [uploadingImg, setUploadingImg] = useState(false);
  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImg(true);
    try { onUpdateField(idx, 'imageUrl', await uploadOptionImage(file)); }
    catch (err) { toast.error(err.message || 'Upload failed'); }
    finally { setUploadingImg(false); }
  };
  const isAvailable = row.available !== false;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10, opacity: isAvailable ? 1 : 0.55 }}>
      {row.imageUrl
        ? <img src={row.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', flexShrink: 0 }} />
        : <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '1.3rem' }}>🖼</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', flex: '1 1 260px', minWidth: 0 }}>
        {dimensions.map(d => (
          <label key={d.name} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{d.name}</span>
            {mode === 'list' ? (
              <select className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', width: 'auto', minWidth: 90 }}
                value={row.attrs[d.name] || ''}
                onChange={e => onUpdateAttr(idx, d.name, e.target.value)}>
                <option value="">—</option>
                {getDimValues(d).map(({ value }) => <option key={value} value={value}>{value}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: '0.84rem', padding: '5px 0' }}>{row.attrs[d.name] || '—'}</span>
            )}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Stock</span>
          <input type="number" placeholder="0"
            className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', width: 70 }}
            title="Stock count. Blank = 0 (OOS). Type -1 for unlimited."
            value={row.stock} onChange={e => onUpdateField(idx, 'stock', e.target.value)} />
        </label>
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>± Price</span>
          <input type="number" placeholder="0"
            className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', width: 80 }}
            value={row.price} onChange={e => onUpdateField(idx, 'price', e.target.value)} />
          {priceDelta(row.price) && (
            <span style={{ fontSize: '0.62rem', color: Number(row.price) >= 0 ? 'var(--accent)' : '#c0392b' }}>{priceDelta(row.price)}</span>
          )}
        </label>
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>SKU</span>
          <input className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', width: 90 }}
            value={row.sku || ''} onChange={e => onUpdateField(idx, 'sku', e.target.value)} />
        </label>
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, flex: '1 1 180px', minWidth: 160 }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Image</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="text" placeholder="URL or upload"
              className="form-input" style={{ fontSize: '0.78rem', padding: '5px 8px', flex: 1, minWidth: 0 }}
              value={row.imageUrl || ''} onChange={e => onUpdateField(idx, 'imageUrl', e.target.value)} />
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '4px 8px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', background: 'var(--accent-light)',
                color: 'var(--accent)', cursor: uploadingImg ? 'wait' : 'pointer', fontSize: '0.72rem', whiteSpace: 'nowrap',
              }}>
              {uploadingImg ? '…' : '↑'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageFile} disabled={uploadingImg} style={{ display: 'none' }} />
            </label>
          </div>
        </label>
        <button type="button" onClick={() => onUpdateField(idx, 'available', !isAvailable)} title="Toggle available"
          style={{
            alignSelf: 'flex-end', fontSize: '0.66rem', padding: '5px 10px', borderRadius: '10px',
            border: '1px solid', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            background: isAvailable ? 'var(--accent-light)' : 'transparent',
            color: isAvailable ? 'var(--accent)' : 'var(--ink-faint)',
            borderColor: isAvailable ? 'var(--accent)' : 'var(--border)',
          }}>
          {isAvailable ? 'On' : 'Off'}
        </button>
      </div>
      {mode === 'list' && (
        <button type="button" onClick={() => onRemove(idx)}
          style={{ alignSelf: 'flex-start', fontSize: '0.78rem', color: '#c0392b', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer' }}>
          ✕
        </button>
      )}
    </div>
  );
}

function CreateProductModal({ onClose, onCreated, forcedParentId, forcedParentName, products = [] }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', stocks: '', category: '' });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [urlInputCreate, setUrlInputCreate] = useState('');
  const [urlPreviews, setUrlPreviews] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  // Variant-tagged images: each entry has a URL and an appliesTo map
  // (dimension → value). Missing keys = "Any" for that dimension. Customer
  // page picks the most-specific matching image; matches the `variantImages`
  // schema on the Product model.
  const [variantImages, setVariantImages] = useState([]);
  const [uploadingVImage, setUploadingVImage] = useState(false);
  // Long-form marketing content rendered below the buy section via
  // LandingPageRenderer. Optional — most products won't use it.
  const [landingPage, setLandingPage] = useState([]);
  // Hand-coded HTML rendered below the buy section. Wins over landingPage
  // when set. Used for flagship-style pages where the block editor can't
  // produce the desired look.
  const [customPageHtml, setCustomPageHtml] = useState('');
  // Admin-curated cross-sell. Empty = customer page auto-derives.
  const [pinnedAddOnIds, setPinnedAddOnIds] = useState([]);
  const [pinnedRelatedIds, setPinnedRelatedIds] = useState([]);

  // Esc closes — backdrop click is intentionally disabled so a stray click
  // outside the modal body doesn't blow away in-progress form work.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Known categories from existing products — fuels the category combobox so
  // admins can pick rather than retyping (and avoid typo-driven duplicates).
  const knownCategories = Array.from(new Set((products || []).map(p => (p.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  // Variants state — dimensions + per-combination stock/price.
  // Two modes:
  //  • matrix → cartesian product auto-generated, bulk-fill helps fill the grid.
  //  • list   → admin manually adds the SKUs that actually exist; no shadow rows.
  const [variantMode, setVariantMode] = useState('list'); // 'matrix' | 'list'
  const [variantDimensions, setVariantDimensions] = useState([]); // [{ name, values: [] }]
  const [newDim, setNewDim] = useState({ name: '', values: '' });
  const [variantRows, setVariantRows] = useState([]); // [{ attrs: {dim:val}, stock, price }]
  const [bulkStock, setBulkStock] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');

  // Auto-generate cartesian product in matrix mode; in list mode, leave rows alone
  // and only prune values that no longer exist on a dimension.
  // Adding a new dimension preserves existing stock/price by matching against the
  // subset of dimensions both rows share (so adding "Weight" to Color×Layout rows
  // expands each existing pair into N rows that all start with the original values).
  useEffect(() => {
    if (variantMode === 'list') {
      setVariantRows(prev => prev.map(r => {
        const attrs = { ...r.attrs };
        // Drop attrs whose dimension was removed or whose value no longer exists.
        for (const k of Object.keys(attrs)) {
          const d = variantDimensions.find(d => d.name === k);
          if (!d || !getDimValues(d).some(v => v.value === attrs[k])) delete attrs[k];
        }
        // Default any newly-added dimensions to the first available value.
        for (const d of variantDimensions) {
          if (attrs[d.name] == null) attrs[d.name] = getDimValues(d)[0]?.value || '';
        }
        return { ...r, attrs };
      }));
      return;
    }
    if (variantDimensions.length === 0) { setVariantRows([]); return; }
    const combos = variantDimensions.reduce(
      (acc, d) => acc.flatMap(a => getDimValues(d).map(({ value }) => ({ ...a, [d.name]: value }))),
      [{}]
    );
    setVariantRows(prev => combos.map(attrs => {
      // Find any prior row whose remaining attrs (after removing dims that no
      // longer exist) match this combo on the shared keys. The first match wins.
      const existing = prev.find(r => Object.entries(r.attrs).every(([k, v]) => {
        const stillExists = variantDimensions.some(d => d.name === k);
        if (!stillExists) return true;
        return attrs[k] === v;
      }));
      return existing ? { ...existing, attrs } : { attrs, stock: '', price: '' };
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
    for (const d of variantDimensions) attrs[d.name] = getDimValues(d)[0]?.value || '';
    setVariantRows(rows => [...rows, { attrs, stock: '', price: '' }]);
  };
  const updateListVariantAttr = (idx, dimName, val) => {
    setVariantRows(rows => rows.map((r, i) => i === idx ? { ...r, attrs: { ...r.attrs, [dimName]: val } } : r));
  };
  const removeListVariant = (idx) => setVariantRows(rows => rows.filter((_, i) => i !== idx));

  const addDimension = () => {
    const name = newDim.name.trim();
    // Comma-separated input becomes one { value, priceModifier: 0 } per entry.
    // Admins set the modifier per value inline once the dimension is added.
    const values = newDim.values.split(',').map(s => s.trim()).filter(Boolean)
      .map(v => ({ value: v, priceModifier: 0 }));
    if (!name || values.length === 0) return;
    setVariantDimensions(d => [...d, { name, values }]);
    setNewDim({ name: '', values: '' });
  };
  const removeDimension = (di) => setVariantDimensions(d => d.filter((_, i) => i !== di));
  // Inline edit helpers — let admins fix typos in the dimension name or
  // individual values without nuking the whole dimension and starting over.
  // The matrix-rebuild effect handles variant row resync after edits.
  const updateDimensionName = (di, name) =>
    setVariantDimensions(d => d.map((dim, i) => i !== di ? dim : { ...dim, name }));
  // patch is { value?, priceModifier? } — merged onto the existing value entry.
  // Legacy bare-string entries get upgraded to the object form on first edit.
  const updateDimensionValue = (di, vi, patch) =>
    setVariantDimensions(d => d.map((dim, i) => i !== di ? dim : {
      ...dim, values: dim.values.map((v, j) => {
        if (j !== vi) return v;
        const current = typeof v === 'string' ? { value: v, priceModifier: 0 } : v;
        return { ...current, ...patch };
      }),
    }));
  const removeDimensionValue = (di, vi) =>
    setVariantDimensions(d => d.map((dim, i) => i !== di ? dim : {
      ...dim, values: dim.values.filter((_, j) => j !== vi),
    }));
  const addDimensionValue = (di, val) => {
    const v = val.trim();
    if (!v) return;
    setVariantDimensions(d => d.map((dim, i) => i !== di ? dim : {
      ...dim,
      values: dim.values.some(x => (typeof x === 'string' ? x : x?.value) === v)
        ? dim.values
        : [...dim.values, { value: v, priceModifier: 0 }],
    }));
  };
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

      // Top-level metadata fields — all optional. Applied only if present and
      // non-placeholder. The admin can still hand-edit anything after import.
      const isPlaceholder = (v) => typeof v === 'string' && /^PLACEHOLDER_/.test(v);
      const metaPatch = {};
      if (typeof data.name === 'string' && data.name.trim() && !isPlaceholder(data.name)) metaPatch.name = data.name.trim();
      if (typeof data.price === 'number' && data.price > 0) metaPatch.price = String(data.price);
      if (typeof data.stocks === 'number') metaPatch.stocks = data.stocks === -1 ? '' : String(data.stocks);
      if (typeof data.category === 'string' && data.category.trim() && !isPlaceholder(data.category)) metaPatch.category = data.category.trim();
      if (Object.keys(metaPatch).length > 0) setForm(f => ({ ...f, ...metaPatch }));

      let importedSpecs = 0;
      if (Array.isArray(data.specifications) && data.specifications.length > 0) {
        const cleanedSpecs = data.specifications
          .filter(s => s && s.label && s.value && !isPlaceholder(s.label) && !isPlaceholder(s.value))
          .map(s => ({ label: String(s.label).trim(), value: String(s.value).trim() }));
        if (cleanedSpecs.length > 0) {
          setSpecs(cleanedSpecs);
          importedSpecs = cleanedSpecs.length;
        }
      }

      // Options: import if present (independent of dimensions/variants).
      let importedOptions = 0;
      if (Array.isArray(data.options) && data.options.length > 0) {
        const cleanedOptions = data.options
          .filter(g => g && g.name && Array.isArray(g.values) && !isPlaceholder(g.name))
          .map(g => ({
            name: String(g.name).trim(),
            values: g.values.filter(v => v?.value && !isPlaceholder(v.value)).map(v => ({
              value: String(v.value).trim(),
              price: Number(v.price) || 0,
              stocks: v.stocks == null ? -1 : Number(v.stocks),
              available: v.available !== false,
              image: { url: v.image?.url?.trim() || '', altText: v.image?.altText || String(v.value).trim() },
            })),
          }))
          .filter(g => g.values.length > 0);
        if (cleanedOptions.length > 0) {
          setOptionGroups(cleanedOptions);
          importedOptions = cleanedOptions.length;
        }
      }

      const dims = Array.isArray(data.dimensions) ? data.dimensions
        .filter(d => d && d.name && Array.isArray(d.values) && !isPlaceholder(d.name))
        .map(d => ({
          name: String(d.name).trim(),
          // Accept either bare strings (legacy / minimal AI output) or
          // { value, priceModifier } objects. Default modifier is 0.
          values: d.values.map(v => {
            if (typeof v === 'string') {
              const trimmed = v.trim();
              return trimmed ? { value: trimmed, priceModifier: 0 } : null;
            }
            if (v && typeof v === 'object' && v.value) {
              const trimmed = String(v.value).trim();
              return trimmed ? { value: trimmed, priceModifier: Number(v.priceModifier) || 0 } : null;
            }
            return null;
          }).filter(v => v && !isPlaceholder(v.value)),
        }))
        .filter(d => d.values.length > 0)
        : [];

      const summary = [];
      if (Object.keys(metaPatch).length > 0) summary.push(`${Object.keys(metaPatch).length} field${Object.keys(metaPatch).length === 1 ? '' : 's'}`);
      if (importedSpecs > 0) summary.push(`${importedSpecs} spec${importedSpecs === 1 ? '' : 's'}`);
      if (importedOptions > 0) summary.push(`${importedOptions} option group${importedOptions === 1 ? '' : 's'}`);

      if (dims.length === 0) {
        if (summary.length === 0) {
          toast.error('JSON had nothing usable. Include name/price/category, options, or dimensions+variants.');
          return;
        }
        setShowJsonImport(false);
        setJsonImportText('');
        toast.success(`Imported ${summary.join(', ')}.`);
        return;
      }
      setVariantDimensions(dims);
      const incoming = Array.isArray(data.variants) ? data.variants : [];

      if (variantMode === 'list') {
        // List mode: only import the SKUs listed; ignore unspecified combinations entirely.
        // Stock semantics: -1 (unlimited) MUST round-trip — collapsing it to blank
        // here would silently flip the variant to OOS (since blank now saves as 0).
        const rows = incoming.map(v => {
          const attrs = {};
          for (const d of dims) attrs[d.name] = String(v?.attributes?.[d.name] ?? '');
          return {
            attrs,
            stock: v.stock == null ? '' : String(v.stock),
            price: v.price == null ? '' : String(v.price),
            sku: v.sku || '',
            available: v.available !== false,
            imageUrl: v.image?.url || '',
          };
        });
        setVariantRows(rows);
        setShowJsonImport(false);
        setJsonImportText('');
        const tail = [`${dims.length} dimension${dims.length === 1 ? '' : 's'}`, `${rows.length} SKU${rows.length === 1 ? '' : 's'}`];
        toast.success(`Imported ${[...summary, ...tail].join(', ')}.`);
        return;
      }

      // Matrix mode: build full cartesian product and merge incoming values.
      // CRITICAL: combos missing from the JSON must NOT default to unlimited stock.
      // If the JSON is sparse (fewer variants than the cartesian product), the user's
      // intent is "only these SKUs exist" — switch to list mode and keep only those.
      const combos = dims.reduce(
        (acc, d) => acc.flatMap(a => getDimValues(d).map(({ value }) => ({ ...a, [d.name]: value }))),
        [{}]
      );
      const findIncoming = (attrs) => incoming.find(v => {
        const va = v?.attributes || {};
        return dims.every(d => va[d.name] === attrs[d.name]);
      });

      if (incoming.length < combos.length) {
        // Sparse import → list mode (only the SKUs the human enumerated exist).
        // Keep -1 as -1 so unlimited round-trips (blank now saves as 0).
        setVariantMode('list');
        const rows = incoming.map(v => {
          const attrs = {};
          for (const d of dims) attrs[d.name] = String(v?.attributes?.[d.name] ?? '');
          return {
            attrs,
            stock: v.stock == null ? '' : String(v.stock),
            price: v.price == null ? '' : String(v.price),
            sku: v.sku || '',
            available: v.available !== false,
            imageUrl: v.image?.url || '',
          };
        });
        setVariantRows(rows);
        setShowJsonImport(false);
        setJsonImportText('');
        const tail = [`${dims.length} dimension${dims.length === 1 ? '' : 's'}`, `${rows.length} SKU${rows.length === 1 ? '' : 's'}`, `switched to list mode (${combos.length - incoming.length} combos not declared)`];
        toast.success(`Imported ${[...summary, ...tail].join(', ')}.`);
        return;
      }

      setVariantRows(combos.map(attrs => {
        const m = findIncoming(attrs);
        // Missing combo → blank (saves as 0 OOS). Existing -1 must round-trip.
        if (!m) return { attrs, stock: '', price: '' };
        return {
          attrs,
          stock: m.stock == null ? '' : String(m.stock),
          price: m.price == null ? '' : String(m.price),
          sku: m.sku || '',
          available: m.available !== false,
          imageUrl: m.image?.url || '',
        };
      }));
      setShowJsonImport(false);
      setJsonImportText('');
      const tail = [`${dims.length} dimension${dims.length === 1 ? '' : 's'}`, `${combos.length} variant${combos.length === 1 ? '' : 's'}`];
      toast.success(`Imported ${[...summary, ...tail].join(', ')}.`);
    } catch (err) {
      toast.error('Invalid JSON: ' + (err.message || 'parse error'));
    }
  };

  // Full JSON template with embedded instructions for AI. Every PLACEHOLDER_*
  // value is a stand-in; the AI should replace them based on what the human
  // describes (dimensions, values, in-stock vs out-of-stock combinations).
  const sampleVariantJson = JSON.stringify({
    "_instructions_for_ai": [
      "You are converting a product's inventory + metadata into this exact JSON shape so it can be imported into the admin form.",
      "The human will tell you: (a) optionally the product's name / base price / stocks / category / specifications, (b) the dimension names and their possible values, (c) which combinations exist, and (d) which of those are in stock vs out of stock.",
      "OUTPUT ONLY the JSON object — no prose, no markdown fences. Remove this _instructions_for_ai field from your final output.",
      "EVERY TOP-LEVEL FIELD IS OPTIONAL. Include only the ones the human gave you. Omit any field they did not mention — the admin will fill that field in manually.",
      "NEVER include 'description'. The admin always writes that field by hand. If you generated a description, drop it.",
      "Top-level fields: 'name' (string), 'price' (number, the product's base price), 'stocks' (top-level product stock — used ONLY when there are no options or variants; -1 unlimited / positive integer / omit for unlimited), 'category' (string, lowercased slug like 'keyboards'), 'specifications' (array of { label, value }).",
      "Inventory sections: 'options' for price-modifying selectors (e.g. Kit, Edition); 'dimensions' + 'variants' for the variant matrix. Either section may be omitted entirely.",
      "STOCK semantics — IMPORTANT, two different defaults:",
      "  - VARIANT 'stock': positive integer = exact count; 0 = out of stock (exists but currently unbuyable); -1 = unlimited (must be explicit); OMITTING 'stock' or leaving it null is treated as 0 (OOS). If the human says a variant is 'in stock' but doesn't give a count, write a number — don't omit.",
      "  - OPTION-value 'stocks': positive integer = exact count; 0 = OOS; -1 or omit = unlimited (options default to unlimited because they're modifier choices, not inventory units).",
      "AVAILABLE FIELD on variants/options: true to show, false to hide entirely. A variant with stock 0 still shows (greyed out / OOS); set available:false to hide it completely.",
      "DOESN'T EXIST AT ALL (combo is impossible): simply omit that combination from the 'variants' array. Importer treats a sparse list as 'these are the only SKUs that exist'.",
      "PRICE FIELD on variants: null = use product base price; a number = EXTRA on top of base (can be negative to discount). On options it's the EXTRA on top of base too.",
      "SKU FIELD: leave empty string '' unless the human gives you SKU codes.",
      "IMAGE FIELD: leave url empty string '' unless the human provides per-variant image URLs.",
      "Match dimension names and values EXACTLY as the human said them (case + spelling).",
      "VARIANT COUNT IS NOT FIXED: the example entries below are illustrative only. Your 'variants' array should contain ONE entry per combination the human says exists — could be 1, could be hundreds. With N dimensions of sizes s1, s2, ..., sN, the max possible is s1 × s2 × ... × sN, and you should output every combination the human declares exists. Do not stop at the example length, and do not invent combinations they did not mention.",
      "READING KEY for the 4 example variants below: row 1 = limited stock (10); row 2 = explicit OOS (0); row 3 = unlimited (-1) with +200 upcharge; row 4 = limited (3) with -150 discount. Together they cover every meaningful (stock, price) combination — your output will mix and match these patterns based on what the human describes.",
      "If the human says 'all combinations exist' without exclusions, enumerate the full cartesian product (every combo of every value across all dimensions)."
    ],
    "name": "PLACEHOLDER_PRODUCT_NAME",
    "price": 0,
    "stocks": -1,
    "category": "PLACEHOLDER_CATEGORY",
    "specifications": [
      { "label": "PLACEHOLDER_SPEC_LABEL", "value": "PLACEHOLDER_SPEC_VALUE" }
    ],
    "options": [
      {
        "name": "PLACEHOLDER_GROUP_NAME (e.g. Kit, Edition)",
        "values": [
          { "value": "PLACEHOLDER_VALUE_1", "price": 0, "stocks": -1, "available": true, "image": { "url": "", "altText": "" } },
          { "value": "PLACEHOLDER_VALUE_2", "price": 100, "stocks": 10, "available": true, "image": { "url": "", "altText": "" } }
        ]
      }
    ],
    "dimensions": [
      { "name": "PLACEHOLDER_DIMENSION_1 (e.g. Color)", "values": ["PLACEHOLDER_VAL_A", "PLACEHOLDER_VAL_B"] },
      { "name": "PLACEHOLDER_DIMENSION_2 (e.g. Size)",  "values": ["PLACEHOLDER_VAL_X", "PLACEHOLDER_VAL_Y"] }
    ],
    "variants": [
      { "attributes": { "PLACEHOLDER_DIMENSION_1": "PLACEHOLDER_VAL_A", "PLACEHOLDER_DIMENSION_2": "PLACEHOLDER_VAL_X" }, "stock": 10, "price": null, "sku": "", "available": true, "image": { "url": "", "altText": "" } },
      { "attributes": { "PLACEHOLDER_DIMENSION_1": "PLACEHOLDER_VAL_A", "PLACEHOLDER_DIMENSION_2": "PLACEHOLDER_VAL_Y" }, "stock": 0,  "price": null, "sku": "", "available": true, "image": { "url": "", "altText": "" } },
      { "attributes": { "PLACEHOLDER_DIMENSION_1": "PLACEHOLDER_VAL_B", "PLACEHOLDER_DIMENSION_2": "PLACEHOLDER_VAL_X" }, "stock": -1, "price": 200,  "sku": "", "available": true, "image": { "url": "", "altText": "" } },
      { "attributes": { "PLACEHOLDER_DIMENSION_1": "PLACEHOLDER_VAL_B", "PLACEHOLDER_DIMENSION_2": "PLACEHOLDER_VAL_Y" }, "stock": 3,  "price": -150, "sku": "", "available": true, "image": { "url": "", "altText": "" } }
    ]
  }, null, 2);

  const [showJsonFormat, setShowJsonFormat] = useState(false);
  const copyJsonFormat = async () => {
    try {
      await navigator.clipboard.writeText(sampleVariantJson);
      toast.success('JSON format copied — feed it to your AI');
    } catch { toast.error('Copy failed'); }
  };

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

  // Drag-drop reorder for the two image preview rows. We keep the upload row
  // (images + imagePreviews) and the URL row independent so each can be
  // shuffled without crossing types. `images` and `imagePreviews` move
  // together so the underlying File[] stays in sync with what the admin sees.
  const reorderUploads = (from, to) => {
    if (from === to) return;
    setImages(prev => arrayMove(prev, from, to));
    setImagePreviews(prev => arrayMove(prev, from, to));
  };
  const reorderUrls = (from, to) => {
    if (from === to) return;
    setUrlPreviews(prev => arrayMove(prev, from, to));
  };


  const submitProduct = async (queued) => {
    setSubmitting(true);
    try {
      // Build everything up front so a follow-up PATCH includes the full payload
      // even when the create endpoint only accepts the basic fields.
      const filteredSpecs = specs.filter(s => s.label.trim() && s.value.trim());
      const buildVariants = () => {
        if (variantDimensions.length === 0) return null;
        // List mode: drop rows missing any attribute value (incomplete SKUs).
        const usable = variantMode === 'list'
          ? variantRows.filter(r => variantDimensions.every(d => r.attrs[d.name]))
          : variantRows;
        if (variantMode === 'list' && usable.length === 0) return null;
        // Blank stock defaults to 0 (OOS), not -1 (unlimited). Unlimited must be
        // explicit (admin types -1). This prevents the matrix from accidentally
        // creating unlimited-stock variants when cells are left empty.
        const variants = usable.map(r => ({
          attributes: r.attrs,
          stock: r.stock === '' || r.stock == null ? 0 : Number(r.stock),
          price: r.price === '' ? null : Number(r.price),
          available: r.available !== false,
          sku: r.sku?.trim() || '',
          image: r.imageUrl?.trim() ? { url: r.imageUrl.trim(), altText: '' } : undefined,
        }));
        return { useVariants: true, variantDimensions, variants };
      };
      const variantPayload = buildVariants();

      // Step 1 — create the bare product. Server controller currently only
      // accepts the basic fields, so options/specs/variants are persisted by
      // the follow-up PATCH below.
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
      console.log('[CreateProductModal] product created:', product?._id, product);

      // Step 2 — file uploads (multipart). Chunked to 20 per request so
      // exceeding the server's per-request file cap doesn't blow up the
      // whole submission. Multer otherwise rejects the 21st file with a
      // misleading "Unexpected field" error.
      if (images.length > 0) {
        const BATCH = 20;
        for (let i = 0; i < images.length; i += BATCH) {
          const slice = images.slice(i, i + BATCH);
          const fd = new FormData();
          slice.forEach(f => fd.append('images', f));
          await apiFetch(`/products/${product._id}/images`, { method: 'POST', body: fd });
        }
        console.log('[CreateProductModal] uploaded', images.length, 'file(s)');
      }

      // Step 3 — URL-added images. One call each.
      for (const up of urlPreviews) {
        await apiFetch(`/products/${product._id}/images/add-url`, {
          method: 'POST', body: JSON.stringify({ url: up.url }),
        });
      }
      if (urlPreviews.length > 0) console.log('[CreateProductModal] added', urlPreviews.length, 'url image(s)');

      // Step 4 — persist everything else. Always send a body when there is
      // anything to save, even if the condition was previously falsy. Logs the
      // payload so a network-failure cause is visible in the console.
      const usableVariantImages = variantImages.filter(v => v.url && v.url.trim());
      const lpBlocks = serializeLandingPage(landingPage);
      const trimmedCustomHtml = (customPageHtml || '').trim();
      const hasExtra = optionGroups.length > 0 || filteredSpecs.length > 0 || variantPayload || usableVariantImages.length > 0 || lpBlocks.length > 0 || trimmedCustomHtml.length > 0 || pinnedAddOnIds.length > 0 || pinnedRelatedIds.length > 0;
      if (hasExtra) {
        const patchBody = {
          options: optionGroups,
          specifications: filteredSpecs,
          ...(variantPayload || {}),
          ...(usableVariantImages.length > 0 ? { variantImages: usableVariantImages } : {}),
          ...(lpBlocks.length > 0 ? { landingPage: lpBlocks } : {}),
          ...(trimmedCustomHtml.length > 0 ? { customPageHtml: customPageHtml } : {}),
          ...(pinnedAddOnIds.length > 0 ? { pinnedAddOnIds } : {}),
          ...(pinnedRelatedIds.length > 0 ? { pinnedRelatedIds } : {}),
        };
        console.log('[CreateProductModal] PATCH /products/:id/update body:', patchBody);
        const patchResp = await apiFetch(`/products/${product._id}/update`, {
          method: 'PATCH',
          body: JSON.stringify(patchBody),
        });
        console.log('[CreateProductModal] PATCH response:', patchResp);
      } else {
        console.log('[CreateProductModal] skipping PATCH — nothing extra to save');
      }

      toast.success(queued ? 'Product queued' : 'Product created');
      onCreated();
    } catch (err) {
      console.error('[CreateProductModal] submit failed:', err);
      toast.error(err.message);
    }
    finally { setSubmitting(false); }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitProduct(false);
  };

  const inputSm = { fontSize: '0.78rem', padding: '7px 9px' };

  return (
    <div className="modal-overlay">
      <div className="modal-body">
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

          {/* Description — short product blurb shown beside the buy button.
              Marketing/long-form content goes into the Product Page Sections
              editor below (rendered under the buy section on the customer
              product page). Keeping the description compact prevents it from
              pushing the price / variants / add-to-cart below the fold. */}
          <div className="form-group">
            <label className="form-label">Description</label>
            <MarkdownEditor
              value={form.description}
              onChange={v => setForm(f => ({ ...f, description: v }))}
              required
              minHeight={110}
              placeholder="A short blurb shown next to the buy button. Long-form marketing content lives in Product Page Sections below." />
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
            <div className="form-group">
              <label className="form-label">Category</label>
              <CategoryPicker value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={knownCategories} placeholder="keyboards" />
            </div>
          </div>

          {/* Images */}
          <CollapsibleSection title="Images" summary={(imagePreviews.length + urlPreviews.length) > 0 ? `${imagePreviews.length + urlPreviews.length} added` : 'optional'}>
            <div className="img-upload-zone">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p>Click or drag to upload images (max 10MB each)</p>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
            </div>
            <DraggableThumbList
              items={imagePreviews}
              getSrc={p => p.url}
              getAlt={p => p.name}
              onReorder={reorderUploads}
              onRemove={removeImagePreview}
            />
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
            <DraggableThumbList
              items={urlPreviews}
              getSrc={p => p.url}
              onReorder={reorderUrls}
              onRemove={removeUrlPreview}
              extraStyle={{ marginTop: '8px' }}
            />
            {(imagePreviews.length + urlPreviews.length) > 1 && (
              <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: '6px' }}>
                Drag thumbnails to reorder. The first image is the main/cover image. Uploads and URL-added images keep their own order; uploads come first on save.
              </p>
            )}
          </CollapsibleSection>

          {/* Specifications */}
          <CollapsibleSection title="Specifications" summary={specs.filter(s => s.label.trim() && s.value.trim()).length > 0 ? `${specs.filter(s => s.label.trim() && s.value.trim()).length} row${specs.filter(s => s.label.trim() && s.value.trim()).length === 1 ? '' : 's'}` : 'optional'}>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Optional. Add custom spec rows shown on the product page (e.g. Layout → 65%, Weight → 1.2kg).
              <span style={{ display: 'block', marginTop: 4, color: 'var(--ink-faint)' }}>Tip: press Enter to jump from Label → Value, and again on Value to add the next row.</span>
            </p>
            <SpecsEditor value={specs} onChange={setSpecs} />
          </CollapsibleSection>

          {/* Add Options */}
          <CollapsibleSection title="Add Options" summary={optionGroups.length > 0 ? `${optionGroups.length} group${optionGroups.length === 1 ? '' : 's'}` : 'optional'}>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Each option's price is <strong>added on top of the base price</strong> above (e.g. base ₱5,000 + Novelties +₱2,300 = ₱7,300).
              Leave this section empty if the product has a single price.
            </p>
            <OptionGroupsField value={optionGroups} onChange={setOptionGroups} />
          </CollapsibleSection>

          {/* Variants */}
          <CollapsibleSection title="Variants" summary={variantDimensions.length > 0 ? `${variantDimensions.length} dim · ${variantRows.length} SKU${variantRows.length === 1 ? '' : 's'}` : 'optional'}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
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
              <button type="button" onClick={() => setShowJsonFormat(s => !s)}
                style={{ fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {showJsonFormat ? 'Hide JSON format' : 'Copy JSON Format'}
              </button>
            </div>

            {/* JSON Format reference — instructions + placeholders for AI to fill in */}
            {showJsonFormat && (
              <div style={{ marginBottom: '14px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', margin: 0 }}>JSON Format — AI instructions embedded</p>
                  <button type="button" onClick={copyJsonFormat}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy to clipboard
                  </button>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginBottom: 8, lineHeight: 1.55 }}>
                  How to use: copy this, paste it into your AI chat, then describe the product. Every top-level field is optional — name, base price, category, specs, options, variant matrix. Anything you skip stays editable in the form. Description is excluded by design; write it by hand. The embedded <code style={{ background: 'var(--surface)', padding: '0 4px', borderRadius: 3 }}>_instructions_for_ai</code> field tells the AI exactly how to fill each field. Paste the AI's reply into <em>Import JSON</em> above. Works with both Matrix and List variant modes (current mode: <strong>{variantMode}</strong>).
                </p>
                <pre style={{ fontSize: '0.72rem', fontFamily: 'monospace', background: 'var(--surface)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', overflow: 'auto', maxHeight: 280, margin: 0, lineHeight: 1.5 }}>
                  {sampleVariantJson}
                </pre>
              </div>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              {variantMode === 'matrix'
                ? <>Every combination of dimensions auto-generates as a row. Use bulk-fill when most rows share the same value, then override exceptions.</>
                : <>List only the SKUs you actually stock. Add a row, pick its dimension values, set stock + price. Combinations not listed simply don't exist for the customer. Best when most combinations don't apply.</>
              }
              {' '}Prices are <strong>added on top of the base price</strong>.
              {' '}Stock: <strong>blank = 0 (OOS)</strong>; type <strong>-1</strong> for unlimited.
            </p>

            {showJsonImport && (
              <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', margin: '0 0 6px' }}>
                  Paste JSON with any combination of: top-level fields (<code>name</code>, <code>price</code>, <code>category</code>, <code>specifications</code>), <code>options</code>, <code>dimensions + variants</code>. Anything omitted stays as-is in the form. See <em>Copy JSON Format</em> for the schema.
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
              <EditableDimensionRow key={di}
                dim={d}
                onRename={name => updateDimensionName(di, name)}
                onUpdateValue={(vi, val) => updateDimensionValue(di, vi, val)}
                onRemoveValue={vi => removeDimensionValue(di, vi)}
                onAddValue={val => addDimensionValue(di, val)}
                onRemove={() => removeDimension(di)}
              />
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
                  <input type="number" placeholder="± ₱" className="form-input"
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {variantRows.map((row, idx) => (
                  <VariantRowCard key={idx}
                    row={row} idx={idx} mode={variantMode} dimensions={variantDimensions}
                    onUpdateAttr={updateListVariantAttr}
                    onUpdateField={updateVariantField}
                    onRemove={removeListVariant} />
                ))}
              </div>
            )}

            {variantMode === 'list' && variantDimensions.length > 0 && (
              <button type="button" onClick={addListVariant}
                style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '5px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                + Add Variant
              </button>
            )}

            {/* ── Variant-tagged Images ──────────────────────────────────
                Faster alternative to setting an image per SKU row: attach an
                image to a *combination* of dimension values. Leaving a
                dimension as "Any" wildcards it. The customer page picks the
                most-specific match for the active selection. */}
            {variantDimensions.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '4px' }}>
                  Variant Images <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-faint)' }}>(optional)</span>
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginBottom: '8px' }}>
                  Attach images to dimension combinations. Set <strong>"Any"</strong> for a dimension that should match all values. Most-specific match wins on the product page — easier than setting an image per SKU.
                </p>
                {variantImages.map((img, ii) => (
                  <div key={ii} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {img.url
                      ? <img src={img.url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0, border: '1px solid var(--border)' }} />
                      : <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '1rem' }}>🖼</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: '6px' }}>
                        <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0 }} placeholder="Image URL or upload →" value={img.url}
                          onChange={e => setVariantImages(p => p.map((vv, i) => i !== ii ? vv : { ...vv, url: e.target.value }))} />
                        <label style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: uploadingVImage ? 'wait' : 'pointer', fontSize: '0.72rem', whiteSpace: 'nowrap' }} title="Upload image">
                          {uploadingVImage ? '…' : '↑'}
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0]; e.target.value = '';
                              if (!file) return;
                              setUploadingVImage(true);
                              try {
                                const url = await uploadOptionImage(file);
                                setVariantImages(p => p.map((vv, i) => i !== ii ? vv : { ...vv, url }));
                              } catch { toast.error('Upload failed'); }
                              finally { setUploadingVImage(false); }
                            }} />
                        </label>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {variantDimensions.map(d => (
                          <label key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem' }}>
                            <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>{d.name}:</span>
                            <select className="form-input" style={{ ...inputSm, width: 'auto', paddingRight: '20px' }}
                              value={img.appliesTo?.[d.name] || ''}
                              onChange={e => setVariantImages(p => p.map((vv, i) => {
                                if (i !== ii) return vv;
                                const at = { ...(vv.appliesTo || {}) };
                                if (e.target.value) at[d.name] = e.target.value; else delete at[d.name];
                                return { ...vv, appliesTo: at };
                              }))}>
                              <option value="">Any</option>
                              {getDimValues(d).map(({ value }) => <option key={value} value={value}>{value}</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={() => setVariantImages(p => p.filter((_, i) => i !== ii))}
                      style={{ fontSize: '0.78rem', color: '#c0392b', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => setVariantImages(p => [...p, { url: '', appliesTo: {} }])}
                    style={{ fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    + Add Image (URL)
                  </button>
                  <label style={{ fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: uploadingVImage ? 'wait' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    ↑ Upload Image
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; e.target.value = '';
                        if (!file) return;
                        setUploadingVImage(true);
                        try {
                          const url = await uploadOptionImage(file);
                          setVariantImages(p => [...p, { url, appliesTo: {} }]);
                        } catch { toast.error('Upload failed'); }
                        finally { setUploadingVImage(false); }
                      }} />
                  </label>
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Product Page Sections — block-based marketing content rendered
              under the buy section. Collapsed by default so the form stays
              scannable for the common case (product without a custom page). */}
          <CollapsibleSection
            title="Product Page Sections"
            summary={landingPage.length > 0 ? `${landingPage.length} section${landingPage.length === 1 ? '' : 's'}` : 'optional'}>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Optional. Build a marketing page rendered <strong>below the buy section</strong> on the customer product page.
              Add a Hero image, Banner text, Text+Image split, Gallery, or Feature grid.
            </p>
            <LandingPageEditor value={landingPage} onChange={setLandingPage} />
          </CollapsibleSection>

          {/* Custom HTML — escape hatch for flagship pages where the block
              editor can't produce the right look. Overrides Product Page
              Sections when set. */}
          <CollapsibleSection
            title="Custom HTML"
            summary={customPageHtml.trim() ? `${customPageHtml.length.toLocaleString()} chars` : 'optional'}>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '8px' }}>
              Paste raw HTML + CSS. Rendered <strong>below the buy section</strong>, replacing Product Page Sections when set.
            </p>
            <CustomHtmlEditor value={customPageHtml} onChange={setCustomPageHtml} />
          </CollapsibleSection>

          {/* Cross-sell — addons + "you might also like". Leaving either empty
              tells the customer page to auto-pick (children + same-category). */}
          <CollapsibleSection
            title="Add-ons"
            summary={pinnedAddOnIds.length > 0 ? `${pinnedAddOnIds.length} pinned` : 'auto'}>
            <PinnedProductsPicker
              value={pinnedAddOnIds}
              onChange={setPinnedAddOnIds}
              helpText="Items shown in the Add-ons section below the buy section. Leave empty to auto-show products tagged with this product as their parent." />
          </CollapsibleSection>

          <CollapsibleSection
            title="You might also like"
            summary={pinnedRelatedIds.length > 0 ? `${pinnedRelatedIds.length} pinned` : 'auto'}>
            <PinnedProductsPicker
              value={pinnedRelatedIds}
              onChange={setPinnedRelatedIds}
              helpText="Items shown in the 'You might also like' section at the bottom of the page. Leave empty to auto-pick from the same category." />
          </CollapsibleSection>

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

  // Inline tokenizer — scans left-to-right and emits text + the first matching
  // pattern, then recurses on the rest. Image syntax MUST be matched before
  // link syntax since both end with `](...)`.
  const inlineRe = /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(\*\*(.+?)\*\*)|(\*(.+?)\*)/;
  const parseInline = (text) => {
    const out = [];
    let rest = text;
    let i = 0;
    while (rest.length > 0) {
      const m = rest.match(inlineRe);
      if (!m) { out.push(rest); break; }
      if (m.index > 0) out.push(rest.slice(0, m.index));
      if (m[1]) {
        // Inline image — kept small and inline-block so it can sit next to text.
        // Standalone-image lines are handled at the block level below as a wider image.
        out.push(<img key={`inl-img-${i++}`} src={m[3]} alt={m[2]} style={{ maxWidth: '100%', maxHeight: 280, verticalAlign: 'middle', borderRadius: 'var(--radius-sm)' }} />);
      } else if (m[4]) {
        out.push(<a key={`a-${i++}`} href={m[6]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{parseInline(m[5])}</a>);
      } else if (m[7]) {
        out.push(<strong key={`b-${i++}`}>{parseInline(m[8])}</strong>);
      } else if (m[9]) {
        out.push(<em key={`i-${i++}`}>{parseInline(m[10])}</em>);
      }
      rest = rest.slice(m.index + m[0].length);
    }
    return out;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushBullets();
      elements.push(<div key={key++} style={{ height: '0.75em' }} />);
      continue;
    }

    // Standalone image line — render full-width as a block so it acts like an
    // illustration paragraph instead of a tiny inline glyph.
    const standaloneImg = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (standaloneImg) {
      flushBullets();
      elements.push(
        <img key={key++} src={standaloneImg[2]} alt={standaloneImg[1]}
          style={{ maxWidth: '100%', display: 'block', borderRadius: 'var(--radius-sm)', margin: '14px 0' }} />
      );
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
