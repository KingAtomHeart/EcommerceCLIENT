import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import GroupBuyCard from '../components/GroupBuyCard';
import AddToOrderContext from '../context/AddToOrderContext';
import { BlockRenderer } from './Home';
import toast from 'react-hot-toast';

const PAGE_SIZE = 12;

// Status filter facet — the group-buy analog of Shop's category pills. Order is
// canonical; only statuses actually present in the feed render as pills.
const STATUS_ORDER = ['interest-check', 'open', 'closing-soon', 'production', 'completed', 'closed'];
const STATUS_LABEL = {
  'interest-check': 'Interest Check',
  'open': 'Open',
  'closing-soon': 'Closing Soon',
  'production': 'In Production',
  'completed': 'Completed',
  'closed': 'Closed',
};

export default function GroupBuys() {
  const [gbs, setGbs] = useState([]);
  const [loading, setLoading] = useState(true);
  // Admin-built blocks + active in-stock catalog feed for collection blocks
  // that reference products. Mirrors what Home/Shop pages already load.
  const [pageContent, setPageContent] = useState(null);
  const [products, setProducts] = useState([]);
  const { info: addToOrderInfo } = useContext(AddToOrderContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Catalog controls — mirror Shop (Products.js) so the two pages look and work
  // identically: search box, sort dropdown, filter pills, and load-more paging.
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [status, setStatus] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, sort, status]);

  // /group-buys#group-buys scrolls past admin-built blocks and lands on the
  // catalog. Mirrors the same hash convention used by Products.js.
  useEffect(() => {
    if (!location.hash || loading) return;
    const id = location.hash.replace(/^#/, '');
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, [location.key, location.hash, loading]);

  // Lock customers with an active gb-cart add-link to their original group buy.
  useEffect(() => {
    if (addToOrderInfo?.type === 'gb-cart' && addToOrderInfo.rootGroupBuyId) {
      toast.error('This add-link is locked to your original group buy.');
      navigate(`/group-buys/${addToOrderInfo.rootGroupBuyId}`, { replace: true });
    }
  }, [addToOrderInfo, navigate]);

  useEffect(() => {
    apiFetch('/group-buys/active')
      .then(data => setGbs(Array.isArray(data) ? data : []))
      .catch(() => setGbs([]))
      .finally(() => setLoading(false));
    apiFetch('/page-content/group-buys').then(setPageContent).catch(() => setPageContent(null));
    apiFetch('/products/active').then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([]));
  }, []);

  const enabledBlocks = (pageContent?.blocks || []).filter(b => b.enabled !== false);
  const gridAlign = pageContent?.gridAlign || 'left';
  const gridJustify = gridAlign === 'center' ? 'center' : 'start';

  // Filter + sort the live feed (mirrors Products.js logic).
  const tsOf = (g) => {
    const d = g.createdAt ? new Date(g.createdAt).getTime() : NaN;
    if (!isNaN(d)) return d;
    const id = g._id || '';
    if (typeof id === 'string' && id.length >= 8) {
      const secs = parseInt(id.slice(0, 8), 16);
      if (!isNaN(secs)) return secs * 1000;
    }
    return 0;
  };

  let filtered = gbs;
  if (status !== 'all') filtered = filtered.filter(g => g.status === status);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(g => g.name?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
  }
  if (sort === 'price-asc') filtered = [...filtered].sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
  else if (sort === 'price-desc') filtered = [...filtered].sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
  else if (sort === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'newest') filtered = [...filtered].sort((a, b) => tsOf(b) - tsOf(a));
  else if (sort === 'oldest') filtered = [...filtered].sort((a, b) => tsOf(a) - tsOf(b));

  const visible = filtered.slice(0, visibleCount);

  // Status pills present in the feed, in canonical order, prefixed with "All".
  const presentStatuses = new Set(gbs.map(g => g.status).filter(Boolean));
  const statuses = ['all', ...STATUS_ORDER.filter(s => presentStatuses.has(s))];

  // Live catalog grid extracted so it can render at the admin-chosen position
  // among the section blocks. When the block list has no `catalog` entry we
  // append it at the end (legacy behavior — preserves layouts that predate
  // the moveable catalog feature).
  const catalogNode = (
    <>
      <div id="group-buys" className="shop-header" style={{ scrollMarginTop: 'var(--nav-h, 64px)', padding: '56px var(--page-pad) 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div className="shop-header-title">
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(1.7rem, 5.5vw, 2.8rem)', letterSpacing: '-0.025em', marginBottom: '8px' }}>Group Buys</h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.95rem' }}>Exclusive keyboards at production pricing.</p>
        </div>
        <div className="shop-header-tools" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="shop-search-wrap" style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)', pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
            <input type="text" placeholder="Search group buys..." value={search} onChange={e => setSearch(e.target.value)} className="form-input shop-search-input" style={{ paddingLeft: 38, borderRadius: 'var(--radius-pill)', width: 210 }} />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} className="form-input" style={{ borderRadius: 'var(--radius-pill)', width: 'auto', paddingRight: 34, cursor: 'pointer' }}>
            <option value="default">Sort: Default</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </div>
      </div>

      {statuses.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '24px var(--page-pad) 0' }}>
          {statuses.map(s => (
            <button key={s} className={`pill ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : STATUS_LABEL[s] || s}
            </button>
          ))}
        </div>
      )}

      <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', padding: '16px var(--page-pad) 0' }}>
        {filtered.length} group buy{filtered.length !== 1 ? 's' : ''}
      </p>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : gbs.length === 0 ? (
        <div style={{ margin: '24px var(--page-pad) 0', textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '1rem', marginBottom: '8px' }}>No group buys right now.</p>
          <p style={{ fontSize: '0.84rem' }}>Check back soon or browse our in-stock products.</p>
          <Link to="/products" className="btn-dark" style={{ marginTop: '20px', display: 'inline-flex' }}><span>Shop In Stock</span></Link>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            // Identical to Shop: when centered, switch to auto-fit + fixed sizing so
            // the row collapses to just the cards present and justifyContent centers.
            gridTemplateColumns: gridAlign === 'center'
              ? 'repeat(auto-fit, 300px)'
              : 'repeat(auto-fill, minmax(300px, 1fr))',
            justifyContent: gridJustify,
            gap: '28px',
            padding: '24px var(--page-pad) 0',
          }}>
            {visible.map(gb => <GroupBuyCard key={gb._id} gb={gb} />)}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)' }}>
                <p>No group buys match your search.</p>
              </div>
            )}
          </div>
          {visibleCount < filtered.length && (
            <div style={{ textAlign: 'center', padding: '40px var(--page-pad) 80px' }}>
              <button className="btn-dark" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                <span>Load more ({filtered.length - visibleCount} remaining)</span>
              </button>
            </div>
          )}
          {visibleCount >= filtered.length && filtered.length > 0 && (
            <p style={{ textAlign: 'center', padding: '40px var(--page-pad) 80px', color: 'var(--ink-faint)', fontSize: '0.85rem' }}>
              All {filtered.length} group buys shown
            </p>
          )}
        </>
      )}
    </>
  );

  const hasCatalogBlock = enabledBlocks.some(b => b.type === 'catalog');

  return (
    <div className="page-body">
      {enabledBlocks.map((block, i) => {
        if (block.type === 'catalog') {
          return <div key={block._id || `catalog-${i}`}>{catalogNode}</div>;
        }
        return (
          <BlockRenderer
            key={block._id || i}
            block={block}
            isFirst={i === 0}
            products={products}
            groupBuys={gbs}
            loading={loading}
            countByCategory={(slug) => products.filter(p => p.category?.toLowerCase().replace(/\s+/g, '-') === slug).length}
          />
        );
      })}
      {/* Legacy / default position: end of page when no catalog block exists.
          Prevents pages from going blank if admin hasn't placed one yet. */}
      {!hasCatalogBlock && catalogNode}
    </div>
  );
}
