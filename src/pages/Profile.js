import { useState, useEffect, useContext, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, setUser, logout } = useContext(UserContext);
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('account');

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  // Password state
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  // FIX: Wrap in useCallback and add setUser to dep array
  const loadProfile = useCallback(() => {
    apiFetch('/users/details')
      .then(data => {
        setDetails(data.user);
        const u = data.user;
        setUser(prev => ({ ...prev, firstName: u.firstName, lastName: u.lastName, email: u.email, mobileNo: u.mobileNo }));
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [setUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Fetch orders (regular + group buy) when tab is first opened
  useEffect(() => {
    if (activeTab === 'orders' && !ordersLoaded) {
      setOrdersLoading(true);
      Promise.all([
        apiFetch('/orders/my-orders').then(d => d.orders || []).catch(() => []),
        apiFetch('/group-buys/my/orders').then(d => d.orders || []).catch(() => []),
      ]).then(([regular, gb]) => {
        const normalizedGb = gb.map(o => ({
          _id: o._id,
          createdAt: o.createdAt,
          status: o.status,
          totalPrice: o.totalPrice,
          isGroupBuy: true,
          orderCode: o.orderCode,
          groupBuyName: o.groupBuyId?.name || 'Group Buy',
          groupBuyStatus: o.groupBuyId?.status || '',
          groupBuyImage: o.groupBuyId?.images?.[0]?.url || null,
          groupBuyId: o.groupBuyId,
          selectedOption: o.selectedOption,
          configurations: o.configurations || [],
          kits: o.kits || [],
          quantity: o.quantity,
        }));
        const merged = [...regular.map(o => ({ ...o, isGroupBuy: false })), ...normalizedGb]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(merged);
        setOrdersLoaded(true);
      }).catch(() => setOrders([])).finally(() => setOrdersLoading(false));
    }
  }, [activeTab, ordersLoaded]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.new !== pw.confirm) { toast.error('Passwords do not match'); return; }
    if (pw.new.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setPwLoading(true);
    try {
      await apiFetch('/users/update-password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.new }),
      });
      toast.success('Password updated');
      setPw({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  if (!user) return <Navigate to="/login" />;
  if (loading) return <div className="page-body loading-center"><div className="spinner" /></div>;

  const initials = `${details?.firstName?.[0] || ''}${details?.lastName?.[0] || ''}`;

  const tabs = [
    { id: 'account', label: 'Account Details', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
    { id: 'orders', label: 'Order History', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg> },
    { id: 'security', label: 'Password & Security', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  ];

  return (
    <div className="page-body" style={{ padding: '48px var(--page-pad) 80px' }}>
      <div className="profile-layout">
        {/* ── Sidebar ── */}
        <aside className="profile-sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
            <div className="profile-avatar">{initials}</div>
            <div>
              <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>{details?.firstName} {details?.lastName}</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{details?.email}</p>
            </div>
          </div>

          <nav className="profile-nav">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`profile-nav-item ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={handleLogout} className="profile-nav-item" style={{ color: 'var(--ink-muted)', width: '100%' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="profile-main">
          {/* Account Details */}
          {activeTab === 'account' && (
            <div style={{ animation: 'fadeIn 0.25s ease' }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.6rem', marginBottom: '8px' }}>Account Details</h2>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', marginBottom: '32px' }}>
                Manage your personal information.
              </p>
              <div className="profile-info-grid">
                <InfoBlock label="First Name" value={details?.firstName} />
                <InfoBlock label="Last Name" value={details?.lastName} />
                <InfoBlock label="Email Address" value={details?.email} />
                <InfoBlock label="Mobile Number" value={details?.mobileNo} />
                <InfoBlock label="Account Type" value={details?.isAdmin ? 'Administrator' : 'Customer'} />
                <InfoBlock label="Member Since" value={details?.createdAt ? new Date(details.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'} />
              </div>
            </div>
          )}

          {/* Order History — full inline */}
          {activeTab === 'orders' && (
            <div style={{ animation: 'fadeIn 0.25s ease' }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.6rem', marginBottom: '8px' }}>Order History</h2>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', marginBottom: '28px' }}>
                View and track your past orders.
              </p>

              {ordersLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
              ) : orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-muted)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ marginBottom: '6px' }}>No orders yet.</p>
                  <p style={{ fontSize: '0.82rem' }}>Your order history will appear here after your first purchase.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {orders.map(order => (
                    <OrderCard key={order._id} order={order} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Password & Security */}
          {activeTab === 'security' && (
            <div style={{ animation: 'fadeIn 0.25s ease' }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.6rem', marginBottom: '8px' }}>Password & Security</h2>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', marginBottom: '32px' }}>
                Update your password to keep your account secure.
              </p>
              <form onSubmit={changePassword} style={{ maxWidth: '400px' }}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input type="password" className="form-input" required value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input type="password" className="form-input" required minLength={8} value={pw.new} onChange={e => setPw(p => ({ ...p, new: e.target.value }))} placeholder="Min. 8 characters" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" className="form-input" required value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
                </div>
                {pw.new && pw.confirm && pw.new !== pw.confirm && (
                  <p style={{ color: '#c0392b', fontSize: '0.82rem', marginBottom: '12px' }}>Passwords do not match.</p>
                )}
                <button type="submit" className="btn-dark" disabled={pwLoading} style={{ marginTop: '4px' }}>
                  <span>{pwLoading ? 'Updating...' : 'Update Password'}</span>
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .profile-layout { display: grid; grid-template-columns: 280px 1fr; gap: 48px; max-width: 1000px; margin: 0 auto; align-items: start; }
        .profile-sidebar { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px 24px; position: sticky; top: calc(var(--nav-h) + 20px); display: flex; flex-direction: column; min-height: 360px; box-shadow: var(--shadow-card); }
        .profile-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--accent-light); color: var(--accent); font-family: 'DM Serif Display', serif; font-size: 1rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .profile-nav { display: flex; flex-direction: column; gap: 4px; }
        .profile-nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: var(--radius-sm); font-family: 'DM Sans', sans-serif; font-size: 0.88rem; color: var(--ink-muted); background: none; border: none; cursor: pointer; transition: all var(--transition); text-align: left; width: 100%; }
        .profile-nav-item:hover { background: var(--bg-secondary); color: var(--ink); }
        .profile-nav-item.active { background: var(--accent-light); color: var(--accent); font-weight: 500; }
        .profile-main { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 40px; box-shadow: var(--shadow-card); min-height: 360px; }
        .profile-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .profile-info-block { padding: 18px 0; border-bottom: 1px solid var(--border-subtle); }
        .profile-info-block:nth-last-child(-n+2) { border-bottom: none; }
        .profile-info-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 6px; }
        .profile-info-value { font-size: 0.92rem; font-weight: 500; }
        @media (max-width: 768px) {
          .profile-layout { grid-template-columns: 1fr; gap: 20px; }
          .profile-sidebar { position: static; min-height: auto; }
          .profile-info-grid { grid-template-columns: 1fr; }
          .profile-main { padding: 28px 20px; }
        }
      `}</style>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div className="profile-info-block">
      <p className="profile-info-label">{label}</p>
      <p className="profile-info-value">{value || '—'}</p>
    </div>
  );
}

function OrderCard({ order }) {
  const statusColors = {
    Pending:         { bg: 'var(--accent-light)', color: 'var(--accent)' },
    Processing:      { bg: '#fef3cd', color: '#856404' },
    Shipped:         { bg: '#d1ecf1', color: '#0c5460' },
    Delivered:       { bg: '#d4edda', color: '#155724' },
    Cancelled:       { bg: '#f8d7da', color: '#721c24' },
    Confirmed:       { bg: 'var(--accent-light)', color: 'var(--accent)' },
    'In Production': { bg: '#fef3cd', color: '#856404' },
  };
  const sc = statusColors[order.status] || statusColors.Pending;

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
      padding: '20px 24px', border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {order.isGroupBuy && (
            <div style={{ width: 48, height: 48, borderRadius: '8px', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {order.groupBuyImage
                ? <img src={order.groupBuyImage} alt={order.groupBuyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.2rem', color: 'var(--accent)' }}>{order.groupBuyName?.[0]}</span>
              }
            </div>
          )}
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '2px' }}>
              {order.isGroupBuy ? 'Group Buy Order' : 'Order'}
            </p>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.95rem' }}>
              {order.isGroupBuy ? (order.groupBuyName || 'Group Buy') : order._id.slice(-8).toUpperCase()}
            </p>
            {order.isGroupBuy && order.orderCode && (
              <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', fontFamily: 'monospace', marginTop: '2px' }}>{order.orderCode}</p>
            )}
            {order.isGroupBuy && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '8px', background: 'var(--accent-light)', color: 'var(--accent)' }}>Group Buy</span>
                {order.groupBuyStatus && (
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
                    GB: {order.groupBuyStatus}
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '2px' }}>Date</p>
            <p style={{ fontSize: '0.88rem' }}>{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <span style={{
          background: sc.bg, color: sc.color,
          fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '4px 12px', borderRadius: '20px', whiteSpace: 'nowrap',
        }}>
          {order.status}
        </span>
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
        {/* Regular order items */}
        {!order.isGroupBuy && (order.productsOrdered || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.84rem' }}>
            <span>{item.productName} <span style={{ color: 'var(--ink-muted)' }}>×{item.quantity}</span></span>
            <span style={{ fontWeight: 600 }}>₱{item.subtotal?.toLocaleString()}</span>
          </div>
        ))}
        {/* GB: selected option */}
        {order.isGroupBuy && order.selectedOption?.value && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.84rem' }}>
            <span>{order.selectedOption.groupName}: {order.selectedOption.value} <span style={{ color: 'var(--ink-muted)' }}>×{order.quantity}</span></span>
            <span style={{ fontWeight: 600 }}>₱{(order.selectedOption.price * order.quantity)?.toLocaleString()}</span>
          </div>
        )}
        {/* GB: kits */}
        {order.isGroupBuy && order.kits?.length > 0 && order.kits.map((kit, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.84rem' }}>
            <span>{kit.name} <span style={{ color: 'var(--ink-muted)' }}>×{kit.quantity}</span></span>
            <span style={{ fontWeight: 600 }}>₱{(kit.price * kit.quantity)?.toLocaleString()}</span>
          </div>
        ))}
        {/* GB: configurations */}
        {order.isGroupBuy && order.configurations?.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', padding: '4px 0' }}>
            {order.configurations.map((c, i) => `${c.name}: ${c.selected}`).join(' | ')}
          </p>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 600 }}>
        <span>Total</span>
        <span>₱{order.totalPrice?.toLocaleString()}</span>
      </div>
    </div>
  );
}