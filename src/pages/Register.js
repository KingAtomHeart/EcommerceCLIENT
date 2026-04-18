import { useState, useContext } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

export default function Register() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', mobileNo: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);

  if (user?.id) return <Navigate to="/" />;

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const isValid = form.firstName && form.lastName && form.email && form.mobileNo.length === 11 && form.password.length >= 8 && form.password === form.confirmPassword;

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    try {
      await apiFetch('/users/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName,
          email: form.email, mobileNo: form.mobileNo, password: form.password,
        }),
      });
      toast.success('Registration successful! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-body" style={{ display: 'flex', justifyContent: 'center', padding: '64px var(--page-pad) 80px' }}>
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', marginBottom: '32px' }}>
          Origami <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Keys</span>
        </div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', letterSpacing: '-0.025em', marginBottom: '8px' }}>Create Account</h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: '36px', lineHeight: 1.55 }}>
          Join the community. Track orders and save your preferences.
        </p>

        <form onSubmit={handleRegister}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input type="text" className="form-input" placeholder="Jane" required value={form.firstName} onChange={set('firstName')} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input type="text" className="form-input" placeholder="Doe" required value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="you@example.com" required value={form.email} onChange={set('email')} />
          </div>
          <div className="form-group">
            <label className="form-label">Mobile No.</label>
            <input type="text" className="form-input" placeholder="09XXXXXXXXX" required maxLength="11" value={form.mobileNo} onChange={set('mobileNo')} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="Min. 8 characters" required value={form.password} onChange={set('password')} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input type="password" className="form-input" placeholder="Repeat password" required value={form.confirmPassword} onChange={set('confirmPassword')} />
          </div>
          {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
            <p style={{ color: '#c0392b', fontSize: '0.82rem', marginBottom: '12px' }}>Passwords do not match.</p>
          )}
          <button type="submit" className="btn-dark" disabled={submitting || !isValid} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
            <span>{submitting ? 'Creating...' : 'Create Account'}</span>
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
