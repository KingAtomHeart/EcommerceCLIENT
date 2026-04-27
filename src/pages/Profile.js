import { useState, useEffect, useContext, useCallback } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';
import AddressForm, { emptyAddress } from '../components/AddressForm';
import OrderCard from '../components/OrderCard';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, setUser, logout } = useContext(UserContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialTab = !user?.isAdmin && searchParams.get('tab') === 'orders' ? 'orders'
    : searchParams.get('tab') === 'security' ? 'security' : 'account';
  const [activeTab, setActiveTab] = useState(initialTab);
  const changeTab = (t) => {
    setActiveTab(t);
    setSearchParams(t === 'account' ? {} : { tab: t }, { replace: true });
  };

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  // Password state
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const uploadAvatar = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB.'); return; }
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const token = localStorage.getItem('token');
      const base = process.env.REACT_APP_API_BASE_URL || '';
      const upRes = await fetch(`${base}/upload/single`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!upRes.ok) {
        let msg = 'Upload failed';
        try { const e = await upRes.json(); msg = e.error || msg; } catch {}
        throw new Error(msg);
      }
      const upData = await upRes.json();

      const res = await apiFetch('/users/update-profile-picture', {
        method: 'PATCH', body: JSON.stringify({ url: upData.url }),
      });
      setDetails(res.user);
      setUser(prev => ({ ...prev, profilePicture: res.user.profilePicture }));
      toast.success('Profile picture updated');
    } catch (err) { toast.error(err.message); }
    finally { setUploadingAvatar(false); }
  };

  const removeAvatar = async () => {
    if (!window.confirm('Remove your profile picture?')) return;
    setUploadingAvatar(true);
    try {
      const res = await apiFetch('/users/update-profile-picture', {
        method: 'PATCH', body: JSON.stringify({ url: '' }),
      });
      setDetails(res.user);
      setUser(prev => ({ ...prev, profilePicture: '' }));
      toast.success('Profile picture removed');
    } catch (err) { toast.error(err.message); }
    finally { setUploadingAvatar(false); }
  };

  // Addresses state
  const [addresses, setAddresses] = useState([]);
  const [editingId, setEditingId] = useState(null); // id | 'new' | null
  const [draft, setDraft] = useState(emptyAddress());
  const [addrSaving, setAddrSaving] = useState(false);

  const startAdd = () => { setDraft(emptyAddress()); setEditingId('new'); };
  const startEdit = (a) => { setDraft({ ...a, isDefault: !!a.isDefault }); setEditingId(a._id); };
  const cancelEdit = () => { setEditingId(null); setDraft(emptyAddress()); };

  const saveAddress = async () => {
    for (const k of ['fullName', 'phone', 'street', 'city', 'province']) {
      if (!draft[k]) { toast.error('Please complete the address.'); return; }
    }
    setAddrSaving(true);
    try {
      const res = editingId === 'new'
        ? await apiFetch('/users/addresses', { method: 'POST', body: JSON.stringify({ address: draft }) })
        : await apiFetch(`/users/addresses/${editingId}`, { method: 'PATCH', body: JSON.stringify({ address: draft }) });
      setAddresses(res.addresses || []);
      cancelEdit();
      toast.success(editingId === 'new' ? 'Address added' : 'Address updated');
    } catch (err) { toast.error(err.message); }
    finally { setAddrSaving(false); }
  };

  const removeAddress = async (id) => {
    if (!window.confirm('Remove this address?')) return;
    try {
      const res = await apiFetch(`/users/addresses/${id}`, { method: 'DELETE' });
      setAddresses(res.addresses || []);
      toast.success('Address removed');
    } catch (err) { toast.error(err.message); }
  };

  const makeDefault = async (id) => {
    try {
      const res = await apiFetch(`/users/addresses/${id}/default`, { method: 'PATCH' });
      setAddresses(res.addresses || []);
    } catch (err) { toast.error(err.message); }
  };

  // FIX: Wrap in useCallback and add setUser to dep array
  const loadProfile = useCallback(() => {
    apiFetch('/users/details')
      .then(data => {
        setDetails(data.user);
        const u = data.user;
        setAddresses(u.addresses || []);
        setUser(prev => ({ ...prev, firstName: u.firstName, lastName: u.lastName, email: u.email, mobileNo: u.mobileNo, profilePicture: u.profilePicture || '' }));
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
          cartOrderCode: o.cartOrderCode || null,
          cartCheckoutId: o.cartCheckoutId || null,
          isAddon: !!o.groupBuyId?.parentGroupBuyId,
          addedAfterPurchase: !!o.addedAfterPurchase,
          groupBuyName: o.groupBuyId?.name || 'Group Buy',
          groupBuyStatus: o.groupBuyId?.status || '',
          groupBuyImage: o.groupBuyId?.images?.[0]?.url || null,
          groupBuyId: o.groupBuyId,
          selectedOption: o.selectedOption,
          configurations: o.configurations || [],
          kits: o.kits || [],
          quantity: o.quantity,
          shippingAddress: o.shippingAddress,
          notes: o.notes,
        }));

        // Group GB orders by cartCheckoutId — multiple items in one cart = one order in history
        const groups = new Map();
        const soloGb = [];
        for (const o of normalizedGb) {
          if (!o.cartCheckoutId) { soloGb.push(o); continue; }
          if (!groups.has(o.cartCheckoutId)) groups.set(o.cartCheckoutId, []);
          groups.get(o.cartCheckoutId).push(o);
        }
        const groupedGb = [];
        for (const [cid, items] of groups) {
          if (items.length === 1) { groupedGb.push(items[0]); continue; }
          // Sort items so parent (non-addon) comes first
          const sortedItems = [...items].sort((a, b) => Number(!!a.isAddon) - Number(!!b.isAddon));
          const parentItem = sortedItems.find(i => !i.isAddon) || sortedItems[0];
          const addonCount = sortedItems.filter(i => i.isAddon).length;
          const allSameStatus = sortedItems.every(i => i.status === sortedItems[0].status);
          const total = sortedItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
          groupedGb.push({
            _id: cid,
            cartCheckoutId: cid,
            cartOrderCode: parentItem.cartOrderCode,
            createdAt: parentItem.createdAt,
            status: allSameStatus ? sortedItems[0].status : 'Mixed',
            totalPrice: total,
            isGroupBuy: true,
            isGrouped: true,
            orderCode: parentItem.cartOrderCode || sortedItems.map(i => i.orderCode).join(' / '),
            groupBuyName: addonCount > 0 ? `${parentItem.groupBuyName} + ${addonCount} add-on${addonCount > 1 ? 's' : ''}` : parentItem.groupBuyName,
            groupBuyStatus: parentItem.groupBuyStatus || '',
            groupBuyImage: parentItem.groupBuyImage,
            shippingAddress: parentItem.shippingAddress,
            lineItems: sortedItems,
          });
        }

        const merged = [...regular.map(o => ({ ...o, isGroupBuy: false })), ...soloGb, ...groupedGb]
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
    ...(!user?.isAdmin ? [{ id: 'orders', label: 'Order History', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg> }] : []),
    { id: 'security', label: 'Password & Security', icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  ];

  return (
    <div className="page-body" style={{ padding: '48px var(--page-pad) 80px' }}>
      <div className="profile-layout">
        {/* ── Sidebar ── */}
        <aside className="profile-sidebar">
          <div className="profile-identity">
            <label className="avatar-uploader" title="Change photo">
              <div className="avatar-uploader-inner">
                {details?.profilePicture ? (
                  <img src={details.profilePicture} alt="" />
                ) : (
                  <span className="avatar-initials">{initials}</span>
                )}
                <div className={`avatar-overlay ${uploadingAvatar ? 'uploading' : ''}`}>
                  {uploadingAvatar ? (
                    <span className="avatar-spinner" />
                  ) : (
                    <>
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <span>Change</span>
                    </>
                  )}
                </div>
              </div>
              <input type="file" accept="image/*" onChange={e => uploadAvatar(e.target.files?.[0])} disabled={uploadingAvatar} />
            </label>
            <p className="profile-identity-name">{details?.firstName} {details?.lastName}</p>
            <p className="profile-identity-email">{details?.email}</p>
            {details?.profilePicture && (
              <button onClick={removeAvatar} disabled={uploadingAvatar} className="profile-identity-remove">
                Remove photo
              </button>
            )}
          </div>

          <nav className="profile-nav">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`profile-nav-item ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => changeTab(t.id)}
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

              {/* ── Saved Addresses — hidden for admin ── */}
              {!user?.isAdmin && <div style={{ marginTop: '44px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.3rem' }}>Saved Addresses</h3>
                  {editingId === null && (
                    <button onClick={startAdd} className="btn-light" style={{ padding: '8px 18px', fontSize: '0.84rem' }}>
                      <span>+ Add Address</span>
                    </button>
                  )}
                </div>
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', marginBottom: '22px' }}>
                  Saved addresses are available for instant checkout.
                </p>

                {editingId !== null && (
                  <div style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-secondary)', marginBottom: '20px' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '14px' }}>
                      {editingId === 'new' ? 'New Address' : 'Edit Address'}
                    </p>
                    <AddressForm value={draft} onChange={setDraft} showDefaultToggle={addresses.length > 0 || editingId === 'new'} />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                      <button onClick={saveAddress} className="btn-dark" disabled={addrSaving} style={{ padding: '10px 22px' }}>
                        <span>{addrSaving ? 'Saving…' : 'Save'}</span>
                      </button>
                      <button onClick={cancelEdit} className="btn-light" style={{ padding: '10px 22px' }}>
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                )}

                {addresses.length === 0 && editingId === null ? (
                  <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--ink-muted)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem' }}>
                    No saved addresses yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {addresses.map(a => (
                      <div key={a._id} style={{ padding: '16px 18px', border: `1px solid ${a.isDefault ? 'var(--ink)' : 'var(--border)'}`, borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', alignItems: 'start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '0.94rem', fontWeight: 500 }}>{a.fullName}</p>
                            {a.isDefault && (
                              <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--ink)', color: '#fff', padding: '2px 8px', borderRadius: '6px' }}>Default</span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', margin: 0 }}>{a.phone}</p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                            {a.street}, {a.city}, {a.province}{a.postalCode ? `, ${a.postalCode}` : ''}
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                          <button onClick={() => startEdit(a)} className="profile-addr-btn">Edit</button>
                          {!a.isDefault && <button onClick={() => makeDefault(a._id)} className="profile-addr-btn">Set default</button>}
                          <button onClick={() => removeAddress(a._id)} className="profile-addr-btn" style={{ color: '#c0392b' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>}
            </div>
          )}

          {/* Order History — hidden for admin */}
          {activeTab === 'orders' && !user?.isAdmin && (
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
        .profile-identity { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 28px; }
        .avatar-uploader { position: relative; cursor: pointer; display: block; margin-bottom: 14px; }
        .avatar-uploader input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
        .avatar-uploader-inner { position: relative; width: 88px; height: 88px; border-radius: 50%; overflow: hidden; background: var(--accent-light); box-shadow: 0 2px 10px rgba(0,0,0,0.06); transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .avatar-uploader:hover .avatar-uploader-inner { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
        .avatar-uploader-inner img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .avatar-initials { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--accent); font-family: 'DM Serif Display', serif; font-size: 1.6rem; letter-spacing: -0.02em; }
        .avatar-overlay {
          position: absolute; inset: 0;
          background: rgba(10, 10, 8, 0.55); color: #fff;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
          opacity: 0; transition: opacity 0.2s ease;
          font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
        }
        .avatar-uploader:hover .avatar-overlay { opacity: 1; }
        .avatar-overlay.uploading { opacity: 1; }
        .avatar-spinner { width: 22px; height: 22px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .profile-identity-name { font-weight: 500; font-size: 1rem; margin-bottom: 2px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-identity-email { font-size: 0.78rem; color: var(--ink-muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-identity-remove { margin-top: 10px; background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 0.74rem; color: var(--ink-muted); padding: 4px 10px; border-radius: var(--radius-pill); transition: background 0.2s ease, color 0.2s ease; }
        .profile-identity-remove:hover { background: var(--bg-secondary); color: var(--ink); }
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
        .profile-addr-btn { background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500; color: var(--ink-muted); padding: 2px 4px; text-decoration: underline; text-underline-offset: 3px; }
        .profile-addr-btn:hover { color: var(--ink); }
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

