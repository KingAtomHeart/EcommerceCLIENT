import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function Placeholder() {
  const { theme } = useTheme();
  return (
    <div className="page-body" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - var(--nav-h))', padding: '40px var(--page-pad)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <img
          src={theme === 'dark' ? '/logo-white.svg' : '/logo-black.svg'}
          alt="Origami Keys"
          style={{ height: '120px', width: 'auto', marginBottom: '28px', display: 'inline-block' }}
        />
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