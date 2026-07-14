import { Link } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';

const statusLabel = {
  'interest-check': 'Interest Check',
  'open': 'Open',
  'closing-soon': 'Closing Soon',
  'closed': 'Closed',
  'production': 'In Production',
  'completed': 'Completed',
};

const statusColorClass = {
  'interest-check': 'gray',
  'open': 'blue',
  'closing-soon': 'amber',
  'closed': 'gray',
  'production': 'purple',
  'completed': 'green',
};

// Card presentation maps — mirror ProductCard so the homepage admin can drive
// either card kind with the same `presentation` shape.
const ASPECT_MAP = { square: '1 / 1', portrait: '3 / 4', landscape: '4 / 3' };
const SIZE_MAP = {
  sm: { bodyPad: '14px 16px 16px', nameSize: '0.98rem', priceSize: '0.9rem',  descSize: '0.78rem', categorySize: '0.62rem' },
  md: { bodyPad: '20px 22px 24px', nameSize: '1.15rem', priceSize: '1rem',    descSize: '0.84rem', categorySize: '0.7rem'  },
  lg: { bodyPad: '26px 28px 32px', nameSize: '1.35rem', priceSize: '1.1rem',  descSize: '0.9rem',  categorySize: '0.74rem' },
};
const STYLE_MAP = {
  default: {},
  minimal: { background: 'transparent', border: 'none', borderRadius: 0 },
  boxed:   { boxShadow: '0 8px 32px rgba(0,0,0,0.08)' },
};

export default function GroupBuyCard({ gb, presentation }) {
  const { format } = useCurrency();
  // Defaults preserve historical look when no presentation is passed; the
  // homepage admin overrides these to customize.
  const p = {
    size: 'md', aspect: 'square', cardStyle: 'default',
    showCategory: true, showDescription: true, showPrice: true,
    showMeta: true,
    buttonStyle: 'arrow',
    ...presentation,
  };
  const size = SIZE_MAP[p.size] || SIZE_MAP.md;
  const styleOverrides = STYLE_MAP[p.cardStyle] || STYLE_MAP.default;
  const aspectRatio = ASPECT_MAP[p.aspect] || ASPECT_MAP.square;

  const colorKey = statusColorClass[gb.status] || 'blue';
  const imgUrl = gb.images?.[0]?.url;
  const endDate = gb.endDate ? new Date(gb.endDate) : null;
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / 86400000)) : null;

  const priceLine = (gb.options?.length > 0)
    ? `From ${format((gb.basePrice || 0) + Math.min(...gb.options.flatMap(g => (g.values || []).map(v => v.price || 0))))}`
    : format(gb.basePrice);

  const metaJsx = p.showMeta && (
    <div style={{
      marginTop: 8,
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: '0.75rem', color: 'var(--ink-muted)',
    }}>
      {gb.orderCount > 0 && <span>{gb.orderCount} joined</span>}
      {daysLeft !== null && (gb.status === 'open' || gb.status === 'closing-soon') && (
        <span style={{ color: daysLeft <= 3 ? '#c0392b' : 'var(--ink-muted)' }}>
          {daysLeft === 0 ? 'Last day' : `${daysLeft}d left`}
        </span>
      )}
    </div>
  );

  return (
    <Link to={`/group-buys/${gb._id}`} className="product-card" style={{ textDecoration: 'none', ...styleOverrides }}>
      <div className="card-img" style={{ aspectRatio }}>
        {/* Type tag (top-left) — marks the card as a group buy. Neutral ink/bg
            inverting pair stays readable in every theme + light/dark mode and
            reads distinctly from the coloured status badge. */}
        <span className="status-badge" style={{ position: 'absolute', top: 14, left: 14, zIndex: 3, background: 'var(--ink)', color: 'var(--bg)' }}>
          Group Buy
        </span>
        {/* Status (top-right) — Open / Closing Soon / In Production / etc. */}
        <span className={`status-badge status-${colorKey}`} style={{ position: 'absolute', top: 14, right: 14, zIndex: 3 }}>
          {statusLabel[gb.status]}
        </span>
        {imgUrl ? (
          <img src={imgUrl} alt={gb.name} loading="lazy" className="card-img-primary" />
        ) : (
          <div className="card-img-placeholder">{gb.name?.[0]}</div>
        )}
      </div>
      <div className="card-body" style={{ padding: size.bodyPad }}>
        {p.showCategory && (
          <p className="card-category" style={{ fontSize: size.categorySize }}>{gb.category || 'Group Buy'}</p>
        )}
        <p className="card-name" style={{ fontSize: size.nameSize }}>{gb.name}</p>
        {p.showDescription && gb.description && (
          <p className="card-desc" style={{ fontSize: size.descSize }}>
            {gb.description.length > 100 ? gb.description.slice(0, 100) + '…' : gb.description}
          </p>
        )}
        {(p.showPrice || p.buttonStyle !== 'hidden') && (
          <div className="card-footer">
            {p.showPrice ? (
              <span className="card-price" style={{ fontSize: size.priceSize }}>{priceLine}</span>
            ) : <span />}

            {p.buttonStyle === 'arrow' && (
              <span className="card-add-btn" aria-label="View group buy">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </span>
            )}
            {p.buttonStyle === 'text' && (
              <span style={{
                fontSize: '0.82rem', fontWeight: 500, color: 'var(--accent)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }} aria-label="View group buy">
                View <span aria-hidden="true">→</span>
              </span>
            )}
          </div>
        )}
        {metaJsx}
      </div>
    </Link>
  );
}
