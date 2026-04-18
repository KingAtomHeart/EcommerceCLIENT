import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import GroupBuyCard from '../components/GroupBuyCard';
import { apiFetch } from '../utils/api';

const CATEGORIES = [
  { slug: 'keyboards', label: 'Keyboards' },
  { slug: 'keycaps', label: 'Keycaps' },
  { slug: 'switches', label: 'Switches' },
  { slug: 'desk-accessories', label: 'Desk Accessories' },
  { slug: 'tools-accessories', label: 'Tools & Accessories' },
];

/* Split text on *asterisks* and wrap odd segments in <em> */
function parseItalic(text) {
  if (!text) return text;
  const parts = text.split('*');
  return parts.map((part, i) =>
    i % 2 === 1 ? <em key={i}>{part}</em> : part
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

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [homepage, setHomepage] = useState(null);
  const [groupBuys, setGroupBuys] = useState([]);
  const carouselRef = useRef(null);

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

  const featured = products.slice(0, 6);

  const bannerProduct = products.find(p =>
    p.category?.toLowerCase().includes('keyboard') && p.images?.length > 0
  ) || products.find(p => p.images?.length > 0) || null;

  const bannerImgUrl = homepage?.bannerImage?.url || bannerProduct?.images?.[0]?.url || null;
  const bannerLayout = homepage?.bannerLayout || 'overlay';

  const activeGroupBuys = groupBuys.filter(gb => gb.status !== 'interest-check').slice(0, 4);
  const interestChecks = groupBuys.filter(gb => gb.status === 'interest-check').slice(0, 4);

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

  const countByCategory = (slug) =>
    products.filter(p => p.category?.toLowerCase().replace(/\s+/g, '-') === slug).length;

  return (
    <div className="page-body" style={{ marginTop: 0 }}>

      {/* ── HERO ── */}
      <section className="hero" style={{ marginTop: 'var(--nav-h)' }}>
        <HeroCarousel
          images={homepage?.heroImages?.map(i => i.url) || []}
          eyebrow={homepage?.heroEyebrow || 'Spring 2026 Collection'}
          title={homepage?.heroTitle || 'Craft your perfect *setup.*'}
          subtitle={homepage?.heroSubtitle || 'Precision-built mechanical keyboards and desk accessories for those who care about every detail — from switch feel to surface texture.'}
          primaryCta={{ label: homepage?.heroPrimaryCtaLabel || 'Shop Now', link: homepage?.heroPrimaryCtaLink || '/products' }}
          secondaryCta={{ label: homepage?.heroSecondaryCtaLabel || 'Explore Keyboards', link: homepage?.heroSecondaryCtaLink || '/products?cat=keyboards' }}
        />
      </section>

      {/* ── CATEGORIES ── */}
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

      {/* ── FEATURED PRODUCTS ── */}
      <section className="section" style={{ padding: '80px var(--page-pad)' }}>
        <div className="section-header">
          <h2 className="section-title">Featured Products</h2>
          <Link to="/products" className="section-link">View all →</Link>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i} style={{ height: 360 }} />)}
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
              {featured.map(p => (
                <div key={p._id} style={{ scrollSnapAlign: 'start' }}>
                  <ProductCard product={p} />
                </div>
              ))}
              {featured.length === 0 && (
                <p style={{ color: 'var(--ink-muted)', padding: '40px', textAlign: 'center', gridColumn: '1/-1' }}>
                  No products yet. Add some from the admin dashboard.
                </p>
              )}
            </div>
            {featured.length >= 4 && (
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
      </section>

      {/* ── ACTIVE GROUP BUYS ── */}
      {activeGroupBuys.length > 0 && (
        <section className="section" style={{ padding: '0 var(--page-pad) 80px' }}>
          <div className="section-header">
            <div>
              <h2 className="section-title">Active Group Buys</h2>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                Join production runs for exclusive keyboards and accessories.
              </p>
            </div>
            <Link to="/group-buys" className="section-link">View all →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            {activeGroupBuys.map(gb => <GroupBuyCard key={gb._id} gb={gb} />)}
          </div>
        </section>
      )}

      {/* ── INTEREST CHECKS ── */}
      {interestChecks.length > 0 && (
        <section className="section" style={{ padding: '0 var(--page-pad) 80px' }}>
          <div className="section-header">
            <div>
              <h2 className="section-title">Interest Checks</h2>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                Help shape what we make next. Show interest — no commitment.
              </p>
            </div>
            <Link to="/group-buys" className="section-link">View all →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            {interestChecks.map(gb => <GroupBuyCard key={gb._id} gb={gb} />)}
          </div>
        </section>
      )}

      {/* ── BANNER ── */}
      <BannerSection
        layout={bannerLayout}
        imgUrl={bannerImgUrl}
        eyebrow={homepage?.bannerEyebrow || 'Limited Drop'}
        title={homepage?.bannerTitle || 'The *Origami Keys Originals* is here.'}
        subtitle={homepage?.bannerSubtitle || 'Our very own design of keyboards and accessories.'}
        ctaLabel={homepage?.bannerCtaLabel || 'Browse Collection'}
        ctaLink={homepage?.bannerCtaLink || '/products'}
      />
    </div>
  );
}


/* ─── Hero Carousel ─── */
function HeroCarousel({ images, eyebrow, title, subtitle, primaryCta, secondaryCta }) {
  const [current, setCurrent] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const timerRef = useRef(null);
  const hasImages = images.length > 0;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % images.length);
    }, 5000);
  }, [images.length]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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
        {hasImages ? (
          images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Hero ${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              className={`hero-slide ${i === current ? 'active' : ''}`}
            />
          ))
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, var(--ink) 0%, var(--accent) 100%)' }} />
        )}
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
            <Link to={primaryCta.link} className="btn-primary">{primaryCta.label}</Link>
            <Link to={secondaryCta.link} className="btn-ghost">{secondaryCta.label}</Link>
          </div>
        </div>
      </div>

      {images.length > 1 && (
        <div className="hero-dots">
          {images.map((_, i) => (
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


/* ─── Banner Section — 4 layouts ─── */
function BannerSection({ layout, imgUrl, eyebrow, title, subtitle, ctaLabel, ctaLink }) {
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

  const titleJsx = parseItalic(title);
  const hasFallback = !imgUrl && (layout === 'overlay' || layout === 'fullbleed');
  const bgStyle = hasFallback
    ? { background: 'linear-gradient(135deg, var(--ink) 0%, var(--accent) 100%)' }
    : {};

  if (layout === 'overlay') {
    return (
      <div ref={bannerRef} className="banner banner--overlay" style={bgStyle}>
        {imgUrl && <img src={imgUrl} alt="Banner" className="banner--overlay-img" loading="lazy" />}
        <div className={`banner--overlay-content ${visible ? 'banner-animate-in' : ''}`}>
          <p className="banner--overlay-eyebrow">{eyebrow}</p>
          <h2 className="banner--overlay-title">{titleJsx}</h2>
          <p className="banner--overlay-sub">{subtitle}</p>
          <Link to={ctaLink} className="btn-light">{ctaLabel}</Link>
        </div>
      </div>
    );
  }

  if (layout === 'stacked') {
    return (
      <div ref={bannerRef} className="banner banner--stacked">
        <div className="banner--stacked-img">
          {imgUrl
            ? <img src={imgUrl} alt="Banner" loading="lazy" />
            : <div style={{ width: '100%', height: '100%', background: 'var(--accent-light)' }} />
          }
        </div>
        <div className={`banner--stacked-content ${visible ? 'banner-animate-in' : ''}`}>
          <p className="banner-eyebrow">{eyebrow}</p>
          <h2 className="banner-title">{titleJsx}</h2>
          <p className="banner-sub" style={{ color: 'var(--ink-muted)' }}>{subtitle}</p>
          <Link to={ctaLink} className="btn-dark">{ctaLabel}</Link>
        </div>
      </div>
    );
  }

  if (layout === 'fullbleed') {
    return (
      <div ref={bannerRef} className="banner banner--fullbleed" style={bgStyle}>
        {imgUrl && <img src={imgUrl} alt="Banner" className="banner--fullbleed-img" loading="lazy" />}
        <div className={`banner--fullbleed-content ${visible ? 'banner-animate-in' : ''}`}>
          <p className="banner--overlay-eyebrow">{eyebrow}</p>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: '#fff', letterSpacing: '-0.025em', marginBottom: '24px' }}>{titleJsx}</h2>
          <Link to={ctaLink} className="btn-ghost-white">{ctaLabel}</Link>
        </div>
      </div>
    );
  }

  // Default: 'split'
  return (
    <div ref={bannerRef} className="banner">
      <div className={`banner-content ${visible ? 'banner-animate-in' : ''}`}>
        <p className="banner-eyebrow">{eyebrow}</p>
        <h2 className="banner-title">{titleJsx}</h2>
        <p className="banner-sub">{subtitle}</p>
        <Link to={ctaLink} className="btn-light">{ctaLabel}</Link>
      </div>
      <div className="banner-img">
        {imgUrl ? (
          <img src={imgUrl} alt="Banner" loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--accent-light)' }} />
        )}
      </div>
    </div>
  );
}
