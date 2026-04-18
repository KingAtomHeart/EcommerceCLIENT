import { Link } from 'react-router-dom';

const statusLabel = {
  'interest-check': 'Interest Check',
  'open': 'Open',
  'closing-soon': 'Closing Soon',
  'closed': 'Closed',
  'production': 'In Production',
  'completed': 'Completed',
};

const statusColor = {
  'interest-check': { bg: '#fef3cd', color: '#856404' },
  'open': { bg: 'var(--accent-light)', color: 'var(--accent)' },
  'closing-soon': { bg: '#fde8e0', color: '#c0392b' },
  'closed': { bg: '#f8d7da', color: '#721c24' },
  'production': { bg: '#d1ecf1', color: '#0c5460' },
  'completed': { bg: '#d4edda', color: '#155724' },
};

export default function GroupBuyCard({ gb }) {
  const sc = statusColor[gb.status] || statusColor['open'];
  const imgUrl = gb.images?.[0]?.url;
  const endDate = gb.endDate ? new Date(gb.endDate) : null;
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / 86400000)) : null;

  return (
    <Link to={`/group-buys/${gb._id}`} className="product-card" style={{ textDecoration: 'none' }}>
      <div className="card-img">
        <span style={{
          position: 'absolute', top: 14, left: 14, zIndex: 3,
          background: sc.bg, color: sc.color,
          fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '5px 12px', borderRadius: '20px',
        }}>
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
              ? `From ₱${Math.min(...gb.options.flatMap(g => (g.values || []).map(v => v.price))).toLocaleString()}`
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
