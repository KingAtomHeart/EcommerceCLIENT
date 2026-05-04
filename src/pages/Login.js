import { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

export default function Login() {
  const { user, loading: authLoading, setUser } = useContext(UserContext);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [reg, setReg] = useState({ firstName: '', lastName: '', email: '', mobileNo: '', password: '' });
  const [regSubmitting, setRegSubmitting] = useState(false);

  const googleBtnRef = useRef(null);
  const [needsMobile, setNeedsMobile] = useState(false);
  const [mobileNo, setMobileNo] = useState('');
  const [mobileSubmitting, setMobileSubmitting] = useState(false);

  const signInWithGoogleCredential = useCallback(async (credential) => {
    try {
      const data = await apiFetch('/users/google-login', {
        method: 'POST', body: JSON.stringify({ credential }),
      });
      localStorage.setItem('token', data.access);
      const profile = await apiFetch('/users/details');
      const u = profile.user;
      const userData = { id: u._id, isAdmin: u.isAdmin, firstName: u.firstName, lastName: u.lastName, email: u.email, mobileNo: u.mobileNo, profilePicture: u.profilePicture || "" };
      localStorage.setItem('user', JSON.stringify(userData));
      if (!u.mobileNo) {
        setNeedsMobile(true);
        toast.success('Welcome! One more step.');
        return;
      }
      setUser(userData);
      toast.success('Welcome!');
      navigate('/products');
    } catch (err) {
      toast.error(err.message || 'Google sign-in failed');
    }
  }, [setUser, navigate]);

  const submitMobile = async (e) => {
    e.preventDefault();
    setMobileSubmitting(true);
    try {
      const data = await apiFetch('/users/update-mobile', {
        method: 'PATCH', body: JSON.stringify({ mobileNo }),
      });
      const u = data.user;
      const userData = { id: u._id, isAdmin: u.isAdmin, firstName: u.firstName, lastName: u.lastName, email: u.email, mobileNo: u.mobileNo, profilePicture: u.profilePicture || "" };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      toast.success('All set!');
      navigate('/products');
    } catch (err) {
      toast.error(err.message || 'Failed to save mobile number');
    } finally { setMobileSubmitting(false); }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => { if (resp?.credential) signInWithGoogleCredential(resp.credential); },
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 364,
      });
    };

    if (window.google?.accounts?.id) {
      render();
    } else if (!document.querySelector(`script[src="${GSI_SRC}"]`)) {
      const s = document.createElement('script');
      s.src = GSI_SRC; s.async = true; s.defer = true; s.onload = render;
      document.head.appendChild(s);
    } else {
      const id = setInterval(() => { if (window.google?.accounts?.id) { clearInterval(id); render(); } }, 100);
      setTimeout(() => clearInterval(id), 5000);
    }

    return () => { cancelled = true; };
  }, [tab, signInWithGoogleCredential]);

  // Wait for auth to resolve before redirecting logged-in users
  if (authLoading) return null;
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
      const userData = { id: u._id, isAdmin: u.isAdmin, firstName: u.firstName, lastName: u.lastName, email: u.email, mobileNo: u.mobileNo, profilePicture: u.profilePicture || "" };
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
        <img
          src={theme === 'dark' ? '/logo-white.svg' : '/logo-black.svg'}
          alt="Origami Keys"
          style={{ height: '52px', width: 'auto', display: 'block', margin: '0 auto 20px' }}
        />
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', letterSpacing: '-0.025em', marginBottom: '8px', textAlign: 'center' }}>My Account</h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: '36px', lineHeight: 1.55, textAlign: 'center' }}>
          Sign in or create an account to track orders and save your preferences.
        </p>

        {needsMobile ? (
          <form onSubmit={submitMobile} style={{ animation: 'fadeIn 0.25s ease' }}>
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.55 }}>
              We need your mobile number to complete your orders.
            </p>
            <div className="form-group">
              <label className="form-label">Mobile No.</label>
              <input type="text" className="form-input" placeholder="09XXXXXXXXX" required maxLength="11" value={mobileNo} onChange={e => setMobileNo(e.target.value.replace(/\D/g, ''))} autoFocus />
            </div>
            <button type="submit" className="btn-dark" disabled={mobileSubmitting || mobileNo.length !== 11} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              <span>{mobileSubmitting ? 'Saving…' : 'Continue'}</span>
            </button>
          </form>
        ) : (
        <>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Register</button>
        </div>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="google-btn-wrap">
              <button type="button" className="google-btn" tabIndex={-1}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
              <div ref={googleBtnRef} className="google-btn-gsi" />
            </div>
            <div className="auth-divider">
              <div />
              <span>or</span>
              <div />
            </div>
          </>
        )}

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
            <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
        </>
        )}
      </div>
    </div>
  );
}