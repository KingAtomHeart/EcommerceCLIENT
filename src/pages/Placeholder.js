import { Link } from 'react-router-dom';

export default function Placeholder() {
  return (
    <div className="page-body" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - var(--nav-h))', padding: '40px var(--page-pad)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{
          fontFamily: "'DM Serif Display', serif", fontSize: '4rem',
          color: 'var(--accent)', marginBottom: '24px', lineHeight: 1,
        }}>
          ✦
        </div>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 'clamp(2rem, 4vw, 2.8rem)',
          letterSpacing: '-0.025em', marginBottom: '16px',
        }}>
          Something's <em style={{ color: 'var(--accent)' }}>brewing.</em>
        </h1>
        <p style={{
          color: 'var(--ink-muted)', fontSize: '1rem',
          lineHeight: 1.7, marginBottom: '36px',
        }}>
          We're working on something special for this space. Check back soon — we promise it'll be worth the wait.
        </p>
        <Link to="/products" className="btn-dark">
          <span>Browse the Shop →</span>
        </Link>
      </div>
    </div>
  );
}