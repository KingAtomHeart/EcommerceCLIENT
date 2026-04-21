import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!orderId) { setStatus('error'); return; }

    let attempts = 0;
    const poll = async () => {
      try {
        const data = await apiFetch(`/orders/payment-status/${orderId}`);
        if (data.order.paymentStatus === 'paid') {
          setStatus('paid');
        } else if (attempts < 10) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setStatus('pending');
        }
      } catch {
        setStatus('error');
      }
    };

    poll();
  }, [orderId]);

  return (
    <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - var(--nav-h))', padding: '40px var(--page-pad)' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        {status === 'loading' && (
          <>
            <div className="spinner" style={{ margin: '0 auto 24px' }} />
            <p style={{ color: 'var(--ink-muted)' }}>Confirming your payment…</p>
          </>
        )}

        {status === 'paid' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✓</div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', marginBottom: '12px' }}>Payment Successful!</h1>
            <p style={{ color: 'var(--ink-muted)', marginBottom: '32px' }}>Your order has been confirmed. We'll process it shortly.</p>
            <Link to="/order-history" className="btn-dark"><span>View My Orders</span></Link>
          </>
        )}

        {status === 'pending' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', marginBottom: '12px' }}>Payment Received</h1>
            <p style={{ color: 'var(--ink-muted)', marginBottom: '32px' }}>Your payment is being verified. Your order will appear in order history shortly.</p>
            <Link to="/order-history" className="btn-dark"><span>View My Orders</span></Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✕</div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', marginBottom: '12px' }}>Something went wrong</h1>
            <p style={{ color: 'var(--ink-muted)', marginBottom: '32px' }}>If you completed payment, check your order history. Otherwise, try again.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link to="/order-history" className="btn-dark"><span>My Orders</span></Link>
              <Link to="/cart" style={{ color: 'var(--ink-muted)', alignSelf: 'center', fontSize: '0.9rem' }}>Back to Cart</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
