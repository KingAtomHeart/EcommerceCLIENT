import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import GroupBuyCard from '../components/GroupBuyCard';
import { apiFetch } from '../utils/api';

// Paste your first hero Cloudinary URL here so it shows immediately on load
const HERO_FALLBACK_IMAGE = '';

const CATEGORIES = [
  { slug: 'keyboards', label: 'Keyboards' },
  { slug: 'keycaps', label: 'Keycaps' },
  { slug: 'switches', label: 'Switches' },
  { slug: 'desk-accessories', label: 'Desk Accessories' },
  { slug: 'tools-accessories', label: 'Tools & Accessories' },
];

/* Split text on *asterisks* and wrap odd segments in <em>. `emStyle` is an
   optional inline style applied to each <em>; the banner uses it to tint
   italics in the accent color without relying on legacy CSS classes. */
function parseItalic(text, emStyle) {
  if (!text) return text;
  const parts = text.split('*');
  return parts.map((part, i) =>
    i % 2 === 1 ? <em key={i} style={emStyle}>{part}</em> : part
  );
}

/* Skeleton shimmer card */
function Skeleton({ style }) {
  return (
    <div style={{
      borderRadius: 'var(--radius)',
      background: 'linear-gradient(90deg, var(--border-subtle) 0%, var(--surface) 50%, var(--border-subtle) 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style
    }} />
  );
}

/* Fade + lift in as the block scrolls into view. Universal block polish — once
   visible, the observer disconnects so the animation only plays once per page load.
   `disabled` lets the admin live-preview render content immediately without
   the scroll-triggered fade (which feels broken in an editor context). */
function Reveal({ children, delay = 0, as: As = 'div', style: extra, disabled }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(disabled || false);
  useEffect(() => {
    if (disabled) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [disabled]);
  return (
    <As ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: disabled ? 'none' : `opacity 0.75s ease ${delay}s, transform 0.75s cubic-bezier(0.22, 0.61, 0.36, 1) ${delay}s`,
      ...extra,
    }}>
      {children}
    </As>
  );
}

/* Per-block background tints. Wraps the block so the bg is full-bleed (page
   gutters disappear into the tint), giving the page visual rhythm without
   forcing the admin to add separator blocks.
   `dark` overrides CSS variables on the wrapper so child text using var(--ink)
   automatically inverts — no per-component dark-mode plumbing needed. */
const BLOCK_BG_STYLES = {
  default: { background: 'transparent' },
  tinted:  { background: 'var(--bg-secondary)' },
  surface: { background: 'var(--surface)' },
  accent:  { background: 'var(--accent-light)' },
  dark: {
    background: 'var(--ink)',
    color: '#f0efe9',
    '--ink': '#f5f4f0',
    '--ink-muted': '#a8a89e',
    '--ink-faint': '#6e6c66',
    '--border': '#2e2e2b',
    '--border-subtle': '#252523',
    '--surface': '#252523',
    '--bg-secondary': '#1a1a18',
  },
};
function blockBgStyle(bg) { return BLOCK_BG_STYLES[bg] || BLOCK_BG_STYLES.default; }

/* Shared section header. `centered=true` stacks eyebrow → title → subtitle on
   the centerline and pulls view-all out (renders SectionFooter below content
   instead). `centered=false` keeps the classic title-left / view-all-right row. */
function SectionHeader({ eyebrow, title, subtitle, viewAllLink, centered }) {
  if (centered) {
    return (
      <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
        {eyebrow && (
          <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '14px' }}>
            {eyebrow}
          </p>
        )}
        <h2 className="section-title" style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.6rem)', lineHeight: 1.1 }}>{title}</h2>
        {subtitle && (
          <p style={{ color: 'var(--ink-muted)', fontSize: '1rem', marginTop: '14px', lineHeight: 1.55 }}>{subtitle}</p>
        )}
      </div>
    );
  }
  return (
    <div className="section-header">
      <div>
        {eyebrow && (
          <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '6px' }}>
            {eyebrow}
          </p>
        )}
        <h2 className="section-title">{title}</h2>
        {subtitle && (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginTop: '4px' }}>{subtitle}</p>
        )}
      </div>
      {viewAllLink && (
        <Link to={viewAllLink} className="section-link">View all →</Link>
      )}
    </div>
  );
}

function SectionFooter({ viewAllLink, label = 'View all' }) {
  if (!viewAllLink) return null;
  return (
    <div style={{ textAlign: 'center', marginTop: '40px' }}>
      <Link to={viewAllLink} className="section-link" style={{ fontSize: '0.95rem' }}>
        {label} →
      </Link>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [homepage, setHomepage] = useState(null);
  const [groupBuys, setGroupBuys] = useState([]);

  useEffect(() => {
    apiFetch('/products/active')
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));

    apiFetch('/homepage').then(setHomepage).catch(() => setHomepage(null));

    apiFetch('/group-buys/active')
      .then(data => setGroupBuys(Array.isArray(data) ? data : []))
      .catch(() => setGroupBuys([]));
  }, []);

  const countByCategory = (slug) =>
    products.filter(p => p.category?.toLowerCase().replace(/\s+/g, '-') === slug).length;

  // Render in block order if blocks are present; otherwise nothing (server seeds
  // a default block list on first load, so this is a transient state).
  const blocks = (homepage?.blocks || []).filter(b => b.enabled !== false);

  return (
    <div className="page-body" style={{ marginTop: 0 }}>
      {blocks.map((block, i) => (
        <BlockRenderer
          key={block._id || i}
          block={block}
          isFirst={i === 0}
          products={products}
          groupBuys={groupBuys}
          loading={loading}
          countByCategory={countByCategory}
        />
      ))}
    </div>
  );
}


/* ─── Block dispatcher ─── */
export function BlockRenderer({ block, isFirst, products, groupBuys, loading, countByCategory, adminMode }) {
  const data = block.data || {};

  // Hero owns its own full-bleed background, so no bg wrapper. Still reveal-on-mount.
  if (block.type === 'hero') {
    return (
      <section className="hero" style={{ marginTop: isFirst ? 'var(--nav-h)' : 0 }}>
        <HeroCarousel
          images={(data.images || []).map(i => i.url).filter(Boolean)}
          fallbackImage={HERO_FALLBACK_IMAGE}
          eyebrow={data.eyebrow || ''}
          title={data.title || ''}
          subtitle={data.subtitle || ''}
          primaryCta={{ label: data.primaryCtaLabel || 'Shop Now', link: data.primaryCtaLink || '/products' }}
          secondaryCta={{ label: data.secondaryCtaLabel || '', link: data.secondaryCtaLink || '' }}
        />
      </section>
    );
  }

  let content = null;
  switch (block.type) {
    case 'categoryStrip':
      content = <CategoryStrip countByCategory={countByCategory} />;
      break;
    case 'productGrid':
      content = <ProductGridBlock data={data} products={products} loading={loading} />;
      break;
    case 'productHero':
      content = <ProductHeroBlock data={data} products={products} adminMode={adminMode} />;
      break;
    case 'collection':
      content = <CollectionBlock data={data} products={products} groupBuys={groupBuys} loading={loading} adminMode={adminMode} />;
      break;
    case 'groupBuys':
      content = <GroupBuysBlock data={data} groupBuys={groupBuys} />;
      break;
    case 'banner':
      content = (
        <BannerSection
          {...data}
          layout={data.layout || 'overlay'}
          imgUrl={data.image?.url || ''}
          eyebrow={data.eyebrow || ''}
          title={data.title || ''}
          subtitle={data.subtitle || ''}
          ctaLabel={data.ctaLabel ?? 'Browse Collection'}
          ctaLink={data.ctaLink || '/products'}
        />
      );
      break;
    default:
      return null;
  }

  const bg = blockBgStyle(data.bg);
  const isTinted = (data.bg && data.bg !== 'default');
  return (
    // `display: flow-root` prevents child margin-collapse from leaking the
    // background tint past adjacent blocks. Only enabled when actually tinted.
    <div style={{ ...bg, display: isTinted ? 'flow-root' : undefined }}>
      <Reveal disabled={adminMode}>{content}</Reveal>
    </div>
  );
}


/* ─── Category Strip (extracted unchanged) ─── */
function CategoryStrip({ countByCategory }) {
  return (
    <nav className="cat-strip">
      <div className="cat-strip-inner">
        {CATEGORIES.map((cat, i) => {
          const count = countByCategory(cat.slug);
          return (
            <Link
              key={cat.slug}
              to={`/products?cat=${cat.slug}`}
              className="cat-link animate-fadeUp"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <span className="cat-link-label">{cat.label}</span>
              <span className="cat-link-count">{count}</span>
              <svg className="cat-link-arrow" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          );
        })}
        <Link to="/products" className="cat-link cat-link-all animate-fadeUp" style={{ animationDelay: `${CATEGORIES.length * 0.06}s` }}>
          <span className="cat-link-label">Shop All</span>
          <svg className="cat-link-arrow" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </Link>
      </div>
    </nav>
  );
}


/* ─── Product Grid Block (carousel; same visuals as the old Featured section) ─── */
function ProductGridBlock({ data, products, loading }) {
  const carouselRef = useRef(null);
  const scrollCarousel = (dir) => {
    const track = carouselRef.current;
    if (!track) return;
    const card = track.querySelector('.product-card');
    const w = (card?.offsetWidth ?? 300) + 20;
    track.scrollBy({ left: dir * w, behavior: 'smooth' });
  };
  const handleCarouselKey = (e) => {
    if (e.key === 'ArrowLeft') scrollCarousel(-1);
    if (e.key === 'ArrowRight') scrollCarousel(1);
  };

  // Filter + sort + limit per block config. Two modes:
  //   * Pinned: `productIds` array → render those exact products in that exact
  //     order (skips category/sort/limit). Missing IDs (archived/deleted) are
  //     silently dropped so the storefront doesn't 404.
  //   * Auto: filter by category, sort by featured/newest, cap at `limit`.
  const filtered = useMemo(() => {
    if (Array.isArray(data.productIds) && data.productIds.length > 0) {
      const byId = new Map(products.map(p => [String(p._id), p]));
      return data.productIds.map(id => byId.get(String(id))).filter(Boolean);
    }
    let list = products;
    if (data.category) {
      list = list.filter(p => (p.category || '').toLowerCase().replace(/\s+/g, '-') === data.category);
    }
    if (data.sort === 'newest') {
      const ts = (p) => {
        const d = p.createdAt ? new Date(p.createdAt).getTime() : NaN;
        if (!isNaN(d)) return d;
        const id = p._id || '';
        if (typeof id === 'string' && id.length >= 8) {
          const secs = parseInt(id.slice(0, 8), 16);
          if (!isNaN(secs)) return secs * 1000;
        }
        return 0;
      };
      list = [...list].sort((a, b) => ts(b) - ts(a));
    }
    return list.slice(0, Math.max(1, Number(data.limit) || 6));
  }, [products, data.productIds, data.category, data.sort, data.limit]);

  const centered = data.align === 'center';
  const viewAll = data.viewAllLink || '/products';

  // Presentation knobs — passed down to every ProductCard so admin can dial in
  // sizes, fields-to-show, button style, etc. without touching the card itself.
  const presentation = {
    size: data.cardSize || 'md',
    aspect: data.cardAspect || 'square',
    cardStyle: data.cardStyle || 'default',
    showCategory: data.showCategory !== false,
    showDescription: data.showDescription !== false,
    showPrice: data.showPrice !== false,
    buttonStyle: data.buttonStyle || 'arrow',
  };

  // Two layout modes:
  //   * carousel — horizontal scroll (the legacy default)
  //   * grid     — CSS grid with admin-chosen column count, wraps onto rows
  const layoutMode = data.layout === 'grid' ? 'grid' : 'carousel';
  const columns = Math.max(2, Math.min(6, Number(data.columns) || 3));

  return (
    <section className="section" style={{ padding: '100px var(--page-pad)' }}>
      <SectionHeader
        eyebrow={data.eyebrow}
        title={data.title || 'Products'}
        subtitle={data.subtitle}
        viewAllLink={centered ? null : viewAll}
        centered={centered}
      />

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {[...Array(6)].map((_, i) => <Skeleton key={i} style={{ height: 360 }} />)}
        </div>
      ) : layoutMode === 'grid' ? (
        <div style={{
          display: 'grid',
          // itemAlign:center swaps the rigid N-column layout for auto-fit so partial
          // rows can actually center. With repeat(N, 1fr) the columns always span
          // the full width and `justifyContent` is a no-op.
          gridTemplateColumns: data.itemAlign === 'center'
            ? `repeat(auto-fit, minmax(240px, ${Math.floor(100 / columns)}%))`
            : `repeat(${columns}, minmax(0, 1fr))`,
          justifyContent: data.itemAlign === 'center' ? 'center' : 'start',
          gap: data.gap || '24px',
        }}>
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--ink-muted)', padding: '40px', textAlign: 'center', gridColumn: '1/-1' }}>
              No products match this section's filter.
            </p>
          ) : filtered.map(p => (
            <ProductCard key={p._id} product={p} presentation={presentation} />
          ))}
        </div>
      ) : (
        <div className="carousel-wrap">
          <div
            className="carousel-track"
            ref={carouselRef}
            tabIndex={0}
            onKeyDown={handleCarouselKey}
            style={{ scrollSnapType: 'x mandatory', outline: 'none' }}
          >
            {filtered.map(p => (
              <div key={p._id} style={{ scrollSnapAlign: 'start' }}>
                <ProductCard product={p} presentation={presentation} />
              </div>
            ))}
            {filtered.length === 0 && (
              <p style={{ color: 'var(--ink-muted)', padding: '40px', textAlign: 'center', gridColumn: '1/-1' }}>
                No products match this section's filter.
              </p>
            )}
          </div>
          {filtered.length >= 4 && (
            <div className="carousel-nav">
              <button className="carousel-arrow" onClick={() => scrollCarousel(-1)} aria-label="Previous">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button className="carousel-arrow" onClick={() => scrollCarousel(1)} aria-label="Next">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>
      )}
      {centered && <SectionFooter viewAllLink={viewAll} />}
    </section>
  );
}


/* ─── Group Buys Block (active or interest-check feed) ───
   Two filtering modes (matching ProductGridBlock):
     * pinned via `data.gbIds` — render those exact group buys in that order
     * auto via `data.gbMode` (or legacy `data.mode`) + `data.limit`
   Card presentation is forwarded to GroupBuyCard so admin controls size,
   aspect, fields shown, button style, etc. — same knobs as products. */
function GroupBuysBlock({ data, groupBuys, forcedLayout }) {
  let filtered;
  if (Array.isArray(data.gbIds) && data.gbIds.length > 0) {
    const byId = new Map(groupBuys.map(gb => [String(gb._id), gb]));
    filtered = data.gbIds.map(id => byId.get(String(id))).filter(Boolean);
  } else {
    const mode = data.gbMode || data.mode || 'active';
    const limit = Math.max(1, Number(data.limit) || 4);
    filtered = (mode === 'interest-check'
      ? groupBuys.filter(gb => gb.status === 'interest-check')
      : groupBuys.filter(gb => gb.status !== 'interest-check')
    ).slice(0, limit);
  }

  if (filtered.length === 0) return null;

  const centered = data.align === 'center';
  const viewAll = data.viewAllLink || '/group-buys';
  const defaultTitle = (data.gbMode || data.mode) === 'interest-check' ? 'Interest Checks' : 'Active Group Buys';

  const renderLayout = forcedLayout || 'grid';
  const columns = Math.max(2, Math.min(6, Number(data.columns) || 3));
  const gap = data.gap || '24px';

  // Pass the same presentation shape ProductCard reads.
  const presentation = {
    size: data.cardSize || 'md',
    aspect: data.cardAspect || 'square',
    cardStyle: data.cardStyle || 'default',
    showCategory: data.showCategory !== false,
    showDescription: data.showDescription !== false,
    showPrice: data.showPrice !== false,
    showMeta: data.showMeta !== false,
    buttonStyle: data.buttonStyle || 'arrow',
  };

  const cardsCarousel = (
    <div className="carousel-wrap">
      <div className="carousel-track" style={{ scrollSnapType: 'x mandatory', outline: 'none' }}>
        {filtered.map(gb => (
          <div key={gb._id} style={{ scrollSnapAlign: 'start' }}>
            <GroupBuyCard gb={gb} presentation={presentation} />
          </div>
        ))}
      </div>
    </div>
  );
  const cardsGrid = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: data.itemAlign === 'center'
        ? `repeat(auto-fit, minmax(240px, ${Math.floor(100 / columns)}%))`
        : `repeat(${columns}, minmax(0, 1fr))`,
      justifyContent: data.itemAlign === 'center' ? 'center' : 'start',
      gap,
    }}>
      {filtered.map(gb => <GroupBuyCard key={gb._id} gb={gb} presentation={presentation} />)}
    </div>
  );

  return (
    <section className="section" style={{ padding: '0 var(--page-pad) 100px' }}>
      <SectionHeader
        eyebrow={data.eyebrow}
        title={data.title || defaultTitle}
        subtitle={data.subtitle}
        viewAllLink={centered ? null : viewAll}
        centered={centered}
      />
      {renderLayout === 'carousel' ? cardsCarousel : (renderLayout === 'grid' ? cardsGrid : (
        <div className="home-card-grid">
          {filtered.map(gb => <GroupBuyCard key={gb._id} gb={gb} presentation={presentation} />)}
        </div>
      ))}
      {centered && <SectionFooter viewAllLink={viewAll} />}
    </section>
  );
}


/* ─── Product Hero Block ─────────────────────────────────────────────────
   Apple-style "spotlight row" — 1, 2, or 3 hand-picked products rendered as
   large hero tiles that take up the section. Each tile is a giant click
   target leading to the product detail page; admins can override the title,
   add a tagline, and customize the CTA per tile.

   Layouts:
     * single — 1 full-width tile
     * pair   — 2 tiles side-by-side (50/50)
     * triple — 1 big tile (left, spans 2 rows) + 2 small tiles stacked right */
const PRODUCT_HERO_HEIGHTS = { medium: 480, tall: 640, xtall: 760, fullscreen: '88vh' };

function ProductHeroBlock({ data, products, adminMode }) {
  const layout = data.layout || 'pair';
  const maxTiles = layout === 'single' ? 1 : layout === 'pair' ? 2 : 3;
  const rawTiles = (data.tiles || []).slice(0, maxTiles);
  if (rawTiles.length === 0) return null;

  const byId = new Map(products.map(p => [String(p._id), p]));
  // In admin mode, keep all slots so the layout is always visible (unfilled
  // slots render as placeholders). On the live customer page, drop slots that
  // can't be resolved — and if every slot is empty, hide the block entirely.
  const resolved = rawTiles.map(t => ({ tile: t, product: byId.get(String(t.productId)) }));
  const tiles = adminMode ? resolved : resolved.filter(t => t.product);
  if (tiles.length === 0) return null;

  const heightVal = PRODUCT_HERO_HEIGHTS[data.height] ?? PRODUCT_HERO_HEIGHTS.tall;
  const tileHeight = typeof heightVal === 'string' ? heightVal : `${heightVal}px`;
  const gap = data.gap === 0 ? 0 : (Number(data.gap) || 8);
  const fullBleed = data.fullBleed !== false; // default to edge-to-edge
  const sectionMargin = fullBleed ? '0' : '0 var(--page-pad)';

  // Block-level header (optional)
  const showHeader = !!(data.title || data.subtitle || data.eyebrow);
  const headerCentered = data.align !== 'left';

  let gridStyle;
  if (layout === 'single') {
    gridStyle = { display: 'grid', gridTemplateColumns: '1fr', gap };
  } else if (layout === 'pair') {
    gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap };
  } else {
    // triple: 1.6fr | 1fr, 2 rows tall — first tile spans both rows
    gridStyle = { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gridTemplateRows: `${tileHeight} ${tileHeight}`, gap };
  }

  return (
    <section style={{ padding: showHeader ? '64px 0 40px' : '40px 0', margin: 0 }}>
      {/* Scoped: hover-zoom on tile image + collapse pair/triple grids on mobile.
          The .ph-header rule tightens the spacing between the section title and
          the hero tiles — previously SectionHeader's own marginBottom plus the
          wrapper's padding stacked into a ~90px gap, which felt disconnected. */}
      <style>{`
        .ph-tile:hover .ph-tile-img { transform: scale(1.04); }
        .ph-header > div { margin-bottom: 0 !important; }
        @media (max-width: 720px) {
          .ph-grid { grid-template-columns: 1fr !important; grid-template-rows: auto !important; }
          .ph-grid > .ph-tile { grid-row: auto !important; height: 480px !important; min-height: 480px !important; }
        }
      `}</style>
      {showHeader && (
        <div className="ph-header" style={{ padding: `0 var(--page-pad) 20px` }}>
          <SectionHeader
            eyebrow={data.eyebrow}
            title={data.title || ''}
            subtitle={data.subtitle}
            viewAllLink={null}
            centered={headerCentered}
          />
        </div>
      )}
      <div className="ph-grid" style={{ ...gridStyle, margin: sectionMargin }}>
        {tiles.map((t, i) => {
          const isBig = layout === 'triple' && i === 0;
          // Admin placeholder tile when no product picked yet — shows the layout
          // structure with a "Pick a product" prompt so the block is visible
          // and clickable in the live-preview editor.
          if (!t.product) {
            return (
              <ProductHeroPlaceholder
                key={`ph-empty-${i}`}
                index={i}
                height={tileHeight}
                gridStyle={isBig ? { gridRow: 'span 2' } : {}}
              />
            );
          }
          return (
            <ProductHeroTile
              key={t.product._id + i}
              tile={t.tile}
              product={t.product}
              blockDefaults={{
                textColor: data.textColor || 'light',
                textAlign: data.textAlign || 'center',
                imageStyle: data.imageStyle || 'overlay',
                verticalAlign: data.verticalAlign || 'bottom',
              }}
              tileHeight={layout === 'triple' && !isBig ? tileHeight : tileHeight}
              gridStyle={isBig ? { gridRow: 'span 2' } : {}}
            />
          );
        })}
      </div>
    </section>
  );
}

/* Cross-fade carousel for product images inside a hero tile. Pauses on hover
   so the admin / a hovering customer doesn't fight the rotation. Each image
   is absolutely positioned so the tile's existing layout (overlay vs stacked)
   doesn't need to change. */
function ProductHeroImageCarousel({ images, alt, interval = 4500, hoverScale = true }) {
  const valid = (images || []).filter(i => i?.url);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (valid.length <= 1 || paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % valid.length), interval);
    return () => clearInterval(t);
  }, [valid.length, interval, paused]);

  if (valid.length === 0) {
    return <div style={{ position: 'absolute', inset: 0, background: 'var(--accent-light)' }} />;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}>
      {valid.map((img, i) => (
        <img
          key={img.url + i}
          src={img.url}
          alt={alt}
          className={hoverScale ? 'ph-tile-img' : undefined}
          loading={i === 0 ? 'eager' : 'lazy'}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: i === idx ? 1 : 0,
            transition: 'opacity 1.1s ease, transform 0.9s ease-out',
          }}
        />
      ))}
      {valid.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 6, zIndex: 3, pointerEvents: 'none',
        }}>
          {valid.map((_, i) => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === idx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* Admin-only stand-in shown when a tile slot has no product picked yet. */
function ProductHeroPlaceholder({ index, height, gridStyle }) {
  return (
    <div className="ph-tile" style={{
      minHeight: height, height,
      background: 'var(--bg-secondary)',
      border: '2px dashed var(--border)',
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-muted)', textAlign: 'center', padding: 24,
      ...gridStyle,
    }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>
        Tile {index + 1}
      </p>
      <p style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>Pick a product</p>
      <p style={{ fontSize: '0.78rem', marginTop: 6 }}>Open the block editor to assign one.</p>
    </div>
  );
}

function ProductHeroTile({ tile, product, blockDefaults, tileHeight, gridStyle }) {
  const images = product.images || [];
  const hasImage = images.some(i => i?.url);
  const eyebrow = tile.eyebrow !== undefined && tile.eyebrow !== ''
    ? tile.eyebrow
    : (product.category ? product.category.replace(/-/g, ' ') : '');
  const name = tile.titleOverride || product.name;
  const subtitle = tile.subtitle || '';
  const ctaLabel = tile.ctaLabel !== undefined ? tile.ctaLabel : 'Shop';
  const ctaLink = tile.ctaLink || `/products/${product._id}`;

  const textAlign = tile.textAlign || blockDefaults.textAlign;
  const textColor = tile.textColor || blockDefaults.textColor;
  const verticalAlign = tile.verticalAlign || blockDefaults.verticalAlign;
  const imageStyle = tile.imageStyle || blockDefaults.imageStyle;
  const tileBg = tile.bg || null;

  const isLight = textColor === 'light';
  const fg    = isLight ? '#fff' : 'var(--ink)';
  const subFg = isLight ? 'rgba(255,255,255,0.78)' : 'var(--ink-muted)';
  const eyeFg = isLight ? 'rgba(255,255,255,0.85)' : 'var(--accent)';
  const alignH = { left: 'flex-start', center: 'center', right: 'flex-end' }[textAlign] || 'center';
  const alignV = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[verticalAlign] || 'flex-end';

  const content = (
    <div style={{
      textAlign,
      color: fg,
      maxWidth: 520,
      ...(textAlign === 'center' && { marginLeft: 'auto', marginRight: 'auto' }),
    }}>
      {eyebrow && (
        <p style={{
          fontSize: '0.74rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: eyeFg, marginBottom: 16,
        }}>{eyebrow}</p>
      )}
      <h3 style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: 'clamp(2rem, 3.6vw, 3.4rem)', lineHeight: 1.05,
        letterSpacing: '-0.03em', marginBottom: 14, color: fg,
      }}>{name}</h3>
      {subtitle && (
        <p style={{
          fontSize: '1.05rem', lineHeight: 1.5, color: subFg,
          marginBottom: 26, maxWidth: 420,
          ...(textAlign === 'center' && { marginLeft: 'auto', marginRight: 'auto' }),
        }}>{subtitle}</p>
      )}
      {ctaLabel && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '1rem', fontWeight: 500, color: fg, textDecoration: 'none',
          borderBottom: `1px solid ${isLight ? 'rgba(255,255,255,0.55)' : 'var(--ink)'}`,
          paddingBottom: 3,
        }}>{ctaLabel} <span aria-hidden="true">→</span></span>
      )}
    </div>
  );

  // ── stacked-below: image on top, content below (apple.com style)
  if (imageStyle === 'stacked-below' || imageStyle === 'stacked-above') {
    const imageBlock = (
      <div style={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden', minHeight: '50%', background: 'var(--accent-light)' }}>
        {hasImage
          ? <ProductHeroImageCarousel images={images} alt={name} />
          : <div style={{ width: '100%', height: '100%', background: 'var(--accent-light)' }} />}
      </div>
    );
    const contentBlock = (
      <div style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', alignItems: alignH }}>
        {content}
      </div>
    );
    return (
      <Link to={ctaLink} className="ph-tile" style={{
        display: 'flex', flexDirection: 'column',
        minHeight: tileHeight, height: tileHeight,
        background: tileBg || (textColor === 'light' ? 'var(--ink)' : 'var(--bg-secondary)'),
        textDecoration: 'none', overflow: 'hidden',
        ...gridStyle,
      }}>
        {imageStyle === 'stacked-above'
          ? <>{contentBlock}{imageBlock}</>
          : <>{imageBlock}{contentBlock}</>}
      </Link>
    );
  }

  // ── overlay: image as full background, content overlaid with scrim
  const scrim = tile.scrim ?? 0.45;
  const scrimDir = tile.scrimDir || (verticalAlign === 'bottom' ? 'bottom' : verticalAlign === 'top' ? 'top' : 'flat');
  const scrimGradient = (() => {
    if (!scrim) return null;
    const a = `rgba(0,0,0,${scrim})`;
    const t = 'transparent';
    if (scrimDir === 'bottom') return `linear-gradient(to top, ${a} 0%, ${t} 75%)`;
    if (scrimDir === 'top')    return `linear-gradient(to bottom, ${a} 0%, ${t} 75%)`;
    if (scrimDir === 'left')   return `linear-gradient(to right, ${a} 0%, ${t} 60%)`;
    if (scrimDir === 'right')  return `linear-gradient(to left,  ${a} 0%, ${t} 60%)`;
    return a;
  })();

  return (
    <Link to={ctaLink} className="ph-tile" style={{
      position: 'relative', overflow: 'hidden',
      background: tileBg || 'var(--ink)',
      textDecoration: 'none',
      minHeight: tileHeight, height: tileHeight,
      display: 'flex', flexDirection: 'column',
      justifyContent: alignV, alignItems: alignH,
      ...gridStyle,
    }}>
      {hasImage && <ProductHeroImageCarousel images={images} alt={name} />}
      {scrimGradient && (
        <div style={{ position: 'absolute', inset: 0, background: scrimGradient, pointerEvents: 'none', zIndex: 1 }} />
      )}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '60px 48px', width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: alignH,
      }}>
        {content}
      </div>
    </Link>
  );
}


/* ─── Marquee row ─────────────────────────────────────────────────────────
   Infinite horizontal auto-scroll. Items are rendered twice in a row that
   slides from translateX(0) → translateX(-50%), so the second copy is in
   position by the time we wrap — no visible jump. Animation duration is
   computed from the track's measured width and the admin-picked pixels/sec
   so longer lists don't speed up just because there are more items.

   Edges fade out so cards don't pop in/out abruptly. Hovering pauses; users
   with prefers-reduced-motion get a static row instead. */
function MarqueeRow({ items, renderItem, speed = 40, gap = 24, cardWidth = 280 }) {
  const trackRef = useRef(null);
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    const measure = () => {
      if (!trackRef.current) return;
      // We duplicate items, so the keyframe goes 0 → -50%. The visible scroll
      // distance is half the track's scrollWidth, and time = distance / speed.
      const halfWidth = trackRef.current.scrollWidth / 2;
      const safeSpeed = Math.max(5, speed);
      setDuration(Math.max(6, halfWidth / safeSpeed));
    };
    measure();
    // Recompute on resize so the speed-in-px/sec promise holds.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && trackRef.current) ro.observe(trackRef.current);
    return () => { if (ro) ro.disconnect(); };
  }, [items, speed]);

  if (!items || items.length === 0) return null;

  return (
    <div className="marquee-wrap">
      <div ref={trackRef} className="marquee-track" style={{ gap: `${gap}px`, animationDuration: `${duration}s` }}>
        {items.map((item, i) => (
          <div key={`a-${i}`} className="marquee-cell" style={{ width: cardWidth, flexShrink: 0 }}>
            {renderItem(item, i)}
          </div>
        ))}
        {/* Duplicate set — keeps the scroll seamless across the keyframe wrap. */}
        {items.map((item, i) => (
          <div key={`b-${i}`} className="marquee-cell" style={{ width: cardWidth, flexShrink: 0 }} aria-hidden="true">
            {renderItem(item, i)}
          </div>
        ))}
      </div>
      <style>{`
        .marquee-wrap {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to right, transparent, black 4%, black 96%, transparent);
                  mask-image: linear-gradient(to right, transparent, black 4%, black 96%, transparent);
        }
        .marquee-track {
          display: flex; width: max-content;
          animation: marquee-scroll linear infinite;
          will-change: transform;
        }
        .marquee-wrap:hover .marquee-track { animation-play-state: paused; }
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none !important; transform: none !important; }
          .marquee-wrap  { overflow-x: auto; }
        }
      `}</style>
    </div>
  );
}


/* ─── Collection Block ────────────────────────────────────────────────────
   Unified renderer for all "row of items" sections. Admin picks:
     * source — `products` or `group-buys`
     * layout — `carousel`, `grid`, `hero`, or `marquee`
   This component normalizes the data shape for each combination and routes
   to the right piece-renderer. Empty sources render nothing in customer mode
   (and a placeholder in admin live-preview so the section stays editable). */
function CollectionBlock({ data, products, groupBuys, loading, adminMode }) {
  const source = data.source || 'products';
  const layout = data.layout || 'carousel';

  // ── Source: mixed — admin pins any combination of products and group buys ──
  if (source === 'mixed') {
    // Hero isn't supported for mixed (tile editor still expects a productId).
    // Force carousel/grid/marquee fallback — mostly hit via legacy data.
    const effLayout = layout === 'hero' ? 'carousel' : layout;
    return <MixedCollectionBlock data={data} layout={effLayout} products={products} groupBuys={groupBuys} />;
  }

  // ── Marquee: auto-scrolling row, handled identically for either source ──
  if (layout === 'marquee') {
    return <CollectionMarqueeBlock data={data} products={products} groupBuys={groupBuys} />;
  }

  // ── Source: group buys ──
  if (source === 'group-buys') {
    if (layout === 'hero') {
      // Map group buys into the hero-tile shape. Each tile maps a single
      // group buy, auto-linked to its detail page. Admin-side tile-level
      // customizations are skipped for group-buys (they don't have a "pick
      // 3 specific group buys" picker — they come from the live feed).
      const mode = data.gbMode || 'active';
      const filtered = mode === 'interest-check'
        ? groupBuys.filter(gb => gb.status === 'interest-check')
        : groupBuys.filter(gb => gb.status !== 'interest-check');
      const variant = data.heroVariant || 'pair';
      const max = variant === 'single' ? 1 : variant === 'triple' ? 3 : 2;
      const items = filtered.slice(0, max);
      return (
        <GenericHeroRow
          data={data}
          items={items}
          itemToTile={gb => ({
            images: gb.images || [],
            name: gb.name,
            category: gb.kind || 'group-buy',
            detailLink: `/group-buys/${gb._id}`,
          })}
          adminMode={adminMode}
          emptyLabel="Group Buy Hero — no matching group buys"
        />
      );
    }
    // Carousel or grid — delegate to GroupBuysBlock, adapting field names.
    return (
      <GroupBuysBlock
        data={{ ...data, mode: data.gbMode || data.mode || 'active' }}
        groupBuys={groupBuys}
        forcedLayout={layout}
      />
    );
  }

  // ── Source: products ──
  if (layout === 'hero') {
    // ProductHeroBlock reads `data.layout` as the tile variant (single/pair/triple);
    // the unified collection stores that under `heroVariant`. Adapt at the boundary.
    return (
      <ProductHeroBlock
        data={{ ...data, layout: data.heroVariant || 'pair' }}
        products={products}
        adminMode={adminMode}
      />
    );
  }
  // Carousel or grid — ProductGridBlock already supports both via `data.layout`.
  return <ProductGridBlock data={data} products={products} loading={loading} />;
}


/* ─── Marquee Collection Block ────────────────────────────────────────────
   Auto-scrolling row for either products or group buys. Filtering follows the
   same rules as the grid/carousel paths (pinned IDs first; otherwise auto-
   fill via category/sort/limit or gbMode/limit). Speed is admin-controlled
   in px/sec via data.marqueeSpeed (default 40). */
function CollectionMarqueeBlock({ data, products, groupBuys }) {
  const source = data.source || 'products';

  let items = [];
  if (source === 'products') {
    if (Array.isArray(data.productIds) && data.productIds.length > 0) {
      const byId = new Map(products.map(p => [String(p._id), p]));
      items = data.productIds.map(id => byId.get(String(id))).filter(Boolean);
    } else {
      let list = products;
      if (data.category) list = list.filter(p => (p.category || '').toLowerCase().replace(/\s+/g, '-') === data.category);
      items = list.slice(0, Math.max(2, Number(data.limit) || 12));
    }
  } else {
    if (Array.isArray(data.gbIds) && data.gbIds.length > 0) {
      const byId = new Map(groupBuys.map(g => [String(g._id), g]));
      items = data.gbIds.map(id => byId.get(String(id))).filter(Boolean);
    } else {
      const mode = data.gbMode || 'active';
      const filtered = mode === 'interest-check'
        ? groupBuys.filter(gb => gb.status === 'interest-check')
        : groupBuys.filter(gb => gb.status !== 'interest-check');
      items = filtered.slice(0, Math.max(2, Number(data.limit) || 12));
    }
  }

  if (items.length === 0) return null;

  const centered = data.align === 'center';
  const viewAll = data.viewAllLink || (source === 'group-buys' ? '/group-buys' : '/products');
  const defaultTitle = source === 'group-buys'
    ? ((data.gbMode || 'active') === 'interest-check' ? 'Interest Checks' : 'Active Group Buys')
    : 'Products';

  // Match the card-size scale used by ProductCard / GroupBuyCard so marquee
  // cards align visually with the rest of the site.
  const sizeWidth = { sm: 240, md: 280, lg: 340 };
  const cardWidth = sizeWidth[data.cardSize || 'md'] || 280;
  const speed = Math.max(5, Math.min(200, Number(data.marqueeSpeed) || 40));
  const gap = Number(data.gap) || 24;

  const presentation = {
    size: data.cardSize || 'md',
    aspect: data.cardAspect || 'square',
    cardStyle: data.cardStyle || 'default',
    showCategory: data.showCategory !== false,
    showDescription: data.showDescription !== false,
    showPrice: data.showPrice !== false,
    showMeta: data.showMeta !== false,
    buttonStyle: data.buttonStyle || 'arrow',
  };

  return (
    <section className="section" style={{ padding: '80px 0' }}>
      <div style={{ padding: '0 var(--page-pad)', marginBottom: 32 }}>
        <SectionHeader
          eyebrow={data.eyebrow}
          title={data.title || defaultTitle}
          subtitle={data.subtitle}
          viewAllLink={centered ? null : viewAll}
          centered={centered}
        />
      </div>
      <MarqueeRow
        items={items}
        renderItem={(item) =>
          source === 'group-buys'
            ? <GroupBuyCard gb={item} presentation={presentation} />
            : <ProductCard product={item} presentation={presentation} />
        }
        speed={speed}
        gap={gap}
        cardWidth={cardWidth}
      />
      {centered && <SectionFooter viewAllLink={viewAll} />}
    </section>
  );
}


/* ─── Mixed Collection Block ──────────────────────────────────────────────
   Renders a single row that mixes products and group buys, in admin-pinned
   order. Each pinned ref is { type: 'product' | 'group-buy', id }. Items that
   no longer exist (archived/deleted) are dropped silently.

   Supports carousel / grid / marquee. Hero is disabled for mixed sources —
   the hero tile editor still expects a flat productId; we'd need a separate
   editor to support mixed tiles, and it's not worth the surface area. */
function MixedCollectionBlock({ data, layout, products, groupBuys }) {
  const productById = useMemo(() => new Map(products.map(p => [String(p._id), p])), [products]);
  const gbById = useMemo(() => new Map(groupBuys.map(g => [String(g._id), g])), [groupBuys]);

  const refs = Array.isArray(data.mixedItems) ? data.mixedItems : [];
  const items = refs.map(ref => {
    if (!ref || !ref.id) return null;
    if (ref.type === 'group-buy') {
      const gb = gbById.get(String(ref.id));
      return gb ? { type: 'group-buy', data: gb } : null;
    }
    const p = productById.get(String(ref.id));
    return p ? { type: 'product', data: p } : null;
  }).filter(Boolean);

  if (items.length === 0) return null;

  const centered = data.align === 'center';
  const viewAll = data.viewAllLink || '/products';
  const defaultTitle = data.title || 'Featured';
  const presentation = {
    size: data.cardSize || 'md',
    aspect: data.cardAspect || 'square',
    cardStyle: data.cardStyle || 'default',
    showCategory: data.showCategory !== false,
    showDescription: data.showDescription !== false,
    showPrice: data.showPrice !== false,
    showMeta: data.showMeta !== false,
    buttonStyle: data.buttonStyle || 'arrow',
  };

  const renderItem = (item) =>
    item.type === 'group-buy'
      ? <GroupBuyCard gb={item.data} presentation={presentation} />
      : <ProductCard product={item.data} presentation={presentation} />;

  // Marquee path reuses the shared MarqueeRow.
  if (layout === 'marquee') {
    const sizeWidth = { sm: 240, md: 280, lg: 340 };
    const cardWidth = sizeWidth[presentation.size] || 280;
    const speed = Math.max(5, Math.min(200, Number(data.marqueeSpeed) || 40));
    const gap = Number(data.gap) || 24;
    return (
      <section className="section" style={{ padding: '80px 0' }}>
        <div style={{ padding: '0 var(--page-pad)', marginBottom: 32 }}>
          <SectionHeader
            eyebrow={data.eyebrow}
            title={defaultTitle}
            subtitle={data.subtitle}
            viewAllLink={centered ? null : viewAll}
            centered={centered}
          />
        </div>
        <MarqueeRow items={items} renderItem={renderItem} speed={speed} gap={gap} cardWidth={cardWidth} />
        {centered && <SectionFooter viewAllLink={viewAll} />}
      </section>
    );
  }

  // Grid path — supports itemAlign:center via auto-fit + justify-content.
  if (layout === 'grid') {
    const columns = Math.max(2, Math.min(6, Number(data.columns) || 3));
    return (
      <section className="section" style={{ padding: '80px var(--page-pad)' }}>
        <SectionHeader
          eyebrow={data.eyebrow}
          title={defaultTitle}
          subtitle={data.subtitle}
          viewAllLink={centered ? null : viewAll}
          centered={centered}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: data.itemAlign === 'center'
            ? `repeat(auto-fit, minmax(240px, ${Math.floor(100 / columns)}%))`
            : `repeat(${columns}, minmax(0, 1fr))`,
          justifyContent: data.itemAlign === 'center' ? 'center' : 'start',
          gap: data.gap || '24px',
        }}>
          {items.map((item, i) => (
            <div key={`${item.type}-${item.data._id || i}`}>{renderItem(item)}</div>
          ))}
        </div>
        {centered && <SectionFooter viewAllLink={viewAll} />}
      </section>
    );
  }

  // Default: horizontal carousel (matches ProductGridBlock visuals).
  return (
    <section className="section" style={{ padding: '100px var(--page-pad)' }}>
      <SectionHeader
        eyebrow={data.eyebrow}
        title={defaultTitle}
        subtitle={data.subtitle}
        viewAllLink={centered ? null : viewAll}
        centered={centered}
      />
      <div className="carousel-wrap">
        <div className="carousel-track" style={{ scrollSnapType: 'x mandatory' }}>
          {items.map((item, i) => (
            <div key={`${item.type}-${item.data._id || i}`} style={{ scrollSnapAlign: 'start' }}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>
      {centered && <SectionFooter viewAllLink={viewAll} />}
    </section>
  );
}


/* ─── Generic Hero Row ────────────────────────────────────────────────────
   The data-agnostic version of the product-hero layout. `itemToTile` adapts
   either a product or a group-buy into the common tile shape so we don't
   maintain two copies of the hero-tile rendering. */
function GenericHeroRow({ data, items, itemToTile, adminMode, emptyLabel }) {
  if (items.length === 0 && !adminMode) return null;

  const variant = data.heroVariant || 'pair';
  const maxTiles = variant === 'single' ? 1 : variant === 'triple' ? 3 : 2;
  const heightVal = PRODUCT_HERO_HEIGHTS[data.height] ?? PRODUCT_HERO_HEIGHTS.tall;
  const tileHeight = typeof heightVal === 'string' ? heightVal : `${heightVal}px`;
  const gap = data.gap === 0 ? 0 : (Number(data.gap) || 8);
  const fullBleed = data.fullBleed !== false;
  const sectionMargin = fullBleed ? '0' : '0 var(--page-pad)';

  const showHeader = !!(data.title || data.subtitle || data.eyebrow);
  const headerCentered = data.align !== 'left';

  let gridStyle;
  if (variant === 'single') {
    gridStyle = { display: 'grid', gridTemplateColumns: '1fr', gap };
  } else if (variant === 'pair') {
    gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap };
  } else {
    gridStyle = { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gridTemplateRows: `${tileHeight} ${tileHeight}`, gap };
  }

  const blockDefaults = {
    textColor: data.textColor || 'light',
    textAlign: data.textAlign || 'center',
    imageStyle: data.imageStyle || 'overlay',
    verticalAlign: data.verticalAlign || 'bottom',
  };

  // Pad items with placeholders in admin mode so admin sees the full layout
  // even when the live feed has fewer items than the tile count.
  const renderTiles = [];
  for (let i = 0; i < maxTiles; i++) {
    if (i < items.length) {
      renderTiles.push({ data: itemToTile(items[i]), filled: true });
    } else if (adminMode) {
      renderTiles.push({ data: null, filled: false });
    }
  }

  return (
    <section style={{ padding: showHeader ? '64px 0 40px' : '40px 0', margin: 0 }}>
      <style>{`
        .ph-tile:hover .ph-tile-img { transform: scale(1.04); }
        .ph-header > div { margin-bottom: 0 !important; }
        @media (max-width: 720px) {
          .ph-grid { grid-template-columns: 1fr !important; grid-template-rows: auto !important; }
          .ph-grid > .ph-tile { grid-row: auto !important; height: 480px !important; min-height: 480px !important; }
        }
      `}</style>
      {showHeader && (
        <div className="ph-header" style={{ padding: `0 var(--page-pad) 20px` }}>
          <SectionHeader
            eyebrow={data.eyebrow}
            title={data.title || ''}
            subtitle={data.subtitle}
            viewAllLink={null}
            centered={headerCentered}
          />
        </div>
      )}
      <div className="ph-grid" style={{ ...gridStyle, margin: sectionMargin }}>
        {renderTiles.map((t, i) => {
          const isBig = variant === 'triple' && i === 0;
          if (!t.filled) {
            return <ProductHeroPlaceholder key={`empty-${i}`} index={i} height={tileHeight} gridStyle={isBig ? { gridRow: 'span 2' } : {}} />;
          }
          // Synthesize a minimal `product` shape that ProductHeroTile already
          // understands. We're just plumbing the tile-data through its existing
          // renderer instead of duplicating it.
          const synthProduct = {
            _id: `synth-${i}`,
            name: t.data.name,
            images: t.data.images,
            category: t.data.category,
          };
          return (
            <ProductHeroTile
              key={`tile-${i}`}
              tile={{ ctaLink: t.data.detailLink, ctaLabel: 'Learn more' }}
              product={synthProduct}
              blockDefaults={blockDefaults}
              tileHeight={tileHeight}
              gridStyle={isBig ? { gridRow: 'span 2' } : {}}
            />
          );
        })}
      </div>
      {(showHeader || items.length === 0) && adminMode && items.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.85rem', marginTop: 12 }}>
          {emptyLabel}
        </p>
      )}
    </section>
  );
}


/* ─── Hero Carousel ─── */
function HeroCarousel({ images, fallbackImage, eyebrow, title, subtitle, primaryCta, secondaryCta }) {
  const [current, setCurrent] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const timerRef = useRef(null);
  const displayImages = images.length > 0 ? images : (fallbackImage ? [fallbackImage] : []);
  const hasImages = displayImages.length > 0;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (displayImages.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % displayImages.length);
    }, 5000);
  }, [displayImages.length]);

  const firstImgRef = useRef(null);
  useEffect(() => {
    // Fade in only after the first image has actually loaded, otherwise the transition
    // runs while the <img> is still fetching and the user sees a pop when it decodes.
    const img = firstImgRef.current;
    if (img && img.complete && img.naturalHeight > 0) {
      // Cached: flip on the next frame so the browser paints opacity:0 first.
      const id = requestAnimationFrame(() => setMounted(true));
      startTimer();
      return () => { cancelAnimationFrame(id); if (timerRef.current) clearInterval(timerRef.current); };
    }
    const fallback = setTimeout(() => setMounted(true), 3000);
    startTimer();
    return () => { clearTimeout(fallback); if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = (index) => {
    setCurrent(index);
    startTimer();
  };

  return (
    <>
      <div className="hero-bg">
        {hasImages && displayImages.map((src, i) => (
          <img
            key={i}
            ref={i === 0 ? firstImgRef : null}
            src={src}
            alt={`Hero ${i + 1}`}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding={i === 0 ? 'sync' : 'async'}
            fetchpriority={i === 0 ? 'high' : 'auto'}
            onLoad={i === 0 ? () => requestAnimationFrame(() => setMounted(true)) : undefined}
            className={`hero-slide ${mounted && i === current ? 'active' : ''}`}
          />
        ))}
        <div className="hero-slide-fallback" />
      </div>

      <div className="hero-content">
        <div className="hero-text">
          <p className="hero-eyebrow animate-fadeUp">{eyebrow}</p>
          <h1 className="hero-title animate-fadeUp" style={{ animationDelay: '0.15s' }}>
            {parseItalic(title)}
          </h1>
          <p className="hero-sub animate-fadeUp" style={{ animationDelay: '0.3s' }}>
            {subtitle}
          </p>
          <div className="hero-cta animate-fadeUp" style={{ animationDelay: '0.45s' }}>
            {primaryCta.label && <Link to={primaryCta.link} className="btn-primary">{primaryCta.label}</Link>}
            {secondaryCta.label && <Link to={secondaryCta.link} className="btn-ghost">{secondaryCta.label}</Link>}
          </div>
        </div>
      </div>

      {displayImages.length > 1 && (
        <div className="hero-dots">
          {displayImages.map((_, i) => (
            <button
              key={i}
              className={`hero-dot ${i === current ? 'active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {!scrolled && (
        <div className="hero-scroll-indicator" aria-hidden="true">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      )}
    </>
  );
}


/* ─── Banner Section ──────────────────────────────────────────────────
   Single flexible renderer. `layout` chooses the structural arrangement
   (where the image sits relative to the content); every visual knob below
   (height, padding, scrim, text alignment, CTA style, etc.) is independent
   and overrides the layout's default preset.

   Backward-compatible: an old banner with only `{layout, image, title, ...}`
   still renders correctly because every new prop has a per-layout default. */

const BANNER_PRESETS = {
  split:     { textAlign: 'left',   verticalAlign: 'middle', height: 'medium', scrim: 0,     textColor: 'light', padding: 'spacious', cornerRadius: 'lg',   imageOpacity: 1, ctaStyle: 'filled', imagePosition: 'right' },
  overlay:   { textAlign: 'left',   verticalAlign: 'bottom', height: 'tall',   scrim: 0.45,  textColor: 'light', padding: 'spacious', cornerRadius: 'lg',   imageOpacity: 1, ctaStyle: 'filled' },
  stacked:   { textAlign: 'center', verticalAlign: 'middle', height: 'medium', scrim: 0,     textColor: 'dark',  padding: 'normal',   cornerRadius: 'lg',   imageOpacity: 1, ctaStyle: 'filled', imagePosition: 'top' },
  fullbleed: { textAlign: 'left',   verticalAlign: 'bottom', height: 'xtall',  scrim: 0.5,   textColor: 'light', padding: 'spacious', cornerRadius: 'none', imageOpacity: 1, ctaStyle: 'ghost',  fullBleed: true },
};

const BANNER_HEIGHT  = { short: 280, medium: 420, tall: 520, xtall: 640 };
const BANNER_PADDING = { compact: '36px 28px', normal: '56px 44px', spacious: '80px 64px' };
const BANNER_CORNER  = { none: 0, sm: 8, md: 16, lg: 24 };

/* Build a scrim gradient. `dir` accepts the same compass directions plus
   'flat' (uniform overlay) and 'radial' (darker at the edges, useful for
   centered text). */
function bannerScrim(strength, dir) {
  if (!strength) return null;
  const a = `rgba(0,0,0,${strength})`;
  const t = 'transparent';
  switch (dir) {
    case 'top':    return `linear-gradient(to bottom, ${a} 0%, ${t} 75%)`;
    case 'bottom': return `linear-gradient(to top,    ${a} 0%, ${t} 75%)`;
    case 'left':   return `linear-gradient(to right,  ${a} 0%, ${t} 65%)`;
    case 'right':  return `linear-gradient(to left,   ${a} 0%, ${t} 65%)`;
    case 'radial': return `radial-gradient(circle at center, ${t} 0%, ${a} 95%)`;
    default:       return a;
  }
}

/* Auto-derive scrim direction from verticalAlign + textAlign so admins don't
   have to think about it. Text at bottom → fade dark from bottom; text at
   top → fade from top; text middle-center → radial. Admin can still override. */
function autoScrimDir(verticalAlign, textAlign) {
  if (verticalAlign === 'bottom') return 'bottom';
  if (verticalAlign === 'top')    return 'top';
  if (textAlign === 'left')       return 'left';
  if (textAlign === 'right')      return 'right';
  return 'radial';
}

function BannerCta({ style, label, link, isLight }) {
  if (style === 'none' || !label) return null;
  if (style === 'text' || style === 'text-arrow') {
    return (
      <Link to={link} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontSize: '0.98rem', fontWeight: 500,
        color: isLight ? '#fff' : 'var(--ink)',
        textDecoration: 'none',
        borderBottom: `1.5px solid ${isLight ? 'rgba(255,255,255,0.55)' : 'var(--ink)'}`,
        paddingBottom: 3,
        transition: 'gap 0.2s, border-color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.gap = '12px'}
      onMouseLeave={e => e.currentTarget.style.gap = '8px'}
      >{label} <span aria-hidden="true">→</span></Link>
    );
  }
  if (style === 'ghost') {
    return (
      <Link to={link} className={isLight ? 'btn-ghost-white' : 'btn-outline'}>
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <Link to={link} className={isLight ? 'btn-light' : 'btn-dark'}>
      <span>{label}</span>
    </Link>
  );
}

function BannerSection({ layout = 'split', imgUrl, eyebrow, title, subtitle, ctaLabel, ctaLink, ...overrides }) {
  const bannerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Resolve: layout preset first, then admin overrides (only when set).
  const preset = BANNER_PRESETS[layout] || BANNER_PRESETS.split;
  const settings = { ...preset };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === null || v === '') continue;
    settings[k] = v;
  }

  const isLight = settings.textColor === 'light';
  const isDark  = settings.textColor === 'dark';
  const minH    = typeof settings.height === 'number' ? settings.height : (BANNER_HEIGHT[settings.height] || BANNER_HEIGHT.medium);
  const pad     = BANNER_PADDING[settings.padding] || (typeof settings.padding === 'string' ? settings.padding : BANNER_PADDING.normal);
  const radius  = BANNER_CORNER[settings.cornerRadius] ?? 24;

  const alignH = { left: 'flex-start', center: 'center', right: 'flex-end' }[settings.textAlign] || 'flex-start';
  const alignV = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[settings.verticalAlign] || 'center';

  // Color tokens. Italic em gets a tinted accent for visual weight, matching
  // the original CSS-driven banner. Text shadow adds readability over busy
  // images when text is light (overlay/fullbleed contexts).
  const fg            = isLight ? '#fff' : (isDark ? 'var(--ink)' : 'inherit');
  const subFg         = isLight ? 'rgba(255,255,255,0.78)' : 'var(--ink-muted)';
  const eyeFg         = isLight ? 'rgba(255,255,255,0.92)' : 'var(--accent)';
  const italicColor   = isLight ? '#a8d8be' : 'var(--accent)';
  const overImageText = (layout === 'overlay' || layout === 'fullbleed') && isLight;
  const titleShadow   = overImageText ? '0 2px 24px rgba(0,0,0,0.35)' : 'none';
  const subShadow     = overImageText ? '0 1px 12px rgba(0,0,0,0.4)' : 'none';

  const titleJsx = parseItalic(title, { fontStyle: 'italic', color: italicColor });
  const margin   = settings.fullBleed ? '0 0 80px' : '0 var(--page-pad) 80px';
  const scrimDir = settings.scrimDir || autoScrimDir(settings.verticalAlign, settings.textAlign);
  const scrimBg  = bannerScrim(settings.scrim, scrimDir);

  const content = (
    <div className={visible ? 'banner-animate-in' : ''} style={{
      textAlign: settings.textAlign || 'left',
      color: fg,
      maxWidth: settings.textAlign === 'center' ? 720 : 560,
      ...(settings.textAlign === 'center' && { marginLeft: 'auto', marginRight: 'auto' }),
    }}>
      {eyebrow && (
        <p style={{
          fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: eyeFg, marginBottom: 18,
          display: 'inline-flex', alignItems: 'center', gap: 10,
        }}>
          {/* Small decorative line before the eyebrow text — restored from the
              original banner styling. Hidden when text is right-aligned so the
              line doesn't float in front of nothing. */}
          {settings.textAlign !== 'right' && (
            <span style={{ display: 'inline-block', width: 22, height: 1.5, background: eyeFg, borderRadius: 1 }} />
          )}
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 'clamp(1.9rem, 3.4vw, 2.9rem)', lineHeight: 1.06,
          color: fg, letterSpacing: '-0.028em', marginBottom: 18,
          textShadow: titleShadow,
        }}>{titleJsx}</h2>
      )}
      {subtitle && (
        <p style={{
          fontSize: '1rem', lineHeight: 1.6, color: subFg,
          marginBottom: 30, maxWidth: 460,
          textShadow: subShadow,
          ...(settings.textAlign === 'center' && { marginLeft: 'auto', marginRight: 'auto' }),
        }}>{subtitle}</p>
      )}
      <BannerCta style={settings.ctaStyle} label={ctaLabel} link={ctaLink} isLight={isLight} />
    </div>
  );

  const image = imgUrl ? (
    <img src={imgUrl} alt="Banner" loading="lazy" className="banner-img-tag"
      style={{ width: '100%', height: '100%', objectFit: 'cover',
        objectPosition: settings.imageFocal || 'center',
        opacity: settings.imageOpacity ?? 1,
        display: 'block',
        transition: 'transform 0.8s ease-out',
      }} />
  ) : (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--ink) 0%, var(--accent) 100%)' }} />
  );

  // Scoped hover zoom + entrance animation. Applied via a unique class so it
  // doesn't bleed into the rest of the page.
  const hoverStyles = (
    <style>{`
      .bs-banner:hover .banner-img-tag { transform: scale(1.04); }
    `}</style>
  );

  const wrap = { margin, borderRadius: radius, overflow: 'hidden', position: 'relative', minHeight: minH };

  // ── overlay & fullbleed: image as full background, content on top
  if (layout === 'overlay' || layout === 'fullbleed') {
    return (
      <div ref={bannerRef} className="bs-banner" style={{ ...wrap, background: 'var(--ink)' }}>
        {hoverStyles}
        <div style={{ position: 'absolute', inset: 0 }}>{image}</div>
        {scrimBg && <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: scrimBg }} />}
        <div style={{
          position: 'relative', zIndex: 2,
          minHeight: minH, padding: pad,
          display: 'flex', flexDirection: 'column',
          justifyContent: alignV, alignItems: alignH,
        }}>
          {content}
        </div>
      </div>
    );
  }

  // ── stacked: image and content stacked vertically; `imagePosition` controls
  // which is on top. (Previously this conflated with `verticalAlign` which was
  // confusing — now they're separate knobs.)
  if (layout === 'stacked') {
    const imagePos = settings.imagePosition === 'bottom' ? 'bottom' : 'top';
    const imageBlock = (
      <div style={{ width: '100%', height: Math.max(240, Math.round(minH * 0.55)), overflow: 'hidden' }}>{image}</div>
    );
    const contentBlock = (
      <div style={{
        padding: pad,
        display: 'flex', flexDirection: 'column', alignItems: alignH,
        // verticalAlign here drives content position WITHIN the content block
        // when it has extra height; centered & spacious-padding pairs nicely.
        justifyContent: alignV,
      }}>
        {content}
      </div>
    );
    return (
      <div ref={bannerRef} className="bs-banner" style={{ ...wrap, background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 'unset' }}>
        {hoverStyles}
        {imagePos === 'bottom' ? <>{contentBlock}{imageBlock}</> : <>{imageBlock}{contentBlock}</>}
      </div>
    );
  }

  // ── split: side-by-side content + image. Restored the subtle gradient on the
  // image side that fades into the content side — tied the two halves together
  // visually and was missing from the v1 rewrite.
  const imageLeft = settings.imagePosition === 'left';
  const fadeDirection = imageLeft ? 'left' : 'right';
  const contentBg = isLight ? 'var(--ink)' : 'var(--surface)';
  return (
    <div ref={bannerRef} className="bs-banner" style={{
      ...wrap, background: contentBg,
      display: 'grid', gridTemplateColumns: '1fr 1fr',
    }}>
      {hoverStyles}
      <div style={{
        order: imageLeft ? 2 : 1,
        padding: pad,
        display: 'flex', flexDirection: 'column',
        justifyContent: alignV, alignItems: alignH,
        minHeight: minH,
        background: contentBg,
        position: 'relative', zIndex: 1,
      }}>
        {content}
      </div>
      <div style={{ order: imageLeft ? 1 : 2, position: 'relative', overflow: 'hidden', minHeight: minH }}>
        {image}
        {/* Soft gradient bridging the image side into the content side. */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(to ${fadeDirection}, ${contentBg} 0%, transparent 35%)`,
        }} />
      </div>
    </div>
  );
}
