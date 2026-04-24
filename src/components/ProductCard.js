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

export default function ProductCard({ product }) {
  const { _id, name, description, price, images, category, isActive, stocks, useVariants, variants, options } = product;
  const imgUrl = cloudinaryOptimize(images?.[0]?.url, 600) || null;
  const secondImg = cloudinaryOptimize(images?.[1]?.url, 600) || null;

  const { outOfStock, trackedStockLeft } = computeStockSummary({ useVariants, variants, options, stocks });
  const showLowStock = trackedStockLeft !== null && trackedStockLeft > 0 && trackedStockLeft <= 5;

  return (
    <Link to={`/products/${_id}`} className="product-card">
      <div className="card-img">
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
      <div className="card-body">
        <p className="card-category">{categoryLabel(category)}</p>
        <p className="card-name">{name}</p>
        <p className="card-desc">{description?.length > 80 ? description.slice(0, 80) + '…' : description}</p>
        <div className="card-footer">
          <span className="card-price">₱{price?.toLocaleString()}</span>
          <span className="card-add-btn" aria-label="View product">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}