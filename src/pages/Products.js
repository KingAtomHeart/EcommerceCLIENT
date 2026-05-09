import { useState, useEffect, useContext, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import AddToOrderContext from '../context/AddToOrderContext';
import ProductCard, { computeStockSummary } from '../components/ProductCard';
import AdminView from '../components/AdminView';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 12;

export default function Products() {
  const { user, loading: userLoading } = useContext(UserContext);
  const { info: addToOrderInfo } = useContext(AddToOrderContext);
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Customers locked to a GB add-link can't browse in-stock — bounce back to their GB.
  useEffect(() => {
    if (!user?.isAdmin && addToOrderInfo?.type === 'gb-cart' && addToOrderInfo.rootGroupBuyId) {
      toast.error('This add-link is locked to your group buy.');
      navigate(`/group-buys/${addToOrderInfo.rootGroupBuyId}`, { replace: true });
    }
  }, [user, addToOrderInfo, navigate]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const [searchParams] = useSearchParams();
  const [category, setCategory] = useState(searchParams.get('cat') || 'all');
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sync category when URL search params change
  useEffect(() => {
    const cat = searchParams.get('cat');
    if (cat) setCategory(cat);
    else setCategory('all');
    setVisibleCount(PAGE_SIZE);
  }, [searchParams]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, sort, category, hideOutOfStock]);

  // FIX: Stabilize fetchProducts with useCallback so the dep array is correct
  const isAdmin = user?.isAdmin;
  const fetchProducts = useCallback(() => {
    setLoading(true);
    const endpoint = isAdmin ? '/products/all?includeAddOns=true' : '/products/active';
    apiFetch(endpoint)
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  // Wait for user context to finish loading before fetching
  useEffect(() => {
    if (userLoading) return;
    fetchProducts();
  }, [userLoading, fetchProducts]);

  // Show loading while user context is still verifying token
  if (userLoading) {
    return <div className="page-body loading-center"><div className="spinner" /></div>;
  }

  if (user?.isAdmin) {
    return (
      <div className="page-body" style={{ padding: '56px var(--page-pad) 80px' }}>
        <AdminView products={products} fetchData={fetchProducts} loading={loading} />
      </div>
    );
  }

  // Filter and sort
  let filtered = products;
  if (hideOutOfStock) {
    filtered = filtered.filter(p => !computeStockSummary(p).outOfStock);
  }
  if (category !== 'all') {
    filtered = filtered.filter(p => p.category?.toLowerCase().replace(/\s+/g, '-') === category);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }
  const tsOf = (p) => {
    const d = p.createdAt ? new Date(p.createdAt).getTime() : NaN;
    if (!isNaN(d)) return d;
    // Fallback to Mongo ObjectId timestamp (first 4 bytes = seconds since epoch).
    const id = p._id || '';
    if (typeof id === 'string' && id.length >= 8) {
      const secs = parseInt(id.slice(0, 8), 16);
      if (!isNaN(secs)) return secs * 1000;
    }
    return 0;
  };
  if (sort === 'price-asc') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (sort === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'newest') filtered = [...filtered].sort((a, b) => tsOf(b) - tsOf(a));
  else if (sort === 'oldest') filtered = [...filtered].sort((a, b) => tsOf(a) - tsOf(b));

  const visible = filtered.slice(0, visibleCount);

  const categories = ['all', ...new Set(products.map(p => p.category?.toLowerCase().replace(/\s+/g, '-')).filter(Boolean))];

  return (
    <div className="page-body">
      <div style={{ padding: '56px var(--page-pad) 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.8rem', letterSpacing: '-0.025em', marginBottom: '8px' }}>Shop</h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.95rem' }}>Keyboards, keycaps, and accessories.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)', pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
            <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="form-input" style={{ paddingLeft: 38, borderRadius: 'var(--radius-pill)', width: 210 }} />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} className="form-input" style={{ borderRadius: 'var(--radius-pill)', width: 'auto', paddingRight: 34, cursor: 'pointer' }}>
            <option value="default">Sort: Default</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="name">Name: A–Z</option>
          </select>
          <button
            onClick={() => setHideOutOfStock(h => !h)}
            className="pill"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: hideOutOfStock ? 'var(--accent)' : undefined,
              color: hideOutOfStock ? '#fff' : undefined,
              borderColor: hideOutOfStock ? 'var(--accent)' : undefined,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {hideOutOfStock ? (
                <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
              ) : (
                <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
              )}
            </svg>
            {hideOutOfStock ? 'Showing in stock' : 'Hide out of stock'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '24px var(--page-pad) 0' }}>
        {categories.map(cat => (
          <button key={cat} className={`pill ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
            {cat === 'all' ? 'All' : cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', padding: '16px var(--page-pad) 0' }}>
        {filtered.length} product{filtered.length !== 1 ? 's' : ''}
        {hideOutOfStock && products.some(p => computeStockSummary(p).outOfStock) && (
          <span style={{ color: 'var(--ink-faint)' }}> (out-of-stock items hidden)</span>
        )}
      </p>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '28px', padding: '24px var(--page-pad) 0' }}>
            {visible.map(p => <ProductCard key={p._id} product={p} />)}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)' }}>
                <p>No products match your search.</p>
              </div>
            )}
          </div>
          {visibleCount < filtered.length && (
            <div style={{ textAlign: 'center', padding: '40px var(--page-pad) 80px' }}>
              <button className="btn-dark" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
          {visibleCount >= filtered.length && filtered.length > 0 && (
            <p style={{ textAlign: 'center', padding: '40px var(--page-pad) 80px', color: 'var(--ink-faint)', fontSize: '0.85rem' }}>
              All {filtered.length} products shown
            </p>
          )}
        </>
      )}
    </div>
  );
}