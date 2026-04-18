import { Link } from 'react-router-dom';

const categoryLabel = (slug) => ({
  keyboards: 'Keyboard', keycaps: 'Keycaps', switches: 'Switches',
  'desk-accessories': 'Desk Accessory', 'tools-accessories': 'Tools & Acc.',
  Uncategorized: 'Product'
}[slug] || slug || 'Product');

export default function ProductCard({ product }) {
  const { _id, name, description, price, images, category, isActive, stocks } = product;
  const imgUrl = images?.[0]?.url || null;
  const secondImg = images?.[1]?.url || null;
  const hasStockTracking = stocks !== undefined && stocks !== null;
  const outOfStock = hasStockTracking && stocks <= 0;

  return (
    <Link to={`/products/${_id}`} className="product-card">
      <div className="card-img">
        {outOfStock && <span className="card-badge out">Sold Out</span>}
        {!outOfStock && !isActive && <span className="card-badge out">Unavailable</span>}
        {!outOfStock && hasStockTracking && stocks > 0 && stocks <= 5 && (
          <span className="card-badge low-stock">Only {stocks} left</span>
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