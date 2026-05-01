import { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';

const STATUS_COLORS = {
  new: { bg: '#fff8e1', border: '#f5c842', color: '#7a5c00' },
  read: { bg: '#e8f4fd', border: '#7ab8e8', color: '#1a4f7a' },
  resolved: { bg: '#edf7ed', border: '#6dbf6d', color: '#1e5c1e' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.new;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
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

  const fields = msg.fields instanceof Map ? Object.fromEntries(msg.fields) : msg.fields;

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>
              {fields.fullName || fields.contactName || '—'}
            </span>
            <StatusBadge status={msg.status} />
            <span style={{
              fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px',
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-muted)',
            }}>
              {msg.formType === 'support' ? 'Customer Support' : 'Business Inquiry'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
            {fields.email || fields.businessEmail} &middot; {new Date(msg.createdAt).toLocaleString()}
          </div>
        </div>
        <span style={{ color: 'var(--ink-faint)', fontSize: '1.1rem' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
            {Object.entries(fields).map(([k, v]) => v && (
              <div key={k}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
            {['new', 'read', 'resolved'].filter(s => s !== msg.status).map(s => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={updating}
                className="btn-dark"
                style={{ padding: '6px 16px', fontSize: '0.82rem', opacity: updating ? 0.6 : 1 }}
              >
                <span>Mark as {s.charAt(0).toUpperCase() + s.slice(1)}</span>
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

  return (
    <div style={{ padding: '56px var(--page-pad) 80px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.4rem', letterSpacing: '-0.025em', marginBottom: '6px' }}>
          Contact Messages
        </h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
          {messages.length} total &middot; {counts.new || 0} new
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['all', 'new', 'read', 'resolved'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 500,
              cursor: 'pointer', border: '1px solid var(--border)',
              background: filter === f ? 'var(--ink)' : 'var(--bg)',
              color: filter === f ? 'var(--bg)' : 'var(--ink)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && counts[f] ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)',
          background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        }}>
          No messages{filter !== 'all' ? ` with status "${filter}"` : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(msg => (
            <MessageCard key={msg._id} msg={msg} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
