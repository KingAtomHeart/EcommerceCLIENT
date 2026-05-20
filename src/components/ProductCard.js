import { Link } from 'react-router-dom';
import { cloudinaryOptimize } from '../utils/api';

const categoryLabel = (slug) => ({
  keyboards: 'Keyboard', keycaps: 'Keycaps', switches: 'Switches',
  'desk-accessories': 'Desk Accessory', 'tools-accessories': 'Tools & Acc.',
  Uncategorized: 'Product'
}[slug] || slug || 'Product');

// Stock summary that understands variants, options, and the `-1 = unlimited` convention.
// Returns { outOfStock, trackedStockLeft } where trackedStockLeft is null when untracked/unlimited.
export function computeStockSummary({ useVariants, variants, options, stocks }) {
  // Variant products: sold out iff no usable variant exists.
  if (useVariants) {
    const list = variants || [];
    if (list.length === 0) return { outOfStock: true, trackedStockLeft: 0 };
    let hasUsable = false;
    let total = 0;
    let anyUnlimited = false;
    for (const v of list) {
      if (v.available === false) continue;
      if (v.stock === 0) continue;
      hasUsable = true;
      if (v.stock === -1 || v.stock == null) anyUnlimited = true;
      else total += v.stock;
    }
    if (!hasUsable) return { outOfStock: true, trackedStockLeft: 0 };
    return { outOfStock: false, trackedStockLeft: anyUnlimited ? null : total };
  }
  // Option-based products: sold out iff every value is unavailable/empty.
  if (options && options.length > 0) {
    let hasUsable = false;
    let total = 0;
    let anyUnlimited = false;
    for (const grp of options) {
      for (const v of (grp.values || [])) {
        if (v.available === false) continue;
        const s = v.stocks;
        if (s === 0) continue;
        hasUsable = true;
        if (s === -1 || s == null || s === undefined) anyUnlimited = true;
        else total += s;
      }
    }
    if (!hasUsable) return { outOfStock: true, trackedStockLeft: 0 };
    return { outOfStock: false, trackedStockLeft: anyUnlimited ? null : total };
  }
  // Plain products: -1 or missing means untracked/unlimited, not sold out.
  if (stocks === undefined || stocks === null || stocks === -1) {
    return { outOfStock: false, trackedStockLeft: null };
  }
  if (stocks <= 0) return { outOfStock: true, trackedStockLeft: 0 };
  return { outOfStock: false, trackedStockLeft: stocks };
}

// Card aspect ratios per `presentation.aspect`. Square is the historical default.
const ASPECT_MAP = { square: '1 / 1', portrait: '3 / 4', landscape: '4 / 3' };

// Size scaling — affects body padding, name font size, image min-height.
// Multipliers are applied via inline styles so we don't fork the CSS.
const SIZE_MAP = {
  sm: { bodyPad: '14px 16px 16px', nameSize: '0.98rem', priceSize: '0.9rem',  descSize: '0.78rem', categorySize: '0.62rem' },
  md: { bodyPad: '20px 22px 24px', nameSize: '1.15rem', priceSize: '1rem',    descSize: '0.84rem', categorySize: '0.7rem'  },
  lg: { bodyPad: '26px 28px 32px', nameSize: '1.35rem', priceSize: '1.1rem',  descSize: '0.9rem',  categorySize: '0.74rem' },
};

// Card chrome variants. `default` keeps the bordered surface card; `minimal`
// drops the border + bg so the card sits flat on the page (good for centered
// grids on tinted sections); `boxed` is a heavier chrome with a soft shadow.
const STYLE_MAP = {
  default: {},
  minimal: { background: 'transparent', border: 'none', borderRadius: 0 },
  boxed:   { boxShadow: '0 8px 32px rgba(0,0,0,0.08)' },
};

export default function ProductCard({ product, presentation }) {
  const { _id, name, description, price, images, category, isActive, stocks, useVariants, variants, options } = product;
  const imgUrl = cloudinaryOptimize(images?.[0]?.url, 600) || null;
  const secondImg = cloudinaryOptimize(images?.[1]?.url, 600) || null;

  const { outOfStock, trackedStockLeft } = computeStockSummary({ useVariants, variants, options, stocks });
  const showLowStock = trackedStockLeft !== null && trackedStockLeft > 0 && trackedStockLeft <= 5;

  // Presentation defaults — preserved as historical behavior when no overrides.
  const p = {
    size: 'md', aspect: 'square', cardStyle: 'default',
    showCategory: true, showDescription: true, showPrice: true,
    buttonStyle: 'arrow',
    ...presentation,
  };
  const size = SIZE_MAP[p.size] || SIZE_MAP.md;
  const styleOverrides = STYLE_MAP[p.cardStyle] || STYLE_MAP.default;
  const aspectRatio = ASPECT_MAP[p.aspect] || ASPECT_MAP.square;

  // Display price: product.price is the base; option/variant prices are ADDITIONAL on top.
  // For option/variant products, show "Starts at" with the base + cheapest additional.
  const displayPriceInfo = (() => {
    const basePrice = price || 0;
    if (useVariants && variants?.length) {
      const usable = variants.filter(v => v.available !== false && v.stock !== 0);
      const additionals = usable.map(v => v.price || 0);
      const minAdd = additionals.length ? Math.min(...additionals) : null;
      if (minAdd != null) return { value: basePrice + minAdd, prefix: 'Starts at ' };
    }
    if (options?.length) {
      const allValues = options.flatMap(g => g.values || []).filter(v => v.available !== false);
      const additionals = allValues.map(v => v.price || 0);
      const minAdd = additionals.length ? Math.min(...additionals) : null;
      if (minAdd != null) return { value: basePrice + minAdd, prefix: 'Starts at ' };
    }
    return { value: basePrice, prefix: '' };
  })();

  return (
    <Link to={`/products/${_id}`} className="product-card" style={styleOverrides}>
      <div className="card-img" style={{ aspectRatio }}>
        {outOfStock && <span className="card-badge out">Sold Out</span>}
        {!outOfStock && !isActive && <span className="card-badge out">Unavailable</span>}
        {!outOfStock && showLowStock && (
          <span className="card-badge low-stock">Only {trackedStockLeft} left</span>
        )}
        {imgUrl ? (
          <>
            <img src={imgUrl} alt={name} loading="lazy" className="card-img-primary" />
            {secondImg && (
              <img src={secondImg} alt={name} loading="lazy" className="card-img-secondary" />
            )}
          </>
        ) : (
          <div className="card-img-placeholder">
            {name?.[0] || '?'}
          </div>
        )}
      </div>
      <div className="card-body" style={{ padding: size.bodyPad }}>
        {p.showCategory && (
          <p className="card-category" style={{ fontSize: size.categorySize }}>{categoryLabel(category)}</p>
        )}
        <p className="card-name" style={{ fontSize: size.nameSize }}>{name}</p>
        {p.showDescription && description && (
          <p className="card-desc" style={{ fontSize: size.descSize }}>
            {description.length > 80 ? description.slice(0, 80) + '…' : description}
          </p>
        )}
        {(p.showPrice || p.buttonStyle !== 'hidden') && (
          <div className="card-footer">
            {p.showPrice ? (
              <span className="card-price" style={{ fontSize: size.priceSize }}>
                {displayPriceInfo.prefix && (
                  <span style={{ fontSize: '0.7em', fontWeight: 400, color: 'var(--ink-muted)', marginRight: 4 }}>
                    {displayPriceInfo.prefix}
                  </span>
                )}
                ₱{displayPriceInfo.value?.toLocaleString()}
              </span>
            ) : <span />}

            {p.buttonStyle === 'arrow' && (
              <span className="card-add-btn" aria-label="View product">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </span>
            )}
            {p.buttonStyle === 'text' && (
              <span style={{
                fontSize: '0.82rem', fontWeight: 500, color: 'var(--accent)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }} aria-label="View product">
                View <span aria-hidden="true">→</span>
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}