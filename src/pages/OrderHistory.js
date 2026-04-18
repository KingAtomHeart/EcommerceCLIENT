import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';

export default function OrderHistory() {
  const { user } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiFetch('/orders/my-orders').then(d => d.orders || []).catch(() => []),
      apiFetch('/group-buys/my/orders').then(d => d.orders || []).catch(() => []),
    ]).then(([regularOrders, gbOrders]) => {
      // Normalize group buy orders to match regular order shape for display
      const normalizedGb = gbOrders.map(o => ({
        _id: o._id,
        createdAt: o.createdAt,
        status: o.status,
        totalPrice: o.totalPrice,
        isGroupBuy: true,
        orderCode: o.orderCode,
        groupBuyName: o.groupBuyId?.name || 'Group Buy',
        groupBuyStatus: o.groupBuyId?.status || '',
        productsOrdered: [{
          productName: `${o.groupBuyId?.name || 'Group Buy'}${o.selectedOption?.value ? ` — ${o.selectedOption.groupName}: ${o.selectedOption.value}` : ''}`,
          quantity: o.quantity,
          subtotal: o.totalPrice,
        }],
        configurations: o.configurations || [],
      }));

      const normalizedRegular = regularOrders.map(o => ({
        ...o,
        isGroupBuy: false,
      }));

      const merged = [...normalizedRegular, ...normalizedGb]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setOrders(merged);
    }).finally(() => setLoading(false));
  }, [user]);

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

  return (
    <div className="page-body" style={{ padding: '56px var(--page-pad) 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.6rem', letterSpacing: '-0.025em', marginBottom: '44px' }}>
        Order History
      </h1>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)' }}>
          <p style={{ marginBottom: '20px' }}>You have no orders yet.</p>
          <Link to="/products" className="btn-dark"><span>Start Shopping</span></Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {orders.map(order => (
            <div key={order._id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '28px',
              boxShadow: 'var(--shadow-card)', animation: 'fadeUp 0.5s ease both',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '4px' }}>
                    {order.isGroupBuy ? 'Group Buy Order' : 'Order ID'}
                  </p>
                  <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem' }}>
                    {order.isGroupBuy ? order.orderCode : order._id.slice(-8).toUpperCase()}
                  </p>
                </div>
                {order.isGroupBuy && (
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', padding: '3px 10px', borderRadius: '10px',
                    background: 'var(--accent-light)', color: 'var(--accent)'
                  }}>Group Buy</span>
                )}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '4px' }}>Date</p>
                  <p style={{ fontSize: '0.9rem' }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              {/* Configurations (for group buy orders) */}
              {order.isGroupBuy && order.configurations?.length > 0 && (
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: '8px' }}>
                  {order.configurations.map((c, i) => (
                    <span key={i}>{c.name}: {c.selected}{i < order.configurations.length - 1 ? ' | ' : ''}</span>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                {order.productsOrdered.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '8px 0', fontSize: '0.9rem' }}>
                    <span>{item.productName} <span style={{ color: 'var(--ink-muted)' }}>×{item.quantity}</span></span>
                    <span style={{ fontWeight: 600 }}>₱{item.subtotal?.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: '12px',
                paddingTop: '12px', display: 'flex', justifyContent: 'space-between',
                fontSize: '1.05rem', fontWeight: 600 }}>
                <span>Total</span>
                <span>₱{order.totalPrice?.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Pending: { bg: 'var(--accent-light)', color: 'var(--accent)' },
    Processing: { bg: '#fef3cd', color: '#856404' },
    Shipped: { bg: '#d1ecf1', color: '#0c5460' },
    Delivered: { bg: '#d4edda', color: '#155724' },
    Cancelled: { bg: '#f8d7da', color: '#721c24' },
    Confirmed: { bg: 'var(--accent-light)', color: 'var(--accent)' },
    'In Production': { bg: '#fef3cd', color: '#856404' },
  };
  const c = colors[status] || colors.Pending;
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '5px 14px', borderRadius: '20px',
    }}>
      {status}
    </span>
  );
}
