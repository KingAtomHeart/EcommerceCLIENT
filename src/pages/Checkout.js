import { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import UserContext from '../context/UserContext';
import AddToOrderContext from '../context/AddToOrderContext';
import { useCurrency } from '../context/CurrencyContext';
import { apiFetch } from '../utils/api';
import { computeShippingFromProvince } from '../utils/shipping';
import AddressForm, { emptyAddress } from '../components/AddressForm';
import toast from 'react-hot-toast';

const NEW = '__new__';
// Public PayPal client id (safe to expose). When unset, checkout falls back to
// the manual "Place Order" flow so the page still works before keys are added.
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || '';

export default function Checkout() {
  const { user } = useContext(UserContext);
  const { token: addToken, info: addInfo, clear: clearAddToken } = useContext(AddToOrderContext);
  const { format, currency } = useCurrency();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(NEW);
  const [newAddress, setNewAddress] = useState(emptyAddress());
  const [saveNew, setSaveNew] = useState(true);

  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState(emptyAddress());

  // PayPal refs (declared with the other hooks so they run before any early return).
  const paypalOrderRef = useRef(null);
  const suppressPaypalError = useRef(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      apiFetch('/cart/get-cart').then(d => d.cart || { cartItems: [], totalPrice: 0 }).catch(() => ({ cartItems: [], totalPrice: 0 })),
      apiFetch('/users/details').then(d => d.user).catch(() => null),
    ]).then(([c, u]) => {
      setCart(c);
      const list = u?.addresses || [];
      setSavedAddresses(list);
      if (list.length > 0) {
        const def = list.find(a => a.isDefault) || list[0];
        setSelectedId(def._id);
      } else if (u) {
        setNewAddress(a => ({ ...a, fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim(), phone: u.mobileNo || '' }));
      }
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <div className="page-body loading-center" style={{ flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: 'var(--ink-muted)' }}>Please sign in to continue checkout.</p>
      <Link to="/login" className="btn-dark"><span>Sign In</span></Link>
    </div>
  );
  if (loading) return <div className="page-body loading-center"><div className="spinner" /></div>;

  const items = cart?.cartItems || [];
  const subtotal = cart?.totalPrice || 0;
  const isGroupBuy = items.some(i => i.groupBuyId);

  if (items.length === 0) {
    return (
      <div className="page-body" style={{ padding: '64px var(--page-pad) 80px', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-muted)', marginBottom: '20px' }}>Your cart is empty.</p>
        <Link to="/products" className="btn-dark"><span>Start Shopping</span></Link>
      </div>
    );
  }

  const isAddMode = !!addToken;
  const activeAddress = selectedId === NEW ? newAddress : savedAddresses.find(a => a._id === selectedId) || newAddress;
  // International shipping isn't wired up yet — global addresses can be entered
  // and saved, but checkout is gated to PH until the shipping calculator lands.
  const isIntl = !isAddMode && !!activeAddress?.country && activeAddress.country !== 'Philippines';
  const ship = (!isGroupBuy && !isAddMode && !isIntl && activeAddress?.province) ? computeShippingFromProvince(activeAddress.province) : null;
  const shippingFee = ship?.fee ?? 0;
  const grandTotal = subtotal + shippingFee;

  const validate = (a) => {
    for (const k of ['fullName', 'phone', 'street', 'city', 'province']) {
      if (!a?.[k]) return false;
    }
    return true;
  };

  const placeOrder = async () => {
    if (submitting) return;
    if (!isAddMode) {
      if (isIntl) { toast.error("International shipping isn't available yet — we currently ship within the Philippines."); return; }
      if (!validate(activeAddress)) { toast.error('Please complete the shipping address.'); return; }
      if (!billingSame && !validate(billing)) { toast.error('Please complete the billing address.'); return; }
    }
    setSubmitting(true);
    try {
      if (!isAddMode && selectedId === NEW && saveNew) {
        try {
          const res = await apiFetch('/users/addresses', {
            method: 'POST',
            body: JSON.stringify({ address: newAddress }),
          });
          setSavedAddresses(res.addresses || []);
        } catch { /* non-blocking */ }
      }
      const body = isAddMode
        ? { addToOrderToken: addToken }
        : { shippingAddress: activeAddress, billingAddress: billingSame ? null : billing };
      await apiFetch('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAddMode) clearAddToken();
      toast.success(isAddMode ? 'Items added to your order!' : 'Order placed!');
      navigate('/profile?tab=orders');
    } catch (e) {
      toast.error(e.message);
      setSubmitting(false);
    }
  };

  // ── PayPal (standard in-stock checkout only) ──
  // Pay online with PayPal: the server builds an awaiting-payment order, PayPal
  // handles approval, then the server captures + finalizes (marks paid, decrements
  // stock, clears cart). Add-to-order and group-buy checkouts keep placeOrder.
  const useOnlinePayment = !isAddMode && !isGroupBuy && !isIntl && !!PAYPAL_CLIENT_ID;

  const createPaypalOrder = async () => {
    if (!validate(activeAddress)) { suppressPaypalError.current = true; toast.error('Please complete the shipping address.'); throw new Error('Incomplete address'); }
    if (!billingSame && !validate(billing)) { suppressPaypalError.current = true; toast.error('Please complete the billing address.'); throw new Error('Incomplete billing'); }
    // Persist a brand-new address to the profile (non-blocking convenience).
    if (selectedId === NEW && saveNew) {
      try {
        const res = await apiFetch('/users/addresses', { method: 'POST', body: JSON.stringify({ address: newAddress }) });
        setSavedAddresses(res.addresses || []);
      } catch { /* non-blocking */ }
    }
    const res = await apiFetch('/orders/paypal/create-order', {
      method: 'POST',
      body: JSON.stringify({ shippingAddress: activeAddress, billingAddress: billingSame ? null : billing }),
    });
    paypalOrderRef.current = res.orderId;
    return res.paypalOrderId;
  };

  const onPaypalApprove = async (data) => {
    setSubmitting(true);
    try {
      await apiFetch('/orders/paypal/capture-order', {
        method: 'POST',
        body: JSON.stringify({ paypalOrderId: data.orderID, orderId: paypalOrderRef.current }),
      });
      toast.success('Payment successful — order placed!');
      navigate(`/payment-success?orderId=${paypalOrderRef.current}`);
    } catch (e) {
      toast.error(e.message || 'Payment could not be confirmed. If you were charged, please contact support.');
      setSubmitting(false);
    }
  };

  const onPaypalError = (err) => {
    if (suppressPaypalError.current) { suppressPaypalError.current = false; return; } // our own validation toast already shown
    console.error('PayPal error:', err);
    toast.error('PayPal ran into a problem. Please try again.');
  };

  return (
    <div className="page-body" style={{ padding: '48px var(--page-pad) 80px' }}>
      <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: '24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link to="/cart" style={{ color: 'var(--ink-muted)' }}>Cart</Link>
        <span style={{ opacity: 0.35 }}>›</span>
        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>Checkout</span>
      </div>

      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(2rem, 3vw, 2.6rem)', letterSpacing: '-0.025em', marginBottom: '36px' }}>Checkout</h1>

      {isAddMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '10px', background: 'var(--accent-light)', border: '1px solid var(--accent)', marginBottom: '20px', fontSize: '0.88rem', color: 'var(--accent)' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>
            Adding to <strong>{addInfo?.targetLabel || 'your existing order'}</strong>. Shipping is free — using the original order's address.
          </span>
        </div>
      )}
      {isGroupBuy && !isAddMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '10px', background: 'var(--accent-light)', border: '1px solid var(--accent)', marginBottom: '28px', fontSize: '0.88rem', color: 'var(--accent)' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span><strong>Group Buy Order</strong> — fulfillment will follow the group buy timeline.</span>
        </div>
      )}

      <div className="checkout-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

          {!isAddMode && <>
          <section>
            <h2 className="checkout-section-title">Shipping Address</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {savedAddresses.map(a => (
                <AddressCard key={a._id}
                  address={a}
                  selected={selectedId === a._id}
                  onSelect={() => setSelectedId(a._id)}
                />
              ))}
              <button type="button" onClick={() => setSelectedId(NEW)} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', borderRadius: '10px',
                border: `1.5px ${selectedId === NEW ? 'solid var(--ink)' : 'dashed var(--border)'}`,
                background: selectedId === NEW ? 'var(--accent-light)' : 'transparent',
                cursor: 'pointer', transition: 'all var(--transition)',
                fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--ink)', textAlign: 'left',
              }}>
                <Radio selected={selectedId === NEW} />
                <span>+ Use a new address</span>
              </button>
            </div>

            {selectedId === NEW && (
              <div style={{ marginTop: '18px', padding: '22px', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <AddressForm value={newAddress} onChange={setNewAddress} showDefaultToggle={savedAddresses.length > 0} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: 'var(--ink-muted)', cursor: 'pointer', marginTop: '14px' }}>
                  <input type="checkbox" checked={saveNew} onChange={e => setSaveNew(e.target.checked)} style={{ accentColor: 'var(--ink)' }} />
                  Save this address to my account
                </label>
              </div>
            )}
          </section>

          <section>
            <h2 className="checkout-section-title">Billing Address</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <RadioCard selected={billingSame} onClick={() => setBillingSame(true)} label="Same as shipping address" />
              <RadioCard selected={!billingSame} onClick={() => setBillingSame(false)} label="Use a different billing address" />
            </div>
            {!billingSame && (
              <div style={{ marginTop: '18px', padding: '22px', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <AddressForm value={billing} onChange={setBilling} showDefaultToggle={false} />
              </div>
            )}
          </section>
          </>}
        </div>

        <div className="checkout-summary">
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem', marginBottom: '18px' }}>Order Summary</h2>

          <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '16px', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item, idx) => {
              // Cart populates BOTH productId (regular) and groupBuyId (GB)
              // with name + images. GB items previously fell through to the
              // 'Product' string because we only read from productId.
              const prod = item.productId;
              const gb = item.groupBuyId;
              const prodObj = (prod && typeof prod === 'object') ? prod : null;
              const gbObj   = (gb   && typeof gb   === 'object') ? gb   : null;
              const prodName = gbObj?.name || prodObj?.name || item.name || 'Item';
              const imgUrl   = gbObj?.images?.[0]?.url || prodObj?.images?.[0]?.url || null;
              let displayName = prodName;
              if (item.selectedOption?.value) displayName = `${prodName} — ${item.selectedOption.value}`;
              const variantAttrs = item.variantAttributes && typeof item.variantAttributes === 'object' && !Array.isArray(item.variantAttributes)
                ? Object.entries(item.variantAttributes).map(([k, v]) => `${k}: ${v}`).join(', ')
                : null;
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: '12px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 10, background: 'var(--accent-light)', overflow: 'hidden' }}>
                    {imgUrl ? <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: "'DM Serif Display', serif" }}>{prodName?.[0]}</div>}
                    <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--ink)', color: 'var(--bg)', fontSize: '0.68rem', fontWeight: 600, minWidth: 18, height: 18, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{item.quantity}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.86rem', fontWeight: 500, lineHeight: 1.3, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</p>
                    {variantAttrs && <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', margin: '2px 0 0', lineHeight: 1.3 }}>{variantAttrs}</p>}
                  </div>
                  <span style={{ fontSize: '0.86rem', fontWeight: 500 }}>{format(item.subtotal)}</span>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Row label="Subtotal" value={format(subtotal)} />
            <Row label="Shipping" value={isIntl ? <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>Not available yet</span> : ship ? format(shippingFee) : <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>Enter address</span>} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '14px' }}>
            <span>Total</span>
            <span>{format(grandTotal)}</span>
          </div>
          {currency !== 'PHP' && (
            <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textAlign: 'right', marginTop: '8px', lineHeight: 1.5 }}>
              Prices shown in {currency} are approximate. You'll be charged <strong>₱{grandTotal.toLocaleString()}</strong>.
            </p>
          )}

          {isIntl ? (
            <div style={{ marginTop: '24px', padding: '14px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '0.84rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink)' }}>International shipping is coming soon.</strong><br />
              We currently ship within the Philippines. You can still save this address to your profile — <Link to="/contact" style={{ color: 'var(--accent)' }}>contact us</Link> to arrange an international order.
            </div>
          ) : useOnlinePayment ? (
            <div style={{ marginTop: '24px' }}>
              <PayPalScriptProvider options={{ 'client-id': PAYPAL_CLIENT_ID, currency: 'PHP', intent: 'capture' }}>
                <PayPalButtons
                  style={{ layout: 'vertical', shape: 'pill', color: 'gold', label: 'paypal' }}
                  disabled={submitting}
                  forceReRender={[grandTotal, selectedId, billingSame, JSON.stringify(newAddress)]}
                  createOrder={createPaypalOrder}
                  onApprove={onPaypalApprove}
                  onError={onPaypalError}
                  onCancel={() => toast('Payment cancelled — you have not been charged.')}
                />
              </PayPalScriptProvider>
              <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', textAlign: 'center', marginTop: '10px', lineHeight: 1.5 }}>
                Secure payment via PayPal — you can also pay by card without a PayPal account.
              </p>
            </div>
          ) : (
            <>
              <button onClick={placeOrder} className="btn-dark" style={{ width: '100%', marginTop: '24px', justifyContent: 'center' }} disabled={submitting}>
                <span>{submitting ? 'Placing order…' : 'Place Order'}</span>
              </button>
              <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', textAlign: 'center', marginTop: '10px', lineHeight: 1.5 }}>
                Payment instructions will be coordinated after order placement.
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`
        .checkout-grid { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 56px; align-items: start; }
        .checkout-section-title { font-family: 'DM Sans', sans-serif; font-size: 1.05rem; font-weight: 600; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
        .checkout-summary { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 28px; position: sticky; top: 84px; box-shadow: var(--shadow-card); }
        @media (max-width: 960px) {
          .checkout-grid { grid-template-columns: 1fr; gap: 32px; }
          .checkout-summary { position: static; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span style={{ color: 'var(--ink-muted)' }}>{label}</span><span>{value}</span></div>;
}

function Radio({ selected }) {
  return (
    <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${selected ? 'var(--ink)' : 'var(--ink-faint)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {selected && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ink)' }} />}
    </span>
  );
}

function RadioCard({ selected, onClick, label }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 16px', borderRadius: '10px',
      border: `1.5px solid ${selected ? 'var(--ink)' : 'var(--border)'}`,
      background: selected ? 'var(--accent-light)' : 'transparent',
      cursor: 'pointer', transition: 'all var(--transition)',
      textAlign: 'left', fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--ink)',
    }}>
      <Radio selected={selected} />
      {label}
    </button>
  );
}

function AddressCard({ address, selected, onSelect }) {
  return (
    <button type="button" onClick={onSelect} style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '12px', alignItems: 'flex-start',
      padding: '14px 16px', borderRadius: '10px',
      border: `1.5px solid ${selected ? 'var(--ink)' : 'var(--border)'}`,
      background: selected ? 'var(--accent-light)' : 'transparent',
      cursor: 'pointer', transition: 'all var(--transition)',
      textAlign: 'left', fontFamily: 'inherit', color: 'var(--ink)',
    }}>
      <span style={{ paddingTop: 3 }}><Radio selected={selected} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '0.92rem', fontWeight: 500, margin: 0 }}>{address.fullName} <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>· {address.phone}</span></p>
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
          {address.street}, {address.city}, {address.province}{address.postalCode ? `, ${address.postalCode}` : ''}
        </p>
      </div>
      {address.isDefault && (
        <span className="status-badge status-green" style={{ fontSize: '0.64rem', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>Default</span>
      )}
    </button>
  );
}
