import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import GroupBuyCard from '../components/GroupBuyCard';
import AddToOrderContext from '../context/AddToOrderContext';
import { BlockRenderer } from './Home';
import toast from 'react-hot-toast';

export default function GroupBuys() {
  const [gbs, setGbs] = useState([]);
  const [loading, setLoading] = useState(true);
  // Admin-built blocks + active in-stock catalog feed for collection blocks
  // that reference products. Mirrors what Home/Shop pages already load.
  const [pageContent, setPageContent] = useState(null);
  const [products, setProducts] = useState([]);
  const { info: addToOrderInfo } = useContext(AddToOrderContext);
  const navigate = useNavigate();

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

  return (
    <div className="page-body">
      {enabledBlocks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {enabledBlocks.map((block, i) => (
            <BlockRenderer
              key={block._id || i}
              block={block}
              isFirst={i === 0}
              products={products}
              groupBuys={gbs}
              loading={loading}
              countByCategory={(slug) => products.filter(p => p.category?.toLowerCase().replace(/\s+/g, '-') === slug).length}
            />
          ))}
        </div>
      )}

      <div style={{ padding: '56px var(--page-pad) 80px' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.8rem', letterSpacing: '-0.025em', marginBottom: '8px' }}>Group Buys</h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.95rem', maxWidth: 520 }}>
            Join a group buy to get exclusive keyboards at production pricing. Orders are collected, then manufactured together.
          </p>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : gbs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '1rem', marginBottom: '8px' }}>No group buys right now.</p>
            <p style={{ fontSize: '0.84rem' }}>Check back soon or browse our in-stock products.</p>
            <Link to="/products" className="btn-dark" style={{ marginTop: '20px', display: 'inline-flex' }}><span>Shop In Stock</span></Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: gridAlign === 'center'
              ? 'repeat(auto-fit, 340px)'
              : 'repeat(auto-fill, minmax(340px, 1fr))',
            justifyContent: gridJustify,
            gap: '24px',
          }}>
            {gbs.map(gb => <GroupBuyCard key={gb._id} gb={gb} />)}
          </div>
        )}
      </div>
    </div>
  );
}