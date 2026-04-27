import { useState } from 'react';
import { StatusBadge } from '../utils/statusColors';

function Thumbnail({ url, name, size = 48 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: `${size * 0.45}px`, color: 'var(--accent)' }}>{name?.[0]}</span>
      }
    </div>
  );
}

function TypeTag({ isGroupBuy }) {
  if (isGroupBuy) {
    return (
      <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '10px', background: '#f5d6d8', color: '#8b2a31' }}>Group Buy</span>
    );
  }
  return (
    <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '10px', background: '#fdf0d5', color: '#8a6d1a' }}>In Stock</span>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div>
      <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '0.86rem', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value || '—'}</p>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: muted ? 'var(--ink-muted)' : 'inherit' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  return a.fullName === b.fullName && a.phone === b.phone && a.street === b.street && a.city === b.city && a.province === b.province;
}

export default function OrderCard({ order }) {
  const [open, setOpen] = useState(false);

  const isGrouped = !!order.isGrouped;
  const title = isGrouped
    ? (order.groupBuyName || `${order.lineItems?.length || 0} items`)
    : order.isGroupBuy
      ? (order.groupBuyName || 'Group Buy')
      : `Order ${order._id.slice(-8).toUpperCase()}`;
  const firstItem = order.productsOrdered?.[0];
  const inStockImg = firstItem?.productImage
    || firstItem?.productId?.images?.[0]?.url
    || null;
  const thumbUrl = order.isGroupBuy ? order.groupBuyImage : inStockImg;
  const thumbName = order.isGroupBuy ? order.groupBuyName : (firstItem?.productName || 'O');

  // For grouped GB orders, exclude cancelled items from active subtotal
  const groupedActiveTotal = isGrouped
    ? (order.lineItems || []).filter(li => li.status !== 'Cancelled').reduce((n, li) => n + (li.totalPrice || 0), 0)
    : null;
  const groupedCancelledTotal = isGrouped
    ? (order.lineItems || []).filter(li => li.status === 'Cancelled').reduce((n, li) => n + (li.totalPrice || 0), 0)
    : 0;
  const subtotal = isGrouped
    ? groupedActiveTotal
    : order.isGroupBuy
      ? order.totalPrice || 0
      : (order.productsOrdered || []).reduce((n, p) => n + (p.subtotal || 0), 0);
  const shippingFee = order.shippingFee || 0;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', overflow: 'hidden',
      animation: 'fadeUp 0.4s ease both',
    }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="order-card-header"
        style={{
          width: '100%', display: 'grid',
          gridTemplateColumns: 'auto auto 1fr auto auto auto',
          gap: '16px', alignItems: 'center',
          padding: '16px 20px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--ink)',
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--ink-muted)' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <Thumbnail url={thumbUrl} name={thumbName} size={64} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
            <TypeTag isGroupBuy={order.isGroupBuy} />
          </div>
          <p style={{ fontSize: '0.95rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>{new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
        </div>
        {(() => {
          // For GB orders: main tag = group buy campaign status (open/closing-soon/production/etc).
          // For in-stock: main tag = order.status.
          // Only show "Cancelled" when EVERY item is cancelled.
          if (order.isGroupBuy) {
            const allItemsCancelled = isGrouped
              ? (order.lineItems || []).length > 0 && (order.lineItems || []).every(li => li.status === 'Cancelled')
              : order.status === 'Cancelled';
            if (allItemsCancelled) return <StatusBadge status="Cancelled" />;
            const campaignStatus = order.groupBuyStatus || 'open';
            return <StatusBadge status={campaignStatus} label={campaignStatus.replace('-', ' ')} />;
          }
          // In-stock: show order.status; partial-item-cancellation doesn't flip order.status here
          const items = order.productsOrdered || [];
          const anyActive = items.some(p => p.status !== 'Cancelled');
          if (order.status === 'Cancelled' && anyActive) {
            // Some items still active despite order-level cancelled — fall back to most-common active status
            const counts = {};
            items.filter(p => p.status !== 'Cancelled').forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || order.status;
            return <StatusBadge status={top} />;
          }
          return <StatusBadge status={order.status} />;
        })()}
        <span style={{ fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap' }}>₱{(isGrouped ? groupedActiveTotal : order.totalPrice)?.toLocaleString()}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '20px 22px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <Detail label="Placed" value={new Date(order.createdAt).toLocaleString()} />
            <Detail label="Order ID" value={order.isGroupBuy ? (order.cartOrderCode || order.orderCode || order._id) : order._id} mono />
            {order.isGroupBuy && order.groupBuyStatus && <Detail label="Campaign Phase" value={order.groupBuyStatus.replace('-', ' ')} />}
          </div>

          <div>
            <p className="oc-section-title">Items</p>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
              {isGrouped && (order.lineItems || []).map((li, i) => {
                const cfg = li.configurations?.length > 0
                  ? li.configurations.map(c => `${c.name}: ${c.selected}`).join(' · ')
                  : null;
                const cancelled = li.status === 'Cancelled';
                return (
                  <div key={li._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', fontSize: '0.88rem', borderBottom: i < order.lineItems.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: cancelled ? 0.55 : 1 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {li.isAddon && (
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '6px', background: 'rgba(120,80,200,0.12)', color: 'rgb(120,80,200)' }}>Add-on</span>
                        )}
                        {li.addedAfterPurchase && (
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '6px', background: '#d4edda', color: '#155724' }}>Added</span>
                        )}
                        <span style={{ fontWeight: 500, textDecoration: cancelled ? 'line-through' : 'none' }}>{li.groupBuyName}</span>
                        <span style={{ color: 'var(--ink-muted)' }}>× {li.quantity}</span>
                      </div>
                      {li.selectedOption?.value && <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>{li.selectedOption.groupName}: {li.selectedOption.value}</div>}
                      {cfg && <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>{cfg}</div>}
                      <div style={{ marginTop: 4 }}><StatusBadge status={li.status} /></div>
                    </span>
                    <span style={{ fontWeight: 500, textDecoration: cancelled ? 'line-through' : 'none' }}>₱{li.totalPrice?.toLocaleString()}</span>
                  </div>
                );
              })}
              {!isGrouped && !order.isGroupBuy && (order.productsOrdered || []).map((item, i) => {
                const variant = item.variantAttributes && typeof item.variantAttributes === 'object' && !Array.isArray(item.variantAttributes)
                  ? Object.entries(item.variantAttributes).map(([k, v]) => `${k}: ${v}`).join(' · ')
                  : null;
                const cfg = !variant && item.configurations?.length > 0
                  ? item.configurations.map(c => `${c.name}: ${c.selected}`).join(' · ')
                  : null;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', fontSize: '0.88rem', borderBottom: i < order.productsOrdered.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: item.status === 'Cancelled' ? 0.55 : 1 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {item.addedAfterPurchase && (
                        <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '6px', background: '#d4edda', color: '#155724', marginRight: 8 }}>Added</span>
                      )}
                      <span style={{ fontWeight: 500, textDecoration: item.status === 'Cancelled' ? 'line-through' : 'none' }}>{item.productName}</span>
                      <span style={{ color: 'var(--ink-muted)' }}> × {item.quantity}</span>
                      {item.selectedOption?.value && <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>{item.selectedOption.groupName}: {item.selectedOption.value}</div>}
                      {(variant || cfg) && <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>{variant || cfg}</div>}
                    </span>
                    <span style={{ fontWeight: 500, textDecoration: item.status === 'Cancelled' ? 'line-through' : 'none' }}>₱{item.subtotal?.toLocaleString()}</span>
                  </div>
                );
              })}

              {!isGrouped && order.isGroupBuy && order.selectedOption?.value && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.88rem' }}>
                  <span><span style={{ fontWeight: 500 }}>{order.selectedOption.groupName}: {order.selectedOption.value}</span><span style={{ color: 'var(--ink-muted)' }}> × {order.quantity}</span></span>
                  <span style={{ fontWeight: 500 }}>₱{(order.selectedOption.price * order.quantity)?.toLocaleString()}</span>
                </div>
              )}
              {!isGrouped && order.isGroupBuy && order.kits?.length > 0 && order.kits.map((kit, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.88rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <span><span style={{ fontWeight: 500 }}>{kit.name}</span><span style={{ color: 'var(--ink-muted)' }}> × {kit.quantity}</span></span>
                  <span style={{ fontWeight: 500 }}>₱{(kit.price * kit.quantity)?.toLocaleString()}</span>
                </div>
              ))}
              {!isGrouped && order.isGroupBuy && order.configurations?.length > 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                  {order.configurations.map(c => `${c.name}: ${c.selected}`).join(' · ')}
                </p>
              )}
              {!isGrouped && order.isGroupBuy && order.notes?.trim() && (
                <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                  <strong style={{ color: 'var(--ink)' }}>Note:</strong> {order.notes}
                </p>
              )}

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.86rem' }}>
                <Row label="Subtotal" value={`₱${subtotal.toLocaleString()}`} muted />
                {isGrouped && groupedCancelledTotal > 0 && <Row label="Cancelled items" value={`−₱${groupedCancelledTotal.toLocaleString()}`} muted />}
                {!order.isGroupBuy && <Row label={order.shippingRegion ? `Shipping (${order.shippingRegion})` : 'Shipping'} value={`₱${shippingFee.toLocaleString()}`} muted />}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.95rem', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                  <span>Total</span>
                  <span>₱{(isGrouped ? groupedActiveTotal : order.totalPrice)?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {order.shippingAddress?.fullName && (
            <div>
              <p className="oc-section-title">Shipping to</p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', fontSize: '0.88rem', lineHeight: 1.5 }}>
                <p style={{ fontWeight: 500 }}>{order.shippingAddress.fullName}</p>
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>{order.shippingAddress.phone}</p>
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                  {order.shippingAddress.street}
                  {order.shippingAddress.street && <br />}
                  {[order.shippingAddress.city, order.shippingAddress.province, order.shippingAddress.postalCode || order.shippingAddress.zipCode].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}

          {order.billingAddress?.fullName && !sameAddress(order.shippingAddress, order.billingAddress) && (
            <div>
              <p className="oc-section-title">Billing to</p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', fontSize: '0.88rem', lineHeight: 1.5 }}>
                <p style={{ fontWeight: 500 }}>{order.billingAddress.fullName}</p>
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>{order.billingAddress.phone}</p>
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                  {order.billingAddress.street}<br />
                  {[order.billingAddress.city, order.billingAddress.province, order.billingAddress.postalCode].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`
        .order-card-header:hover { background: var(--bg-secondary); }
        .oc-section-title { font-size: 0.66rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 8px; }
        @media (max-width: 720px) {
          .order-card-header { grid-template-columns: auto auto 1fr auto !important; row-gap: 10px !important; }
        }
      `}</style>
    </div>
  );
}
