import { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

export default function OrderHistory() {
  const { user } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadOrders = useCallback(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      apiFetch('/orders/my-orders').then(d => d.orders || []).catch(() => []),
      apiFetch('/group-buys/my/orders').then(d => d.orders || []).catch(() => []),
    ]).then(([regularOrders, gbOrders]) => {
      const normalizedGb = gbOrders.map(o => ({
        _id: o._id,
        createdAt: o.createdAt,
        status: o.status,
        totalPrice: o.totalPrice,
        isGroupBuy: true,
        orderCode: o.orderCode,
        groupBuyId: o.groupBuyId,
        groupBuyName: o.groupBuyId?.name || 'Group Buy',
        groupBuyStatus: o.groupBuyId?.status || '',
        groupBuyImage: o.groupBuyId?.images?.[0]?.url || null,
        selectedOption: o.selectedOption,
        configurations: o.configurations || [],
        kits: o.kits || [],
        notes: o.notes || '',
        shippingAddress: o.shippingAddress,
        quantity: o.quantity,
      }));

      const normalizedRegular = regularOrders.map(o => ({ ...o, isGroupBuy: false }));

      const merged = [...normalizedRegular, ...normalizedGb]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setOrders(merged);
    }).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this group buy order? This cannot be undone.')) return;
    try {
      await apiFetch(`/group-buys/orders/${orderId}/cancel`, { method: 'POST' });
      toast.success('Order cancelled');
      loadOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel order');
    }
  };

  if (!user) {
    return (
      <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - var(--nav-h))' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-muted)', marginBottom: '20px' }}>Please sign in to view your orders.</p>
          <Link to="/login" className="btn-dark"><span>Sign In</span></Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page-body loading-center"><div className="spinner" /></div>;

  const filtered = filter === 'all' ? orders
    : filter === 'gb' ? orders.filter(o => o.isGroupBuy)
    : orders.filter(o => !o.isGroupBuy);

  const filterLabel = filter === 'gb' ? 'group buy' : filter === 'regular' ? 'regular' : null;

  const cancellablePhases = ['interest-check', 'open', 'closing-soon'];

  return (
    <div className="page-body" style={{ padding: '56px var(--page-pad) 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.6rem', letterSpacing: '-0.025em', marginBottom: '28px' }}>
        Order History
      </h1>

      {/* Filter pills */}
      {orders.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {[['all', 'All'], ['regular', 'Regular'], ['gb', 'Group Buy']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              fontSize: '0.75rem', fontWeight: 600, padding: '6px 16px', borderRadius: '20px', cursor: 'pointer',
              border: '1px solid', fontFamily: "'DM Sans', sans-serif",
              borderColor: filter === val ? 'var(--accent)' : 'var(--border)',
              background: filter === val ? 'var(--accent-light)' : 'transparent',
              color: filter === val ? 'var(--accent)' : 'var(--ink-muted)',
            }}>{label}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)' }}>
          <p style={{ marginBottom: '20px' }}>
            {filterLabel ? `No ${filterLabel} orders yet.` : 'You have no orders yet.'}
          </p>
          {!filterLabel && <Link to="/products" className="btn-dark"><span>Start Shopping</span></Link>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {filtered.map(order => (
            <div key={order._id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '28px',
              boxShadow: 'var(--shadow-card)', animation: 'fadeUp 0.5s ease both',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  {/* Thumbnail */}
                  {order.isGroupBuy && (
                    order.groupBuyId?._id ? (
                      <Link to={`/group-buys/${order.groupBuyId._id}`} style={{ flexShrink: 0 }}>
                        <Thumbnail url={order.groupBuyImage} name={order.groupBuyName} />
                      </Link>
                    ) : (
                      <Thumbnail url={order.groupBuyImage} name={order.groupBuyName} />
                    )
                  )}

                  <div>
                    <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '4px' }}>
                      {order.isGroupBuy ? 'Group Buy Order' : 'Order ID'}
                    </p>
                    {order.isGroupBuy ? (
                      order.groupBuyId?._id ? (
                        <Link to={`/group-buys/${order.groupBuyId._id}`} style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: 'var(--ink)', textDecoration: 'none' }}>
                          {order.groupBuyName}
                        </Link>
                      ) : (
                        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: 'var(--ink-muted)' }}>
                          {order.groupBuyName} <span style={{ fontSize: '0.72rem' }}>(no longer available)</span>
                        </p>
                      )
                    ) : (
                      <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem' }}>
                        {order._id.slice(-8).toUpperCase()}
                      </p>
                    )}

                    {/* Badges */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {order.isGroupBuy && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '10px', background: 'var(--accent-light)', color: 'var(--accent)' }}>
                          Group Buy
                        </span>
                      )}
                      {order.isGroupBuy && order.groupBuyStatus && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '10px', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
                          GB: {order.groupBuyStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '4px' }}>Date</p>
                    <p style={{ fontSize: '0.9rem' }}>{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </div>

              {/* Body */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>

                {/* Regular order items */}
                {!order.isGroupBuy && order.productsOrdered?.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
                    <span>
                      {item.productName}
                      {item.selectedOption?.value && <span style={{ color: 'var(--ink-muted)', marginLeft: 6 }}>{item.selectedOption.groupName}: {item.selectedOption.value}</span>}
                      {item.configurations?.length > 0 && (
                        <span style={{ color: 'var(--ink-muted)', marginLeft: 6, fontSize: '0.82rem' }}>
                          ({item.configurations.map(c => `${c.name}: ${c.selected}`).join(' | ')})
                        </span>
                      )}
                      <span style={{ color: 'var(--ink-muted)' }}> ×{item.quantity}</span>
                    </span>
                    <span style={{ fontWeight: 600 }}>₱{item.subtotal?.toLocaleString()}</span>
                  </div>
                ))}

                {/* GB order: selected option */}
                {order.isGroupBuy && order.selectedOption?.value && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
                    <span>
                      {order.selectedOption.groupName}: {order.selectedOption.value}
                      <span style={{ color: 'var(--ink-muted)' }}> ×{order.quantity}</span>
                    </span>
                    <span style={{ fontWeight: 600 }}>₱{(order.selectedOption.price * order.quantity)?.toLocaleString()}</span>
                  </div>
                )}

                {/* GB order: kits */}
                {order.isGroupBuy && order.kits?.length > 0 && order.kits.map((kit, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
                    <span>{kit.name} <span style={{ color: 'var(--ink-muted)' }}>×{kit.quantity}</span></span>
                    <span style={{ fontWeight: 600 }}>₱{(kit.price * kit.quantity)?.toLocaleString()}</span>
                  </div>
                ))}

                {/* GB order: configurations */}
                {order.isGroupBuy && order.configurations?.length > 0 && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', padding: '4px 0' }}>
                    {order.configurations.map((c, i) => (
                      <span key={i}>{c.name}: {c.selected}{i < order.configurations.length - 1 ? ' | ' : ''}</span>
                    ))}
                  </div>
                )}

                {/* GB order: notes */}
                {order.isGroupBuy && order.notes?.trim() && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                    <strong style={{ fontStyle: 'normal' }}>Notes:</strong> {order.notes}
                  </p>
                )}

                {/* GB order: shipping */}
                {order.isGroupBuy && order.shippingAddress?.fullName && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', padding: '4px 0' }}>
                    {order.shippingAddress.fullName}{order.shippingAddress.phone ? ` · ${order.shippingAddress.phone}` : ''}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {order.isGroupBuy && order.orderCode && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', fontFamily: 'monospace' }}>{order.orderCode}</span>
                  )}
                  {order.isGroupBuy && order.status === 'Confirmed' && order.groupBuyId?._id && cancellablePhases.includes(order.groupBuyStatus) && (
                    <button onClick={() => handleCancel(order._id)} className="admin-card-btn" style={{ fontSize: '0.72rem', color: '#c0392b', borderColor: '#c0392b' }}>
                      Cancel Order
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>₱{order.totalPrice?.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumbnail({ url, name }) {
  return (
    <div style={{ width: 72, height: 72, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.8rem', color: 'var(--accent)' }}>{name?.[0]}</span>
      }
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Pending:         { bg: 'var(--accent-light)', color: 'var(--accent)' },
    Processing:      { bg: '#fef3cd', color: '#856404' },
    Shipped:         { bg: '#d1ecf1', color: '#0c5460' },
    Delivered:       { bg: '#d4edda', color: '#155724' },
    Cancelled:       { bg: '#f8d7da', color: '#721c24' },
    Confirmed:       { bg: 'var(--accent-light)', color: 'var(--accent)' },
    'In Production': { bg: '#fef3cd', color: '#856404' },
  };
  const c = colors[status] || colors.Pending;
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '5px 14px', borderRadius: '20px',
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}
