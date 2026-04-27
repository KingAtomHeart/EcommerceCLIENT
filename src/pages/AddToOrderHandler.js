import { useEffect, useContext, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import UserContext from '../context/UserContext';
import AddToOrderContext from '../context/AddToOrderContext';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

export default function AddToOrderHandler() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const { setToken } = useContext(AddToOrderContext);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    apiFetch(`/orders/add-link/${token}`)
      .then(info => {
        setToken(token, info);
        toast.success(`Adding to ${info.targetLabel}. Browse below.`);
        // Send GB-cart links to /group-buys, in-stock to /products
        navigate(info.type === 'gb-cart' ? '/group-buys' : '/products', { replace: true });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, user, setToken, navigate]);

  if (!user) {
    return (
      <div className="page-body" style={{ padding: '64px var(--page-pad)', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-muted)', marginBottom: 16 }}>Please sign in to use this add-to-order link.</p>
        <Link to={`/login?next=${encodeURIComponent(`/add-to-order/${token}`)}`} className="btn-dark"><span>Sign In</span></Link>
      </div>
    );
  }
  if (loading) return <div className="page-body loading-center"><div className="spinner" /></div>;
  if (error) {
    return (
      <div className="page-body" style={{ padding: '64px var(--page-pad)', textAlign: 'center' }}>
        <p style={{ color: '#c0392b', marginBottom: 12, fontWeight: 500 }}>Add-to-order link error</p>
        <p style={{ color: 'var(--ink-muted)', marginBottom: 20 }}>{error}</p>
        <Link to="/products" className="btn-dark"><span>Continue Shopping</span></Link>
      </div>
    );
  }
  return null;
}
