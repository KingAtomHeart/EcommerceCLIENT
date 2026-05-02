import { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';

const STATUS_CLASS = { new: 'amber', read: 'blue', resolved: 'green' };

function relativeTime(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Initials({ name, size = 36 }) {
  const letters = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent-light)', color: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: size * 0.38,
    }}>
      {letters}
    </div>
  );
}

function Caret({ open }) {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, color: 'var(--ink-faint)' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function MessageCard({ msg, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const changeStatus = async (status) => {
    setUpdating(true);
    try {
      const updated = await apiFetch(`/contact/${msg._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onStatusChange(updated);
    } finally {
      setUpdating(false);
    }
  };

  const fields = msg.fields instanceof Map ? Object.fromEntries(msg.fields) : (msg.fields || {});
  const isSupport = msg.formType === 'support';

  const name = fields.fullName || fields.contactName || '—';
  const email = fields.email || fields.businessEmail || '';
  const subject = fields.subject || fields.inquiryType || '';
  const message = fields.message || '';
  const orderNumber = fields.orderNumber || '';
  const company = fields.company || '';

  const isNew = msg.status === 'new';
  const accentColor = isNew ? 'var(--accent)' : msg.status === 'read' ? 'var(--ink-faint)' : 'var(--accent)';

  const metaFields = Object.entries(fields).filter(
    ([k]) => !['fullName', 'contactName', 'email', 'businessEmail', 'message', 'subject', 'inquiryType', 'orderNumber', 'company'].includes(k)
  );

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: isNew ? '3px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      opacity: msg.status === 'resolved' ? 0.75 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          gap: '14px', alignItems: 'center',
          padding: '14px 18px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          fontFamily: 'inherit', color: 'var(--ink)',
        }}
      >
        <Initials name={name} />

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontWeight: isNew ? 600 : 500, fontSize: '0.9rem' }}>{name}</span>
            <span className={`status-badge status-${STATUS_CLASS[msg.status] || 'gray'}`}>
              {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
            </span>
            <span style={{
              fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 'var(--radius-pill)',
              background: 'var(--bg-secondary)', color: 'var(--ink-faint)',
              border: '1px solid var(--border)',
            }}>
              {isSupport ? 'Support' : 'Business'}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span>{email}</span>
            {subject && <><span>·</span><span style={{ color: 'var(--ink)', fontWeight: 500 }}>{subject}</span></>}
          </div>
          {!open && message && (
            <div style={{
              fontSize: '0.8rem', color: 'var(--ink-faint)', marginTop: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '600px',
            }}>
              {message.length > 120 ? message.slice(0, 120) + '…' : message}
            </div>
          )}
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
          {relativeTime(msg.createdAt)}
        </span>
        <Caret open={open} />
      </button>

      {/* ── Expanded ── */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Metadata row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 3 }}>From</p>
              <p style={{ fontSize: '0.88rem' }}>{name}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{email}</p>
            </div>
            {subject && (
              <div>
                <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 3 }}>
                  {isSupport ? 'Subject' : 'Inquiry Type'}
                </p>
                <p style={{ fontSize: '0.88rem' }}>{subject}</p>
              </div>
            )}
            {company && (
              <div>
                <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 3 }}>Company</p>
                <p style={{ fontSize: '0.88rem' }}>{company}</p>
              </div>
            )}
            {orderNumber && (
              <div>
                <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 3 }}>Order #</p>
                <p style={{ fontSize: '0.88rem', fontFamily: 'monospace' }}>{orderNumber}</p>
              </div>
            )}
            <div>
              <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 3 }}>Received</p>
              <p style={{ fontSize: '0.88rem' }}>{new Date(msg.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Message body */}
          {message && (
            <div>
              <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>Message</p>
              <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '14px 16px',
                fontSize: '0.88rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                color: 'var(--ink)',
              }}>
                {message}
              </div>
            </div>
          )}

          {/* Extra fields not shown above */}
          {metaFields.length > 0 && (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {metaFields.map(([k, v]) => v && (
                <div key={k}>
                  <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 3 }}>
                    {k.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p style={{ fontSize: '0.88rem' }}>{v}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            {['new', 'read', 'resolved'].filter(s => s !== msg.status).map(s => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={updating}
                style={{
                  padding: '6px 16px', borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--ink-muted)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 500,
                  cursor: 'pointer', opacity: updating ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink-muted)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-muted)'; }}
              >
                Mark as {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactAdmin() {
  const { user } = useContext(UserContext);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    apiFetch('/contact')
      .then(d => setMessages(Array.isArray(d) ? d : []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, []);

  if (!user?.isAdmin) return <Navigate to="/products" />;

  const handleStatusChange = (updated) => {
    setMessages(prev => prev.map(m => m._id === updated._id ? updated : m));
  };

  const filtered = filter === 'all' ? messages : messages.filter(m => m.status === filter);
  const counts = messages.reduce((acc, m) => ({ ...acc, [m.status]: (acc[m.status] || 0) + 1 }), {});
  const newCount = counts.new || 0;

  return (
    <div style={{ padding: '56px var(--page-pad) 80px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.2rem', letterSpacing: '-0.025em', marginBottom: 4 }}>
            Messages
          </h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem' }}>
            {messages.length} total
            {newCount > 0 && (
              <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                  display: 'inline-block',
                }} />
                {newCount} unread
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'new', 'read', 'resolved'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px', borderRadius: 'var(--radius-pill)',
              border: '1px solid',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              color: filter === f ? '#fff' : 'var(--ink-muted)',
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && counts[f] ? (
              <span style={{
                marginLeft: 6, fontSize: '0.7rem', fontWeight: 600,
                background: filter === f ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                color: filter === f ? '#fff' : 'var(--ink-faint)',
                padding: '1px 6px', borderRadius: '10px',
              }}>{counts[f]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 20px', color: 'var(--ink-muted)',
          background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        }}>
          {filter === 'all' ? 'No messages yet.' : `No ${filter} messages.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(msg => (
            <MessageCard key={msg._id} msg={msg} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
