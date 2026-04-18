import { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

export default function Login() {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [reg, setReg] = useState({ firstName: '', lastName: '', email: '', mobileNo: '', password: '' });
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Redirect if already logged in — must use Navigate component, not navigate()
  if (user?.id) return <Navigate to="/products" replace />;

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiFetch('/users/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('token', data.access);
      const profile = await apiFetch('/users/details');
      const u = profile.user;
      const userData = { id: u._id, isAdmin: u.isAdmin, firstName: u.firstName, lastName: u.lastName, email: u.email, mobileNo: u.mobileNo };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      toast.success('Welcome back!');
      navigate('/products');
    } catch (err) {
      toast.error(err.message);
    } finally { setSubmitting(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegSubmitting(true);
    try {
      await apiFetch('/users/register', {
        method: 'POST', body: JSON.stringify(reg),
      });
      toast.success('Account created! Please sign in.');
      setTab('login');
      setEmail(reg.email);
      setReg({ firstName: '', lastName: '', email: '', mobileNo: '', password: '' });
    } catch (err) {
      toast.error(err.message);
    } finally { setRegSubmitting(false); }
  };

  const setR = (k) => (e) => setReg(r => ({ ...r, [k]: e.target.value }));

  return (
    <div className="page-body" style={{ display: 'flex', justifyContent: 'center', padding: '64px var(--page-pad) 80px' }}>
      <div className="auth-card">
        <div className="auth-logo">Origami <span>Keys</span></div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', letterSpacing: '-0.025em', marginBottom: '8px' }}>My Account</h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: '36px', lineHeight: 1.55 }}>
          Sign in or create an account to track orders and save your preferences.
        </p>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Register</button>
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ animation: 'fadeIn 0.25s ease' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button type="submit" className="btn-dark" disabled={submitting || !email || !password} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              <span>{submitting ? 'Signing in…' : 'Sign In'}</span>
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} style={{ animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input type="text" className="form-input" placeholder="Jane" required value={reg.firstName} onChange={setR('firstName')} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input type="text" className="form-input" placeholder="Doe" required value={reg.lastName} onChange={setR('lastName')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="you@example.com" required value={reg.email} onChange={setR('email')} autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile No.</label>
              <input type="text" className="form-input" placeholder="09XXXXXXXXX" required maxLength="11" value={reg.mobileNo} onChange={setR('mobileNo')} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="Min. 8 characters" required value={reg.password} onChange={setR('password')} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn-dark" disabled={regSubmitting} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              <span>{regSubmitting ? 'Creating…' : 'Create Account'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}