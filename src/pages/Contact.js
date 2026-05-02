import { useState } from 'react';
import { apiFetch } from '../utils/api';

function ContactForm({ fields, submitLabel, formType }) {
  const initial = fields.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {});
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiFetch('/contact', {
        method: 'POST',
        body: JSON.stringify({ formType, fields: form }),
      });
      setSubmitted(true);
      setForm(initial);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{
        padding: '32px', textAlign: 'center',
        background: 'var(--accent-light)', border: '1px solid var(--accent)',
        borderRadius: 'var(--radius-sm)',
      }}>
        <svg width="40" height="40" fill="none" stroke="var(--accent)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 14px' }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.2rem', color: 'var(--accent)', marginBottom: 6 }}>Message sent!</p>
        <p style={{ fontSize: '0.88rem', color: 'var(--accent)', opacity: 0.8 }}>We'll get back to you as soon as possible.</p>
        <button
          onClick={() => setSubmitted(false)}
          style={{ marginTop: 18, fontSize: '0.82rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          color: '#c0392b', fontSize: '0.85rem', marginBottom: 16,
        }}>
          {error}
        </div>
      )}
      {fields.map((field) => (
        <div key={field.name} className="form-group">
          <label className="form-label">
            {field.label}
            {!field.required && <span style={{ color: 'var(--ink-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — optional</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              className="form-input"
              required={field.required}
              value={form[field.name]}
              onChange={set(field.name)}
              placeholder={field.placeholder || ''}
              rows={5}
              style={{ resize: 'vertical', minHeight: '110px' }}
            />
          ) : field.type === 'select' ? (
            <select
              className="form-input form-select"
              required={field.required}
              value={form[field.name]}
              onChange={set(field.name)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">Select...</option>
              {field.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={field.type || 'text'}
              className="form-input"
              required={field.required}
              value={form[field.name]}
              onChange={set(field.name)}
              placeholder={field.placeholder || ''}
            />
          )}
        </div>
      ))}
      <button
        type="submit"
        className="btn-dark"
        disabled={loading}
        style={{ marginTop: 8, width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}
      >
        <span>{loading ? 'Sending…' : submitLabel}</span>
      </button>
    </form>
  );
}

const TABS = [
  {
    key: 'support',
    label: 'Customer Support',
    eyebrow: 'For customers',
    description: 'Questions about your order, shipping, returns, or products? We\'re here to help.',
    submitLabel: 'Send Message',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'orderNumber', label: 'Order Number', type: 'text', required: false, placeholder: 'If applicable' },
      {
        name: 'subject', label: 'Subject', type: 'select', required: true,
        options: ['Order Issue', 'Product Question', 'Shipping & Delivery', 'Returns & Refunds', 'Other'],
      },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
    ],
  },
  {
    key: 'business',
    label: 'Business Inquiry',
    eyebrow: 'For partners & brands',
    description: 'Interested in running a group buy, wholesale, or a collaboration through our platform?',
    submitLabel: 'Submit Inquiry',
    fields: [
      { name: 'contactName', label: 'Contact Name', type: 'text', required: true },
      { name: 'company', label: 'Company / Organization', type: 'text', required: true },
      { name: 'businessEmail', label: 'Business Email', type: 'email', required: true },
      {
        name: 'inquiryType', label: 'Inquiry Type', type: 'select', required: true,
        options: ['Wholesale', 'Partnership / Collaboration', 'Custom Orders', 'Press / Media', 'Other'],
      },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
    ],
  },
];

export default function Contact() {
  const [activeTab, setActiveTab] = useState('support');
  const tab = TABS.find(t => t.key === activeTab);

  return (
    <div style={{ padding: '64px var(--page-pad) 80px' }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          letterSpacing: '-0.025em', marginBottom: 12,
        }}>
          Get in Touch
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--ink-muted)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>
          Whether you need help with an order or want to work with us — let us know what you need.
        </p>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* ── Tab switcher ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 10, marginBottom: 32,
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                border: activeTab === t.key ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                background: activeTab === t.key ? 'var(--accent-light)' : 'var(--surface)',
                textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              <p style={{
                fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: activeTab === t.key ? 'var(--accent)' : 'var(--ink-faint)',
                marginBottom: 4,
              }}>
                {t.eyebrow}
              </p>
              <p style={{
                fontSize: '0.92rem', fontWeight: 600,
                color: activeTab === t.key ? 'var(--accent)' : 'var(--ink)',
              }}>
                {t.label}
              </p>
            </button>
          ))}
        </div>

        {/* ── Description ── */}
        <p style={{
          fontSize: '0.9rem', color: 'var(--ink-muted)', lineHeight: 1.65,
          marginBottom: 24, paddingBottom: 24,
          borderBottom: '1px solid var(--border)',
        }}>
          {tab.description}
        </p>

        {/* ── Form ── */}
        <ContactForm
          key={activeTab}
          fields={tab.fields}
          submitLabel={tab.submitLabel}
          formType={tab.key}
        />
      </div>
    </div>
  );
}
