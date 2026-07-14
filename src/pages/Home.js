import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import GroupBuyCard from '../components/GroupBuyCard';
import { apiFetch } from '../utils/api';
import { useCategories } from '../utils/categories';

// Paste your first hero Cloudinary URL here so it shows immediately on load
const HERO_FALLBACK_IMAGE = '';

// Category list is now fetched dynamically via `useCategories` — see
// CategoryStrip below. The hook auto-falls back to a hardcoded list if the
// backend is unreachable, so this file no longer needs the local constant.

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

/* Append a #products / #group-buys anchor to internal links so the destination
   page scrolls past admin-built blocks and lands on its catalog grid. Skipped
   when the link already has an explicit hash or points outside those pages. */
function withCatalogAnchor(link) {
  if (!link) return link;
  if (link.includes('#')) return link;
  if (link.startsWith('/products'))   return `${link}#products`;
  if (link.startsWith('/group-buys')) return `${link}#group-buys`;
  return link;
}

/* Shared section header. `centered=true` stacks eyebrow → title → subtitle on
   the centerline and pulls view-all out (renders SectionFooter below content
   instead). `centered=false` keeps the classic title-left / view-all-right row. */
/* Renders the section's view-all/CTA in the chosen style. When `cta.style`
   is undefined or 'link', falls back to the legacy plain text-link so older
   blocks (no admin choice) keep their look. Otherwise routes through the
   shared renderSectionCta so the button matches Hero/Banner buttons. */
function renderViewAllNode(viewAllLink, cta) {
  if (!viewAllLink) return null;
  const label = (cta?.label && cta.label.trim()) || 'View all';
  const style = cta?.style || 'link';
  if (style === 'link' || !style) {
    return (
      <Link to={withCatalogAnchor(viewAllLink)} className="section-link">
        {label} →
      </Link>
    );
  }
  return renderSectionCta(
    { label, link: withCatalogAnchor(viewAllLink), style, size: cta.size, icon: cta.icon, bg: cta.bg, fg: cta.fg },
    { isLight: false, fallbackStyle: style },
  );
}

function SectionHeader({ eyebrow, title, subtitle, viewAllLink, viewAllCta, centered }) {
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
      {renderViewAllNode(viewAllLink, viewAllCta)}
    </div>
  );
}

function SectionFooter({ viewAllLink, viewAllCta, label = 'View all' }) {
  if (!viewAllLink) return null;
  // Honor the per-block CTA when provided; otherwise behave like the legacy
  // centered text-link footer.
  const cta = viewAllCta?.style && viewAllCta.style !== 'link'
    ? { ...viewAllCta, label: viewAllCta.label || label }
    : null;
  if (cta) {
    return (
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        {renderViewAllNode(viewAllLink, cta)}
      </div>
    );
  }
  return (
    <div style={{ textAlign: 'center', marginTop: '40px' }}>
      <Link to={withCatalogAnchor(viewAllLink)} className="section-link" style={{ fontSize: '0.95rem' }}>
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
      <HeroCarousel
        isFirst={isFirst}
        data={data}
        images={(data.images || []).map(i => i.url).filter(Boolean)}
        fallbackImage={HERO_FALLBACK_IMAGE}
        primaryCta={{
          label: data.primaryCtaLabel || 'Shop Now',
          link:  data.primaryCtaLink  || '/products',
          style: data.primaryCtaStyle || 'filled',
          size:  data.primaryCtaSize  || 'md',
          icon:  data.primaryCtaIcon,
          bg:    data.primaryCtaBg,
          fg:    data.primaryCtaFg,
        }}
        secondaryCta={{
          label: data.secondaryCtaLabel || '',
          link:  data.secondaryCtaLink  || '',
          style: data.secondaryCtaStyle || 'outline',
          size:  data.secondaryCtaSize  || 'md',
          icon:  data.secondaryCtaIcon,
          bg:    data.secondaryCtaBg,
          fg:    data.secondaryCtaFg,
        }}
      />
    );
  }

  let content = null;
  switch (block.type) {
    case 'categoryStrip':
      content = <CategoryStrip countByCategory={countByCategory} />;
      break;
    case 'categoriesGrid':
      content = <CategoriesGridBlock data={data} />;
      break;
    case 'catalog':
      // Position marker for the Shop / Group Buys live catalog grid. The
      // surrounding page (Products.js / GroupBuys.js) renders the actual
      // grid wherever this block sits in the list; here we render a small
      // placeholder so the admin preview still shows the chosen position.
      content = (
        <div style={{
          padding: '32px var(--page-pad)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-secondary)',
          color: 'var(--ink-muted)',
          textAlign: 'center',
          margin: '8px var(--page-pad)',
        }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', margin: '0 0 6px' }}>Catalog Grid</p>
          <p style={{ fontSize: '0.84rem', margin: 0 }}>Live product / group-buy listing renders here.</p>
        </div>
      );
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
    case 'customHtml':
      content = <CustomHtmlBlock data={data} adminMode={adminMode} />;
      break;
    default:
      return null;
  }

  const bg = blockBgStyle(data.bg);
  const isTinted = (data.bg && data.bg !== 'default');
  // Admin can disable the on-hover image scale per block. The class neutralizes
  // the descendant `transform` rules in globals.css (product cards, hero tiles,
  // banner images, etc.); no JS branching in the block components themselves.
  const wrapperClass = data.hoverZoom === false ? 'no-hover-zoom' : undefined;
  return (
    // `display: flow-root` prevents child margin-collapse from leaking the
    // background tint past adjacent blocks. Only enabled when actually tinted.
    <div className={wrapperClass} style={{ ...bg, display: isTinted ? 'flow-root' : undefined }}>
      <Reveal disabled={adminMode}>{content}</Reveal>
    </div>
  );
}


/* ─── Custom HTML Block ───────────────────────────────────────────────
   Renders admin-pasted markup as-is, full page width. Because it's injected via
   innerHTML, <script> tags are inert (won't execute), so this can't run JS — but
   markup, inline styles, and images render. Admin-authored content only. */
function CustomHtmlBlock({ data, adminMode }) {
  const html = (data.html || '').trim();
  if (!html) {
    // Empty state is shown only in the admin editor so the section stays selectable.
    if (!adminMode) return null;
    return (
      <div style={{ padding: '48px var(--page-pad)', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', margin: '8px var(--page-pad)', background: 'var(--bg-secondary)', color: 'var(--ink-muted)' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', margin: '0 0 6px' }}>Custom HTML</p>
        <p style={{ fontSize: '0.84rem', margin: 0 }}>Empty — paste your HTML in the editor.</p>
      </div>
    );
  }
  return <div className="custom-html-block" dangerouslySetInnerHTML={{ __html: html }} />;
}


/* ─── Category Strip (extracted unchanged) ─── */
// Apple-style category strip: centered typography only, no dividers, no
// count badges, no hover arrows. Whitespace and a subtle color hover do the
// work. On phones the row turns into a smoothly scrolling rail with faded
// edges so partial items at the boundary look intentional, not cut off.
function CategoryStrip({ countByCategory }) {
  // countByCategory kept in signature for backward-compat with the dispatcher,
  // but intentionally unused — counts cluttered the visual.
  void countByCategory;
  // List comes from the API now — admin-created categories appear here
  // automatically. Falls back to a hardcoded set when the backend is offline.
  const { categories } = useCategories();
  return (
    <nav className="cat-strip" aria-label="Shop by category">
      <div className="cat-strip-inner">
        {/* Hash anchor on every link so the destination page jumps to the
            catalog grid, skipping admin-built blocks above it. */}
        <Link to="/products#products" className="cat-link cat-link-all animate-fadeUp">
          All
        </Link>
        {categories.map((cat, i) => (
          <Link
            key={cat.slug}
            to={`/category/${cat.slug}`}
            className="cat-link animate-fadeUp"
            style={{ animationDelay: `${(i + 1) * 0.05}s` }}
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}


/* ─── Categories Grid Block ────────────────────────────────────────────
   Image-led tiles linking to each /category/:slug page. When
   `categorySlugs` is non-empty the admin's chosen order is honored; an
   empty list shows every known category in its global sortOrder.

   Each tile uses the category's cover image (or a soft accent fallback if
   no image is set yet), with the name laid over the bottom of the image. */
function CategoriesGridBlock({ data }) {
  const { categories } = useCategories();
  const cols = [2, 3, 4, 5].includes(data?.columns) ? data.columns : 4;
  const align = data?.align === 'center' ? 'center' : 'left';
  const pinned = Array.isArray(data?.categorySlugs) ? data.categorySlugs : [];

  // Build the rendered list. Pinned slugs preserve admin order; entries
  // that no longer have a record are dropped silently (avoid 404s).
  const list = pinned.length > 0
    ? pinned.map(slug => categories.find(c => c.slug === slug)).filter(Boolean)
    : categories;

  if (list.length === 0) return null;

  return (
    <section style={{ padding: '56px var(--page-pad) 64px' }}>
      {(data?.eyebrow || data?.title || data?.subtitle) && (
        <div style={{ marginBottom: 28, textAlign: align }}>
          {data.eyebrow && (
            <p style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8, fontWeight: 600 }}>{data.eyebrow}</p>
          )}
          {data.title && (
            <h2 className="section-title" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', letterSpacing: '-0.02em', margin: 0 }}>
              {data.title}
            </h2>
          )}
          {data.subtitle && (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.95rem', marginTop: 8, maxWidth: 640, marginLeft: align === 'center' ? 'auto' : 0, marginRight: align === 'center' ? 'auto' : 0 }}>{data.subtitle}</p>
          )}
        </div>
      )}
      {/* Optional admin-set CTA — sits between the header and the grid so it
          works regardless of header alignment. */}
      {data?.cta?.label && data?.cta?.link && (
        <div style={{ display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start', marginBottom: 20 }}>
          {renderSectionCta(
            { label: data.cta.label, link: data.cta.link, style: data.cta.style, size: data.cta.size, icon: data.cta.icon, bg: data.cta.bg, fg: data.cta.fg },
            { isLight: false, fallbackStyle: 'outline' },
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }} className="cg-grid">
        {list.map(cat => (
          <Link key={cat.slug} to={`/category/${cat.slug}`} className="cg-tile" style={{
            position: 'relative', display: 'block', textDecoration: 'none',
            aspectRatio: '4/5', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
            background: cat.image?.url ? 'var(--ink)' : 'var(--bg-secondary)',
            color: '#fff',
          }}>
            {cat.image?.url ? (
              <img src={cat.image.url} alt={cat.name} style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', transition: 'transform 0.4s ease',
              }} />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'DM Serif Display', serif", fontSize: '3rem', color: 'var(--ink-faint)',
              }}>{cat.name?.[0]?.toUpperCase()}</div>
            )}
            <div style={{
              position: 'absolute', inset: 0,
              background: cat.image?.url
                ? 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)'
                : 'transparent',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              padding: '14px 16px',
              color: cat.image?.url ? '#fff' : 'var(--ink)',
            }}>
              <p style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 'clamp(1rem, 1.6vw, 1.3rem)', letterSpacing: '-0.01em',
                margin: 0, lineHeight: 1.1,
              }}>{cat.name}</p>
            </div>
          </Link>
        ))}
      </div>
      <style>{`
        .cg-tile { isolation: isolate; }
        .cg-tile:hover img { transform: scale(1.04); }
        @media (max-width: 760px) {
          .cg-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
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
  // Smart default: if the block is filtered to a category, the View-All link
  // takes the user to that same category in the shop instead of the generic
  // /products page. `hideViewAll` lets admin suppress the link entirely.
  const defaultVA = data.category ? `/products?cat=${data.category}` : '/products';
  const viewAll = data.hideViewAll ? null : (data.viewAllLink || defaultVA);

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
        viewAllCta={data.viewAllCta}
        centered={centered}
      />

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {[...Array(6)].map((_, i) => <Skeleton key={i} style={{ height: 360 }} />)}
        </div>
      ) : layoutMode === 'grid' ? (
        <div className="collection-grid" style={{
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
      {centered && <SectionFooter viewAllLink={viewAll} viewAllCta={data.viewAllCta} />}
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
  const viewAll = data.hideViewAll ? null : (data.viewAllLink || '/group-buys');
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
    <div className="collection-grid" style={{
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
        viewAllCta={data.viewAllCta}
        centered={centered}
      />
      {renderLayout === 'carousel' ? cardsCarousel : (renderLayout === 'grid' ? cardsGrid : (
        <div className="home-card-grid">
          {filtered.map(gb => <GroupBuyCard key={gb._id} gb={gb} presentation={presentation} />)}
        </div>
      ))}
      {centered && <SectionFooter viewAllLink={viewAll} viewAllCta={data.viewAllCta} />}
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
     * triple — 3 equal tiles side-by-side */
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
    // triple: 3 equal tiles side-by-side
    gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap };
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
        @media (max-width: 960px) {
          .ph-grid--triple { grid-template-columns: 1fr 1fr !important; }
        }
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
            viewAllLink={headerCentered ? null : (data.viewAllLink || null)}
            viewAllCta={data.viewAllCta}
            centered={headerCentered}
          />
        </div>
      )}
      <div className={`ph-grid${layout === 'triple' ? ' ph-grid--triple' : ''}`} style={{ ...gridStyle, margin: sectionMargin }}>
        {tiles.map((t, i) => {
          // Admin placeholder tile when no product picked yet — shows the layout
          // structure with a "Pick a product" prompt so the block is visible
          // and clickable in the live-preview editor.
          if (!t.product) {
            return (
              <ProductHeroPlaceholder
                key={`ph-empty-${i}`}
                index={i}
                height={tileHeight}
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
              tileHeight={tileHeight}
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

// Unicode trailing-icon glyphs for CTAs. Kept tiny on purpose — they ride
// next to the label as a visual cue. '' means no icon; the renderer also
// falls back to '→' for the link variant when the field is undefined so
// pre-existing link CTAs keep their arrow without a data migration.
const CTA_ICON_GLYPHS = {
  'arrow-right':    '→',
  'arrow-up-right': '↗',
  'chevron-right':  '›',
  'plus':           '+',
};
// Size → padding / font-size maps. Pill sizes apply to filled+outline;
// inline sizes apply to link+text (no padding, just type scale).
const CTA_PILL_PAD  = { sm: '8px 18px',  md: '12px 24px', lg: '16px 32px' };
const CTA_PILL_FONT = { sm: '0.82rem',   md: '0.92rem',   lg: '1.05rem'   };
const CTA_INLINE_FONT = { sm: '0.86rem', md: '1rem',      lg: '1.15rem'   };

function resolveCtaIcon(rawIcon, style) {
  // Explicit value wins. Undefined + link → backward-compat arrow.
  if (rawIcon === undefined) return style === 'link' ? '→' : '';
  return CTA_ICON_GLYPHS[rawIcon] || '';
}

/* Shared CTA renderer used by every section-level CTA (hero, product hero,
   banner, etc.). One renderer = one consistent visual across the site.

   `cta` is a normalized shape: { label, link, style, size, icon, bg, fg }.
   Style values are link / filled / outline / text (CTA_STYLE_OPTIONS in the
   admin editor). Legacy banner names (ghost, text-arrow, none) are migrated
   here so older docs render without a schema change.

   `opts.isLight`         — true when the CTA sits on a dark backdrop (default colors invert)
   `opts.fallbackStyle`   — used when cta.style is undefined
   `opts.asElement`       — 'link' wraps in <Link>; 'span' renders inline (when parent is already a link) */
function renderSectionCta(cta, opts = {}) {
  const { isLight = true, fallbackStyle = 'filled', asElement = 'link' } = opts;
  if (!cta || !cta.label) return null;

  let style = cta.style || fallbackStyle;
  if (style === 'ghost')      style = 'outline';
  if (style === 'text-arrow') style = 'link';
  if (style === 'none')       return null;

  const size = cta.size || 'md';
  const bg = cta.bg || '';
  const customFg = cta.fg || '';
  const iconGlyph = resolveCtaIcon(cta.icon, style);
  const iconNode = iconGlyph ? <span aria-hidden="true">{iconGlyph}</span> : null;

  // `isLight` here means "the surrounding section uses LIGHT text" — i.e. its
  // bg is dark. Buttons need to sit visually OPPOSITE the section bg.
  //
  // Previously this used `var(--ink)` for the dark side of the pair, but
  // --ink flips with the site theme (cream in dark mode), so a filled button
  // ended up with cream bg + white text or white bg + cream text — both
  // invisible. Hardcoding the dark side as #1a1a18 keeps the button always
  // a black/white pair, regardless of dark/light site theme.
  const DARK_INK = '#1a1a18';
  const WHITE    = '#fff';

  const autoFg = isLight ? WHITE : DARK_INK;
  const fg = customFg || autoFg;

  let styleObj;
  if (style === 'filled') {
    const fillBg = bg || (isLight ? WHITE : DARK_INK);
    const fillFg = customFg || (isLight ? DARK_INK : WHITE);
    styleObj = {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: CTA_PILL_FONT[size], fontWeight: 500,
      padding: CTA_PILL_PAD[size], borderRadius: 999,
      background: fillBg, color: fillFg, textDecoration: 'none',
    };
  } else if (style === 'outline') {
    const borderColor = customFg || (isLight ? 'rgba(255,255,255,0.7)' : DARK_INK);
    styleObj = {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: CTA_PILL_FONT[size], fontWeight: 500,
      padding: CTA_PILL_PAD[size], borderRadius: 999,
      background: bg || 'transparent',
      border: `1px solid ${borderColor}`,
      color: fg, textDecoration: 'none',
    };
  } else if (style === 'text') {
    styleObj = {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: CTA_INLINE_FONT[size], fontWeight: 500,
      color: fg, textDecoration: 'none',
    };
  } else {
    const underlineColor = customFg || (isLight ? 'rgba(255,255,255,0.55)' : DARK_INK);
    styleObj = {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: CTA_INLINE_FONT[size], fontWeight: 500,
      color: fg, textDecoration: 'none',
      borderBottom: `1px solid ${underlineColor}`,
      paddingBottom: 3,
    };
  }

  if (asElement === 'span') {
    return <span className="section-cta" style={styleObj}>{cta.label}{iconNode}</span>;
  }
  return <Link to={cta.link} className="section-cta" style={styleObj}>{cta.label}{iconNode}</Link>;
}

// Thin shim — kept so existing call sites in ProductHeroTile don't churn. The
// tile is already a <Link>, so render as a span (no nested anchor).
function renderHeroTileCta(label, tile, isLight) {
  return renderSectionCta(
    { label, style: tile.ctaStyle, size: tile.ctaSize, icon: tile.ctaIcon, bg: tile.ctaBg, fg: tile.ctaFg },
    { isLight, fallbackStyle: 'link', asElement: 'span' },
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

  // Hero tile text is always LIGHT (white). The dark-text option was removed
  // because it kept clashing with dark product imagery — matching the main
  // HeroCarousel keeps the look consistent across the page. The admin
  // textColor field is ignored here intentionally; CTAs still flow through
  // renderSectionCta with isLight=true so the buttons match.
  void textColor;
  const isLight = true;
  const fg    = '#fff';
  const subFg = 'rgba(255,255,255,0.78)';
  const eyeFg = 'rgba(255,255,255,0.85)';
  const isOverlayMode = imageStyle !== 'stacked-below' && imageStyle !== 'stacked-above';
  const titleShadow = isOverlayMode ? '0 2px 18px rgba(0,0,0,0.45)' : 'none';
  const subShadow   = isOverlayMode ? '0 1px 10px rgba(0,0,0,0.4)' : 'none';
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
          color: eyeFg, marginBottom: 16, textShadow: subShadow,
        }}>{eyebrow}</p>
      )}
      <h3 style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: 'clamp(2rem, 3.6vw, 3.4rem)', lineHeight: 1.05,
        letterSpacing: '-0.03em', marginBottom: 14, color: fg,
        textShadow: titleShadow,
      }}>{name}</h3>
      {subtitle && (
        <p style={{
          fontSize: '1.05rem', lineHeight: 1.5, color: subFg,
          marginBottom: 26, maxWidth: 420, textShadow: subShadow,
          ...(textAlign === 'center' && { marginLeft: 'auto', marginRight: 'auto' }),
        }}>{subtitle}</p>
      )}
      {ctaLabel && renderHeroTileCta(ctaLabel, tile, isLight)}
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
  const wrapRef = useRef(null);
  const [repeatCount, setRepeatCount] = useState(2);
  const [duration, setDuration] = useState(20);

  // Width of one canonical "set" of items in px — used both as the animation
  // distance (we translate by exactly one set) and to decide how many sets to
  // render so the visible row never runs out of cards.
  const singleSetWidth = items.length > 0
    ? items.length * cardWidth + items.length * gap
    : 0;

  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current || singleSetWidth === 0) return;
      const viewport = wrapRef.current.clientWidth;
      // Need at least: (one set wider than viewport) + 1 buffer set so the
      // visible row always has cards even at the wrap-around moment.
      const setsForViewport = Math.ceil(viewport / singleSetWidth);
      const needed = Math.max(2, setsForViewport + 1);
      setRepeatCount(needed);

      const safeSpeed = Math.max(5, speed);
      setDuration(Math.max(6, singleSetWidth / safeSpeed));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    return () => { if (ro) ro.disconnect(); };
  }, [items.length, speed, singleSetWidth]);

  if (!items || items.length === 0) return null;

  // Build `repeatCount` back-to-back copies. Only the first set is exposed to
  // assistive tech; the rest are visual padding for the seamless loop.
  const cells = [];
  for (let r = 0; r < repeatCount; r++) {
    items.forEach((item, i) => {
      cells.push(
        <div key={`${r}-${i}`} className="marquee-cell"
          style={{ width: cardWidth, flexShrink: 0 }}
          aria-hidden={r > 0 ? 'true' : undefined}>
          {renderItem(item, i)}
        </div>
      );
    });
  }

  return (
    <div ref={wrapRef} className="marquee-wrap">
      <div className="marquee-track" style={{
        gap: `${gap}px`,
        animationDuration: `${duration}s`,
        // Move by exactly one set's width — gives a perfectly seamless wrap
        // because cell `n` of set `r+1` is sitting where cell `n` of set `r`
        // started.
        '--marquee-distance': `-${singleSetWidth}px`,
      }}>
        {cells}
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
          to   { transform: translateX(var(--marquee-distance)); }
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
    if (layout === 'hero') {
      // Map the first N pinned items (N from heroVariant) into hero tiles,
      // linking each to its product / group-buy detail page.
      const productById = new Map(products.map(p => [String(p._id), p]));
      const gbById = new Map(groupBuys.map(g => [String(g._id), g]));
      const refs = Array.isArray(data.mixedItems) ? data.mixedItems : [];
      const resolved = refs.map(ref => {
        if (!ref || !ref.id) return null;
        if (ref.type === 'group-buy') {
          const gb = gbById.get(String(ref.id));
          return gb ? { type: 'group-buy', data: gb } : null;
        }
        const p = productById.get(String(ref.id));
        return p ? { type: 'product', data: p } : null;
      }).filter(Boolean);
      const variant = data.heroVariant || 'pair';
      const max = variant === 'single' ? 1 : variant === 'triple' ? 3 : 2;
      const items = resolved.slice(0, max);
      return (
        <GenericHeroRow
          data={data}
          items={items}
          itemToTile={item => item.type === 'group-buy'
            ? {
                images: item.data.images || [],
                name: item.data.name,
                category: item.data.kind || 'group-buy',
                detailLink: `/group-buys/${item.data._id}`,
              }
            : {
                images: item.data.images || [],
                name: item.data.name,
                category: item.data.category,
                detailLink: `/products/${item.data._id}`,
              }
          }
          adminMode={adminMode}
          emptyLabel="Mixed Hero — pin items to fill the tiles"
        />
      );
    }
    return <MixedCollectionBlock data={data} layout={layout} products={products} groupBuys={groupBuys} />;
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
  // Smart default by source: group-buy collections link to /group-buys,
  // product collections respect data.category when set, otherwise /products.
  const defaultVA = source === 'group-buys'
    ? '/group-buys'
    : (data.category ? `/products?cat=${data.category}` : '/products');
  const viewAll = data.hideViewAll ? null : (data.viewAllLink || defaultVA);
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
          viewAllCta={data.viewAllCta}
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
      {centered && <SectionFooter viewAllLink={viewAll} viewAllCta={data.viewAllCta} />}
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
  const viewAll = data.hideViewAll ? null : (data.viewAllLink || '/products');
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
        {centered && <SectionFooter viewAllLink={viewAll} viewAllCta={data.viewAllCta} />}
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
          viewAllCta={data.viewAllCta}
          centered={centered}
        />
        <div className="collection-grid" style={{
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
        {centered && <SectionFooter viewAllLink={viewAll} viewAllCta={data.viewAllCta} />}
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
        viewAllCta={data.viewAllCta}
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
      {centered && <SectionFooter viewAllLink={viewAll} viewAllCta={data.viewAllCta} />}
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
    gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap };
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
        @media (max-width: 960px) {
          .ph-grid--triple { grid-template-columns: 1fr 1fr !important; }
        }
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
            viewAllLink={headerCentered ? null : (data.viewAllLink || null)}
            viewAllCta={data.viewAllCta}
            centered={headerCentered}
          />
        </div>
      )}
      <div className={`ph-grid${variant === 'triple' ? ' ph-grid--triple' : ''}`} style={{ ...gridStyle, margin: sectionMargin }}>
        {renderTiles.map((t, i) => {
          if (!t.filled) {
            return <ProductHeroPlaceholder key={`empty-${i}`} index={i} height={tileHeight} />;
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
// Thin shim — delegates to renderSectionCta so the hero CTAs share rendering
// with banner / product-hero CTAs. The hero sits on a dark image backdrop,
// so isLight defaults to true unless the caller overrides.
function renderHeroBlockCta(cta, fallbackStyle, isLight = true) {
  return renderSectionCta(cta, { isLight, fallbackStyle });
}

// Hero height presets. `standard` matches the legacy hardcoded value so old
// hero docs (no height field) keep their original size after rollout.
const HERO_HEIGHT_MAP = {
  compact:  { height: '60vh', minHeight: '420px' },
  standard: { height: 'calc(100vh - var(--nav-h))', minHeight: '580px' },
  tall:     { height: 'calc(110vh - var(--nav-h))', minHeight: '720px' },
  full:     { height: '100vh', minHeight: '580px' },
};

// Build a scrim CSS gradient. Shared shape: dark from one edge, fading to
// transparent. `none` returns null (no overlay rendered).
function buildHeroScrim(strength, dir, color) {
  if (!strength || dir === 'none') return null;
  const c = color || '#000';
  // Quick rgba builder for hex (defensive — falls back to using the color
  // string verbatim and stacking opacity via the gradient stops).
  const cap = `${c}${typeof c === 'string' && c.startsWith('#') && c.length === 7 ? Math.round(strength * 255).toString(16).padStart(2, '0') : ''}`;
  // For non-hex / shorthand colors we just blend via rgba style; CSS handles it.
  const tint = c.startsWith('#') && c.length === 7
    ? cap
    : `color-mix(in srgb, ${c} ${Math.round(strength * 100)}%, transparent)`;
  switch (dir) {
    case 'top':    return `linear-gradient(to bottom, ${tint} 0%, transparent 75%)`;
    case 'bottom': return `linear-gradient(to top,    ${tint} 0%, transparent 75%)`;
    case 'left':   return `linear-gradient(to right,  ${tint} 0%, transparent 65%)`;
    case 'right':  return `linear-gradient(to left,   ${tint} 0%, transparent 65%)`;
    case 'radial': return `radial-gradient(circle at center, transparent 0%, ${tint} 95%)`;
    case 'full':
    default:       return tint;
  }
}

function HeroCarousel({ isFirst, data, images, fallbackImage, primaryCta, secondaryCta }) {
  const [current, setCurrent] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const timerRef = useRef(null);

  // Resolved layout knobs — each falls back to the legacy default so old docs
  // render identically until the admin starts customizing.
  // imageOnly forces non-gallery layouts to 'overlay' so split/stacked/minimal
  // don't leave an empty content column behind when their text is hidden.
  const rawLayout         = data?.layout || 'overlay';
  const layout            = (data?.imageOnly && rawLayout !== 'gallery') ? 'overlay' : rawLayout;
  const heightKey         = data?.height || 'standard';
  const heightStyles      = HERO_HEIGHT_MAP[heightKey] || HERO_HEIGHT_MAP.standard;
  const contentAlignH     = data?.contentAlignH || 'left';
  const contentAlignV     = data?.contentAlignV || 'bottom';
  const textColor         = data?.textColor || 'light';
  const contentMaxWidth   = Number(data?.contentMaxWidth) || 660;
  const scrimStrength     = data?.scrimStrength ?? 0.4;
  const scrimDir          = data?.scrimDir || 'bottom';
  const scrimColor        = data?.scrimColor || '#000';
  const imagePosition     = data?.imagePosition || 'center';
  const bgColor           = data?.bgColor || '';
  // imageOnly mode: hide eyebrow / title / sub / CTAs and treat the hero as
  // a pure image. When primary CTA has a link, the whole hero becomes a
  // single anchor (admin still gets a clickthrough without visible text).
  const imageOnly         = !!data?.imageOnly;
  const autoAdvance       = data?.autoAdvance !== false;
  const interval          = (Number(data?.interval) || 5) * 1000;
  const showDots          = data?.showDots !== false;
  const showScrollHint    = data?.showScrollIndicator !== false;
  const splitImageSide    = data?.splitImageSide || 'right';
  const splitImageRatio   = Math.max(0.2, Math.min(0.8, Number(data?.splitImageRatio) || 0.5));
  const stackedImageSide  = data?.stackedImageSide || 'below';
  const stackedImageRatio = Math.max(0.2, Math.min(0.9, Number(data?.stackedImageRatio) || 0.55));
  const galleryHeight     = Math.max(160, Math.min(640, Number(data?.galleryImageHeight) || 360));
  const gallerySpeed      = Math.max(5,   Math.min(200, Number(data?.gallerySpeed) || 40));
  const galleryGap        = Math.max(0,   Math.min(60,  Number(data?.galleryGap) ?? 6));
  const eyebrow           = data?.eyebrow || '';
  const title             = data?.title || '';
  const subtitle          = data?.subtitle || '';

  const displayImages = images.length > 0 ? images : (fallbackImage ? [fallbackImage] : []);
  const hasImages = displayImages.length > 0;
  // Hero text is always LIGHT (white). Dark text was removed — it clashed
  // with most hero imagery and the textColor admin option is now ignored
  // for consistency with ProductHeroTile.
  void textColor;
  const isLightText = true;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!autoAdvance || displayImages.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % displayImages.length);
    }, interval);
  }, [displayImages.length, autoAdvance, interval]);

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

  // ── Pre-compute pieces shared by every layout ──
  const scrimGradient = buildHeroScrim(scrimStrength, scrimDir, scrimColor);
  const vAlign = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[contentAlignV] || 'flex-end';
  const hAlign = { left: 'flex-start', center: 'center', right: 'flex-end' }[contentAlignH] || 'flex-start';
  // Hardcode the dark-text values so they don't flip when the site theme
  // toggles to dark mode. The hero image is theme-independent; if the admin
  // chose dark text, it must stay dark over that image regardless of theme.
  const titleColor   = '#fff';
  const subColor     = 'rgba(255,255,255,0.6)';
  const eyebrowColor = 'rgba(255,255,255,0.55)';
  // Subtle dark halo so the always-white text stays readable on light images.
  // Only applied in overlay/gallery layouts where text sits on top of the image.
  const isOverlayLayout = layout === 'overlay' || layout === 'gallery';
  const titleShadow = isOverlayLayout ? '0 2px 24px rgba(0,0,0,0.45)' : 'none';
  const subShadow   = isOverlayLayout ? '0 1px 14px rgba(0,0,0,0.45)' : 'none';
  const sectionMargin = isFirst ? { marginTop: 'var(--nav-h)' } : null;

  // Skip the text block entirely in imageOnly mode. Returning null lets each
  // layout below collapse its content column instead of rendering an empty
  // div that would steal grid/flex space.
  const contentBlock = imageOnly ? null : (
    <div className="hero-text" style={{ maxWidth: contentMaxWidth, textAlign: contentAlignH }}>
      {eyebrow && (
        <p className="hero-eyebrow animate-fadeUp" style={{ color: eyebrowColor, textShadow: subShadow }}>{eyebrow}</p>
      )}
      <h1 className="hero-title animate-fadeUp" style={{ color: titleColor, animationDelay: '0.15s', textShadow: titleShadow }}>
        {parseItalic(title)}
      </h1>
      {subtitle && (
        <p className="hero-sub animate-fadeUp" style={{ color: subColor, animationDelay: '0.3s', textShadow: subShadow }}>
          {subtitle}
        </p>
      )}
      {(primaryCta.label || secondaryCta.label) && (
        <div className="hero-cta animate-fadeUp" style={{ animationDelay: '0.45s', justifyContent: hAlign }}>
          {primaryCta.label && renderHeroBlockCta(primaryCta, 'filled', isLightText)}
          {secondaryCta.label && renderHeroBlockCta(secondaryCta, 'outline', isLightText)}
        </div>
      )}
    </div>
  );

  // When the hero is image-only AND the admin set a primary CTA link, the
  // entire section becomes a single clickthrough — keeps the image actionable
  // without showing button chrome. Falls back to a plain <section> otherwise.
  const wrapClickable = (content) => (imageOnly && primaryCta.link
    ? <Link to={primaryCta.link} aria-label={primaryCta.label || title || 'Hero'} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>{content}</Link>
    : content
  );

  // Carousel images + fallback. Reused by every layout that has an image area.
  const imageStack = (
    <>
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
          style={{ objectPosition: imagePosition }}
        />
      ))}
      <div className="hero-slide-fallback" style={bgColor ? { background: bgColor } : undefined} />
    </>
  );

  const dots = showDots && displayImages.length > 1 && (
    <div className="hero-dots">
      {displayImages.map((_, i) => (
        <button key={i} className={`hero-dot ${i === current ? 'active' : ''}`}
          onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`} />
      ))}
    </div>
  );

  const scrollHint = showScrollHint && !scrolled && (
    <div className="hero-scroll-indicator" aria-hidden="true">
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  );

  // ── GALLERY: content header on top, infinite marquee of featured images below ──
  if (layout === 'gallery') {
    // Each tile is 16:9-ish — wide enough to feel cinematic but tall enough
    // that smaller images don't get crushed.
    const tileWidth = Math.round(galleryHeight * 1.6);
    const galleryItems = hasImages ? displayImages : [];
    return wrapClickable(
      <section style={{
        ...sectionMargin,
        position: 'relative', overflow: 'hidden',
        background: bgColor || (isLightText ? 'var(--ink)' : 'var(--bg)'),
        display: 'flex', flexDirection: 'column',
        padding: imageOnly ? 0 : '60px 0 0',
      }}>
        {/* Skip the header band entirely in imageOnly mode so the marquee
            sits flush against the section edge. */}
        {!imageOnly && (
          <div style={{ padding: '0 var(--page-pad) 48px', display: 'flex', justifyContent: hAlign }}>
            {contentBlock}
          </div>
        )}
        {galleryItems.length > 0 && (
          <MarqueeRow
            items={galleryItems}
            renderItem={(src, i) => (
              <img src={src} alt={`Featured ${i + 1}`}
                style={{
                  width: '100%', height: galleryHeight,
                  objectFit: 'cover', objectPosition: imagePosition,
                  display: 'block',
                }} />
            )}
            speed={gallerySpeed}
            gap={galleryGap}
            cardWidth={tileWidth}
          />
        )}
      </section>
    );
  }

  // ── MINIMAL: no image, just typography on a solid background ──
  if (layout === 'minimal') {
    return (
      <section style={{
        ...heightStyles,
        ...sectionMargin,
        position: 'relative', overflow: 'hidden',
        background: bgColor || (isLightText ? 'var(--ink)' : 'var(--bg)'),
        display: 'flex', flexDirection: 'column', justifyContent: vAlign,
        padding: '60px var(--page-pad)',
      }}>
        <div style={{ display: 'flex', justifyContent: hAlign }}>{contentBlock}</div>
      </section>
    );
  }

  // ── SPLIT: two columns, image on one side, content on the other ──
  if (layout === 'split') {
    // Image column always gets `splitImageRatio` of the width; content gets the rest.
    const imageFr = splitImageRatio;
    const contentFr = 1 - splitImageRatio;
    const gridCols = splitImageSide === 'left'
      ? `${imageFr}fr ${contentFr}fr`
      : `${contentFr}fr ${imageFr}fr`;
    const imagePane = (
      <div className="hero-split-img" style={{ position: 'relative', overflow: 'hidden' }}>{imageStack}</div>
    );
    const contentPane = (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: hAlign,
        padding: '60px var(--page-pad)',
      }}>{contentBlock}</div>
    );
    return (
      <section style={{
        ...heightStyles,
        ...sectionMargin,
        position: 'relative', overflow: 'hidden',
        background: bgColor || (isLightText ? 'var(--ink)' : 'var(--bg)'),
        display: 'grid', gridTemplateColumns: gridCols,
      }} className="hero-split">
        {splitImageSide === 'left' ? <>{imagePane}{contentPane}</> : <>{contentPane}{imagePane}</>}
      </section>
    );
  }

  // ── STACKED: image and content as full-width horizontal bands ──
  if (layout === 'stacked') {
    const imageFlex = `0 0 ${stackedImageRatio * 100}%`;
    const imagePane = (
      <div style={{ position: 'relative', overflow: 'hidden', flex: imageFlex }}>{imageStack}</div>
    );
    const contentPane = (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: hAlign,
        padding: '40px var(--page-pad)',
      }}>{contentBlock}</div>
    );
    return (
      <section style={{
        ...heightStyles,
        ...sectionMargin,
        position: 'relative', overflow: 'hidden',
        background: bgColor || (isLightText ? 'var(--ink)' : 'var(--bg)'),
        display: 'flex', flexDirection: 'column',
      }}>
        {stackedImageSide === 'above' ? <>{imagePane}{contentPane}</> : <>{contentPane}{imagePane}</>}
      </section>
    );
  }

  // ── OVERLAY (default): full-bleed image with content overlaid + scrim ──
  // Pad only on the edge the content is anchored to so vertical align actually
  // shifts the block instead of being dragged off-center by a hardcoded 90px
  // bottom gap from the legacy .hero-content rule.
  const overlayPadTop    = contentAlignV === 'top'    ? 90 : 0;
  const overlayPadBottom = contentAlignV === 'bottom' ? 90 : 0;
  return wrapClickable(
    <section className="hero" style={{
      ...heightStyles,
      ...sectionMargin,
      justifyContent: vAlign,
      background: bgColor || undefined,
    }}>
      <div className="hero-bg">{imageStack}</div>
      {/* Skip scrim + content overlay in imageOnly mode — the scrim only
          existed to make text legible, and the content div is empty now. */}
      {!imageOnly && scrimGradient && (
        <div style={{ position: 'absolute', inset: 0, background: scrimGradient, zIndex: 1, pointerEvents: 'none' }} />
      )}
      {!imageOnly && (
        <div className="hero-content" style={{
          display: 'flex', justifyContent: hAlign,
          padding: `${overlayPadTop}px var(--page-pad) ${overlayPadBottom}px`,
        }}>
          {contentBlock}
        </div>
      )}
      {dots}
      {!imageOnly && scrollHint}
    </section>
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
  fullbleed: { textAlign: 'left',   verticalAlign: 'bottom', height: 'xtall',  scrim: 0.5,   textColor: 'light', padding: 'spacious', cornerRadius: 'none', imageOpacity: 1, ctaStyle: 'outline', fullBleed: true },
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

// Thin shim — delegates to renderSectionCta so banner CTAs share rendering
// with hero / product-hero CTAs. Legacy banner style values (ghost,
// text-arrow, none) migrate inside renderSectionCta.
function BannerCta({ style, size, icon, bg, fg, label, link, isLight }) {
  return renderSectionCta(
    { label, link, style, size, icon, bg, fg },
    { isLight, fallbackStyle: 'filled' },
  );
}

function BannerSection({ layout = 'split', imgUrl, eyebrow, title, subtitle, ctaLabel, ctaLink, imageOnly = false, ...overrides }) {
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
  // Same theme-pin logic as the hero: when the admin picks dark text, hold
  // it dark across light/dark site themes since the banner image doesn't
  // flip. `accent` here stays themed because it's a brand color choice.
  const fg            = isLight ? '#fff' : (isDark ? '#1a1a18' : 'inherit');
  const subFg         = isLight ? 'rgba(255,255,255,0.78)' : 'rgba(26,26,24,0.7)';
  const eyeFg         = isLight ? 'rgba(255,255,255,0.92)' : 'var(--accent)';
  const italicColor   = isLight ? '#a8d8be' : 'var(--accent)';
  const overImageText = (layout === 'overlay' || layout === 'fullbleed') && isLight;
  const titleShadow   = overImageText ? '0 2px 24px rgba(0,0,0,0.35)' : 'none';
  const subShadow     = overImageText ? '0 1px 12px rgba(0,0,0,0.4)' : 'none';

  const titleJsx = parseItalic(title, { fontStyle: 'italic', color: italicColor });
  const margin   = settings.fullBleed ? '0 0 80px' : '0 var(--page-pad) 80px';
  const scrimDir = settings.scrimDir || autoScrimDir(settings.verticalAlign, settings.textAlign);
  const scrimBg  = bannerScrim(settings.scrim, scrimDir);

  // imageOnly hides the entire text block. Returning null lets each layout
  // collapse its content slot cleanly (split goes to single image-only column,
  // overlay loses its overlay div, stacked drops the content row).
  const content = imageOnly ? null : (
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
        }}>{eyebrow}</p>
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
      <BannerCta
        style={settings.ctaStyle}
        size={settings.ctaSize}
        icon={settings.ctaIcon}
        bg={settings.ctaBg}
        fg={settings.ctaFg}
        label={ctaLabel}
        link={ctaLink}
        isLight={isLight}
      />
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

  // Whole-banner clickthrough for image-only mode. Keeps the banner actionable
  // when there's no visible CTA button. Falls through unchanged otherwise.
  const wrapClickable = (node) => (imageOnly && ctaLink
    ? <Link to={ctaLink} aria-label={ctaLabel || title || 'Banner'} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>{node}</Link>
    : node
  );

  // ── overlay & fullbleed: image as full background, content on top
  if (layout === 'overlay' || layout === 'fullbleed') {
    return wrapClickable(
      <div ref={bannerRef} className="bs-banner" style={{ ...wrap, background: 'var(--ink)' }}>
        {hoverStyles}
        <div style={{ position: 'absolute', inset: 0 }}>{image}</div>
        {/* Scrim only exists to make overlay text legible — skip it in
            imageOnly mode so the image shows clean. */}
        {!imageOnly && scrimBg && <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: scrimBg }} />}
        {!imageOnly && (
          <div style={{
            position: 'relative', zIndex: 2,
            minHeight: minH, padding: pad,
            display: 'flex', flexDirection: 'column',
            justifyContent: alignV, alignItems: alignH,
          }}>
            {content}
          </div>
        )}
      </div>
    );
  }

  // ── stacked: image and content stacked vertically; `imagePosition` controls
  // which is on top. (Previously this conflated with `verticalAlign` which was
  // confusing — now they're separate knobs.)
  if (layout === 'stacked') {
    const imagePos = settings.imagePosition === 'bottom' ? 'bottom' : 'top';
    // In imageOnly mode the image gets the whole height; otherwise it keeps
    // its 55% slice so the content row has room.
    const imageHeight = imageOnly ? minH : Math.max(240, Math.round(minH * 0.55));
    const imageBlock = (
      <div style={{ width: '100%', height: imageHeight, overflow: 'hidden' }}>{image}</div>
    );
    const contentBlock = imageOnly ? null : (
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
    return wrapClickable(
      <div ref={bannerRef} className="bs-banner" style={{ ...wrap, background: 'var(--surface)', border: imageOnly ? 'none' : '1px solid var(--border)', minHeight: 'unset' }}>
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

  // imageOnly + split → single full-width image row (no content column,
  // skip the gradient fade since there's nothing to bridge to).
  if (imageOnly) {
    return wrapClickable(
      <div ref={bannerRef} className="bs-banner" style={{ ...wrap, background: contentBg }}>
        {hoverStyles}
        <div style={{ position: 'relative', overflow: 'hidden', minHeight: minH }}>{image}</div>
      </div>
    );
  }

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
