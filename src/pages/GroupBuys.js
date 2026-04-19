import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import GroupBuyCard from '../components/GroupBuyCard';

export default function GroupBuys() {
  const [gbs, setGbs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/group-buys/active')
      .then(data => setGbs(Array.isArray(data) ? data : []))
      .catch(() => setGbs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-body" style={{ padding: '56px var(--page-pad) 80px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.8rem', letterSpacing: '-0.025em', marginBottom: '8px' }}>Group Buys</h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.95rem', maxWidth: 520 }}>
          Join a group buy to get exclusive keyboards at production pricing. Orders are collected, then manufactured together.
        </p>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : gbs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '1rem', marginBottom: '8px' }}>No group buys right now.</p>
          <p style={{ fontSize: '0.84rem' }}>Check back soon or browse our in-stock products.</p>
          <Link to="/products" className="btn-dark" style={{ marginTop: '20px', display: 'inline-flex' }}><span>Shop In Stock</span></Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {gbs.map(gb => <GroupBuyCard key={gb._id} gb={gb} />)}
        </div>
      )}
    </div>
  );
}