import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import GroupBuyCard from '../components/GroupBuyCard';
import { LandingPageRenderer } from '../components/LandingPage';
import { renderCustomPageTokens } from '../utils/customPage';
import { apiFetch } from '../utils/api';
import { categorySlug } from '../utils/categories';

/* CategoryPage — per-category landing surface at /category/:slug.

   Header: hero image + name + description from the Category record (if one
   exists). Falls back to a clean text-only header when only the slug is in
   use (no record yet).

   Grid: pinned products + group buys first (in the admin's chosen order),
   then the auto-derived rest (products + GBs that carry this category
   slug). Pinned items are excluded from the auto list so they aren't
   double-counted.

   Mixed product + GB rendering is consistent with ProductView's add-on /
   related sections — each card is rendered with its matching component. */

export default function CategoryPage() {
  const { slug: rawSlug } = useParams();
  const slug = categorySlug(rawSlug);
  const [category, setCategory] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [allGroupBuys, setAllGroupBuys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const [cat, products, gbs] = await Promise.all([
          apiFetch(`/categories/${slug}`).catch(() => null),
          apiFetch('/products/active').then(r => Array.isArray(r) ? r : []).catch(() => []),
          apiFetch('/group-buys/active').then(r => Array.isArray(r) ? r : []).catch(() => []),
        ]);
        if (cancelled) return;
        if (!cat) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setCategory(cat);
        setAllProducts(products);
        setAllGroupBuys(gbs);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Pinned cards (in the order the admin set) come first. Auto-derived
  // (everything else matching the slug) fills in after, with pinned items
  // filtered out to avoid duplicates.
  const cards = useMemo(() => {
    if (!category) return [];
    const pinnedProductIds = (category.pinnedProductIds || []).map(p => p?._id ?? p);
    const pinnedGbIds = (category.pinnedGroupBuyIds || []).map(g => g?._id ?? g);
    const pinnedSet = new Set([...pinnedProductIds, ...pinnedGbIds].map(String));

    // Pinned arrays come populated from the backend, so each entry is the
    // full document. Fall back to looking up the active feed when an admin
    // pinned an id that hasn't loaded yet (rare race).
    const pinnedCards = [
      ...(category.pinnedProductIds || []).map(p => {
        const item = p && p.name ? p : allProducts.find(x => String(x._id) === String(p?._id ?? p));
        return item ? { kind: 'product', item } : null;
      }),
      ...(category.pinnedGroupBuyIds || []).map(g => {
        const item = g && g.name ? g : allGroupBuys.find(x => String(x._id) === String(g?._id ?? g));
        return item ? { kind: 'gb', item } : null;
      }),
    ].filter(Boolean);

    // Auto fill: any active product or GB carrying this category slug that
    // isn't pinned already. Strings get normalised the same way the backend
    // does so "Desk Accessories" still matches "desk-accessories".
    const matchesSlug = (s) => categorySlug(s) === slug;
    const autoProducts = allProducts
      .filter(p => matchesSlug(p.category) && !pinnedSet.has(String(p._id)) && !p.parentProductId)
      .map(item => ({ kind: 'product', item }));
    const autoGbs = allGroupBuys
      .filter(g => matchesSlug(g.category) && !pinnedSet.has(String(g._id)) && !g.parentGroupBuyId)
      .map(item => ({ kind: 'gb', item }));

    return [...pinnedCards, ...autoProducts, ...autoGbs];
  }, [category, allProducts, allGroupBuys, slug]);

  if (loading) {
    return (
      <div className="page-body" style={{ padding: '64px var(--page-pad)' }}>
        <p style={{ color: 'var(--ink-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (notFound || !category) {
    return (
      <div className="page-body" style={{ padding: '64px var(--page-pad)' }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', marginBottom: 12 }}>Category not found</h1>
        <p style={{ color: 'var(--ink-muted)', marginBottom: 24 }}>
          The category <strong>{slug}</strong> doesn't exist yet, or no products use it.
        </p>
        <Link to="/products" className="btn-outline" style={{ padding: '10px 22px' }}>← Back to shop</Link>
      </div>
    );
  }

  return (
    <div className="page-body">
      {/* ── Hero ── */}
      <section style={{
        position: 'relative',
        background: category.image?.url ? '#1a1612' : 'var(--bg-secondary)',
        color: category.image?.url ? '#fff' : 'var(--ink)',
        minHeight: 320,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        overflow: 'hidden',
        padding: '40px var(--page-pad)',
      }}>
        {category.image?.url && (
          <>
            <img
              src={category.image.url}
              alt={category.image.altText || category.name}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center',
                opacity: 0.75,
              }} />
            {/* Soft bottom-up scrim so the title stays legible regardless of image content. */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)',
              pointerEvents: 'none',
            }} />
          </>
        )}
        <div style={{ position: 'relative', maxWidth: 720 }}>
          <p style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: category.image?.url ? 'rgba(255,255,255,0.78)' : 'var(--ink-muted)', marginBottom: 10, fontWeight: 600 }}>
            Category
          </p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(2rem, 5vw, 3.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
            {category.name}
          </h1>
          {category.description && (
            <p style={{ marginTop: 18, fontSize: '1rem', lineHeight: 1.65, color: category.image?.url ? 'rgba(255,255,255,0.82)' : 'var(--ink-muted)', maxWidth: 600 }}>
              {category.description}
            </p>
          )}
        </div>
      </section>

      {/* ── Admin-curated page sections (Hero / Banner / Text+Image / Gallery
            / Feature grid). Rendered between the category hero and the
            product grid so admins can tell a story before the catalog. ── */}
      {Array.isArray(category.landingPage) && category.landingPage.length > 0 && (
        <section style={{ padding: '40px var(--page-pad) 0' }}>
          <LandingPageRenderer blocks={category.landingPage} />
        </section>
      )}

      {/* ── Grid ── */}
      <section style={{ padding: '56px var(--page-pad) 80px' }}>
        {cards.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>
            No products or group buys in this category yet.
          </p>
        ) : (
          <>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 20, fontWeight: 600 }}>
              {cards.length} item{cards.length === 1 ? '' : 's'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
              {cards.map(({ kind, item }) => kind === 'gb'
                ? <GroupBuyCard key={`gb-${item._id}`} gb={item} />
                : <ProductCard key={`p-${item._id}`} product={item} />
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Optional raw HTML escape hatch — anchored at the bottom for
            campaign/promo callouts. {{tokens}} are substituted with the
            category record (name, slug, description, image url). ── */}
      {(category.customPageHtml || '').trim() && (
        <section
          style={{ padding: '0 var(--page-pad) 80px' }}
          dangerouslySetInnerHTML={{ __html: renderCustomPageTokens(category.customPageHtml, {
            name: category.name,
            slug: category.slug,
            description: category.description,
            image: category.image,
          }) }} />
      )}
    </div>
  );
}
