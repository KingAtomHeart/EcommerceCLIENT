import { Link } from 'react-router-dom';

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

export default function GroupBuyCard({ gb }) {
  const colorKey = statusColorClass[gb.status] || 'blue';
  const imgUrl = gb.images?.[0]?.url;
  const endDate = gb.endDate ? new Date(gb.endDate) : null;
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / 86400000)) : null;

  return (
    <Link to={`/group-buys/${gb._id}`} className="product-card" style={{ textDecoration: 'none' }}>
      <div className="card-img">
        <span className={`status-badge status-${colorKey}`} style={{ position: 'absolute', top: 14, left: 14, zIndex: 3 }}>
          {statusLabel[gb.status]}
        </span>
        {imgUrl ? (
          <img src={imgUrl} alt={gb.name} loading="lazy" className="card-img-primary" />
        ) : (
          <div className="card-img-placeholder">{gb.name?.[0]}</div>
        )}
      </div>
      <div className="card-body">
        <p className="card-category">{gb.category || 'Group Buy'}</p>
        <p className="card-name">{gb.name}</p>
        <p className="card-desc">{gb.description?.length > 100 ? gb.description.slice(0, 100) + '...' : gb.description}</p>
        <div className="card-footer">
          <span className="card-price">
            {(gb.options?.length > 0)
              ? `From ₱${((gb.basePrice || 0) + Math.min(...gb.options.flatMap(g => (g.values || []).map(v => v.price || 0)))).toLocaleString()}`
              : `₱${gb.basePrice?.toLocaleString()}`
            }
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
            {gb.orderCount > 0 && <span>{gb.orderCount} joined</span>}
            {daysLeft !== null && (gb.status === 'open' || gb.status === 'closing-soon') && (
              <span style={{ color: daysLeft <= 3 ? '#c0392b' : 'var(--ink-muted)' }}>
                {daysLeft === 0 ? 'Last day' : `${daysLeft}d left`}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
