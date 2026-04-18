import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

export default function CartView() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCart = () => {
    setLoading(true);
    apiFetch('/cart/get-cart')
      .then(data => setCart(data.cart || { cartItems: [], totalPrice: 0 }))
      .catch(() => setCart({ cartItems: [], totalPrice: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) fetchCart(); else setLoading(false); }, [user]);

  const updateQty = async (productId, quantity, kitId, optionValueId) => {
    if (quantity < 1) return;
    try {
      await apiFetch('/cart/update-cart-quantity', {
        method: 'PATCH',
        body: JSON.stringify({ productId, quantity, kitId: kitId || undefined, optionValueId: optionValueId || undefined }),
      });
      fetchCart();
    } catch (err) { toast.error(err.message); }
  };

  const removeItem = async (productId, kitId, optionValueId) => {
    try {
      const params = new URLSearchParams();
      if (kitId) params.set('kitId', kitId);
      if (optionValueId) params.set('optionValueId', optionValueId);
      const qs = params.toString();
      const url = `/cart/${productId}/remove-from-cart${qs ? `?${qs}` : ''}`;
      await apiFetch(url, { method: 'PATCH' });
      toast.success('Item removed');
      fetchCart();
    } catch (err) { toast.error(err.message); }
  };

  const clearCart = async () => {
    try {
      await apiFetch('/cart/clear-cart', { method: 'PUT' });
      toast.success('Cart cleared');
      fetchCart();
    } catch (err) { toast.error(err.message); }
  };

  const checkout = async () => {
    try {
      const isGroupBuy = items.some(item => item.groupBuyId);
      const endpoint = isGroupBuy ? '/orders/checkout-group-buy' : '/orders/checkout';
      await apiFetch(endpoint, { method: 'POST' });
      toast.success('Order placed successfully!');
      navigate('/order-history');
    } catch (err) { toast.error(err.message); }
  };

  if (!user) {
    return (
      <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - var(--nav-h))' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-muted)', marginBottom: '20px' }}>Please sign in to view your cart.</p>
          <Link to="/login" className="btn-dark"><span>Sign In</span></Link>
        </div>
      </div>
    );
  }
  if (loading) return <div className="page-body loading-center"><div className="spinner" /></div>;

  const items = cart?.cartItems || [];
  const total = cart?.totalPrice || 0;
  const isEmpty = items.length === 0;
  const freeShipThreshold = 5000;
  const shippingPct = Math.min((total / freeShipThreshold) * 100, 100);
  const freeShip = total >= freeShipThreshold;

  return (
    <div className="page-body" style={{ padding: '56px var(--page-pad) 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.6rem', letterSpacing: '-0.025em', marginBottom: '44px' }}>Your Cart</h1>

      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)' }}>
          <svg width="52" height="52" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" style={{ opacity: 0.2, margin: '0 auto 20px', display: 'block' }}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <p style={{ marginBottom: '20px' }}>Your cart is empty.</p>
          <Link to="/products" className="btn-dark"><span>Start Shopping</span></Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '52px', alignItems: 'start' }} className="cart-layout">
          <div>
            {items.map((item, idx) => {
              const prod = item.productId;
              const isGroupBuy = !!item.groupBuyId;
              const gbData = isGroupBuy ? item.groupBuyId : null;
              const prodName = isGroupBuy
                ? (item.groupBuyName || (typeof gbData === 'object' ? gbData?.name : null) || 'Group Buy Item')
                : (prod && typeof prod === 'object' ? prod.name : 'Product');
              const imgUrl = isGroupBuy
                ? (typeof gbData === 'object' ? gbData?.images?.[0]?.url : null)
                : (prod && typeof prod === 'object' ? prod.images?.[0]?.url : null);
              const itemId = isGroupBuy
                ? (typeof gbData === 'object' ? gbData?._id : (item.groupBuyId || item._id))
                : (prod && typeof prod === 'object' ? prod._id : prod);
              const kitId = item.kitId || null;
              const optValId = item.selectedOption?.valueId || null;

              let displayName = prodName;
              if (item.kitName) displayName = `${prodName} — ${item.kitName}`;
              if (item.selectedOption?.value) {
                displayName = `${prodName} — ${item.selectedOption.groupName}: ${item.selectedOption.value}`;
              }

              const configStr = (item.configurations || []).map(c => `${c.name}: ${c.selected}`).join(', ');

              const gbTag = isGroupBuy ? (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '2px 8px', borderRadius: '10px',
                  background: 'var(--accent-light)', color: 'var(--accent)', marginLeft: '8px'
                }}>Group Buy</span>
              ) : null;

              return (
                <div key={`${itemId}-${kitId || optValId || 'base'}-${idx}`} className="cart-row" style={{ animation: `fadeUp 0.35s ease ${idx * 0.06}s both` }}>
                  <div className="cart-img">
                    {imgUrl ? <img src={imgUrl} alt={displayName} />
                      : <div style={{ width: '100%', height: '100%', background: 'var(--accent-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: "'DM Serif Display', serif", fontSize: '1.2rem',
                          color: 'var(--accent)' }}>{prodName?.[0]}</div>}
                  </div>
                  <div>
                    <p className="cart-item-name">{displayName}{gbTag}</p>
                    {configStr && <p className="cart-item-variant">{configStr}</p>}
                  </div>
                  <div className="cart-qty">
                    <button className="qty-btn" onClick={() => updateQty(itemId, item.quantity - 1, kitId, optValId)} disabled={item.quantity <= 1}>−</button>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQty(itemId, item.quantity + 1, kitId, optValId)}>+</button>
                  </div>
                  <p className="cart-item-price">₱{item.subtotal?.toLocaleString()}</p>
                  <button className="cart-remove" onClick={() => removeItem(itemId, kitId, optValId)}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '28px', position: 'sticky', top: '84px', boxShadow: 'var(--shadow-card)' }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.35rem', marginBottom: '28px' }}>Order Summary</h2>

            <div className="shipping-progress-wrap">
              <p className="shipping-msg">
                {freeShip ? '✓ You qualify for free shipping!' : `Add ₱${(freeShipThreshold - total).toLocaleString()} more for free shipping`}
              </p>
              <div className="shipping-bar"><div className="shipping-fill" style={{ width: `${shippingPct}%` }} /></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '12px' }}>
              <span style={{ color: 'var(--ink-muted)' }}>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
              <span>₱{total.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '12px' }}>
              <span style={{ color: 'var(--ink-muted)' }}>Shipping</span>
              <span>{freeShip ? 'Free' : '₱150'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
              <span>Total</span>
              <span>₱{(freeShip ? total : total + 150).toLocaleString()}</span>
            </div>

            <button onClick={checkout} className="btn-dark" style={{ width: '100%', marginTop: '20px', justifyContent: 'center' }}>
              <span>Proceed to Checkout →</span>
            </button>
            <button onClick={clearCart} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '14px', fontSize: '0.84rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear Cart
            </button>
            <Link to={items.some(i => i.groupBuyId) ? '/group-buys' : '/products'}
              style={{ display: 'block', textAlign: 'center', marginTop: '8px', fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
              Continue Shopping
            </Link>
          </div>
        </div>
      )}

      <style>{`@media (max-width: 900px) { .cart-layout { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}