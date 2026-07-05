import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BlockRenderer } from './Home';
import ProductCard from '../components/ProductCard';
import GroupBuyCard from '../components/GroupBuyCard';
import { apiFetch } from '../utils/api';

/* CustomPage — renders an admin-built page at /p/:slug.

   Reuses the exact same block system as the Home / Shop / Group Buys pages
   (SectionPageContent.blocks + the shared BlockRenderer). A 'catalog' block
   drops in the live product + group-buy grid, so a custom page can mix curated
   sections with a full catalog just like Shop does. The catalog only renders
   where an admin places a Catalog Grid block — nothing is auto-appended. */

export default function CustomPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [products, setProducts] = useState([]);
  const [groupBuys, setGroupBuys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const [pg, prods, gbs] = await Promise.all([
          apiFetch(`/page-content/${slug}`).catch(() => null),
          apiFetch('/products/active').then(r => Array.isArray(r) ? r : []).catch(() => []),
          apiFetch('/group-buys/active').then(r => Array.isArray(r) ? r : []).catch(() => []),
        ]);
        if (cancelled) return;
        if (!pg) { setNotFound(true); setLoading(false); return; }
        setPage(pg);
        setProducts(prods);
        setGroupBuys(gbs);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const countByCategory = (catSlug) =>
    products.filter(p => p.category?.toLowerCase().replace(/\s+/g, '-') === catSlug).length;

  if (loading) {
    return (
      <div className="page-body" style={{ padding: '64px var(--page-pad)' }}>
        <p style={{ color: 'var(--ink-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="page-body" style={{ padding: '64px var(--page-pad)' }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', marginBottom: 12 }}>Page not found</h1>
        <p style={{ color: 'var(--ink-muted)', marginBottom: 24 }}>
          The page <strong>{slug}</strong> doesn't exist or isn't published.
        </p>
        <Link to="/" className="btn-outline" style={{ padding: '10px 22px' }}>← Back home</Link>
      </div>
    );
  }

  const blocks = (page.blocks || []).filter(b => b.enabled !== false);

  // The catalog grid (mixed products + group buys) — rendered wherever a
  // 'catalog' block sits, honouring the page's gridAlign knob.
  const catalogNode = (
    <section style={{ padding: '40px var(--page-pad) 80px' }}>
      <div style={{
        display: 'grid',
        // Matches the Shop / Group Buys catalog grids for app-wide uniformity.
        gridTemplateColumns: page.gridAlign === 'center'
          ? 'repeat(auto-fit, 300px)'
          : 'repeat(auto-fill, minmax(300px, 1fr))',
        justifyContent: page.gridAlign === 'center' ? 'center' : 'start',
        gap: 28,
      }}>
        {products.filter(p => !p.parentProductId).map(p => <ProductCard key={`p-${p._id}`} product={p} />)}
        {groupBuys.filter(g => !g.parentGroupBuyId).map(g => <GroupBuyCard key={`g-${g._id}`} gb={g} />)}
      </div>
    </section>
  );

  return (
    <div className="page-body">
      {blocks.map((block, i) => {
        if (block.type === 'catalog') {
          return <div key={block._id || `catalog-${i}`}>{catalogNode}</div>;
        }
        return (
          <BlockRenderer
            key={block._id || i}
            block={block}
            isFirst={i === 0}
            products={products}
            groupBuys={groupBuys}
            loading={loading}
            countByCategory={countByCategory}
          />
        );
      })}
      {blocks.length === 0 && (
        <div style={{ padding: '80px var(--page-pad)', textAlign: 'center', color: 'var(--ink-muted)' }}>
          This page has no sections yet.
        </div>
      )}
    </div>
  );
}
