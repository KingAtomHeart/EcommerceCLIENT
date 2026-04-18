import { useState } from 'react';
import { apiFetch } from '../utils/api';

function ContactForm({ title, subtitle, fields, submitLabel, formType }) {
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

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '32px',
      background: 'var(--bg)',
    }}>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.4rem', marginBottom: '6px', color: 'var(--ink)' }}>{title}</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '24px', lineHeight: 1.6 }}>{subtitle}</p>

      {submitted ? (
        <div style={{
          padding: '16px 20px',
          background: 'var(--accent-light)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--accent)',
          fontSize: '0.88rem',
          fontWeight: 500,
        }}>
          Thank you! We'll get back to you soon.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#fff0f0',
              border: '1px solid #f5c6c6',
              borderRadius: 'var(--radius-sm)',
              color: '#c0392b',
              fontSize: '0.85rem',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}
          {fields.map((field) => (
            <div key={field.name} className="form-group">
              <label className="form-label">
                {field.label}{field.required ? '' : <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}> (optional)</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  className="form-input"
                  required={field.required}
                  value={form[field.name]}
                  onChange={set(field.name)}
                  placeholder={field.placeholder || ''}
                  rows={4}
                  style={{ resize: 'vertical', minHeight: '100px' }}
                />
              ) : field.type === 'select' ? (
                <select
                  className="form-input"
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
            style={{ marginTop: '8px', width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}
          >
            <span>{loading ? 'Sending...' : submitLabel}</span>
          </button>
        </form>
      )}
    </div>
  );
}

export default function Contact() {
  return (
    <div style={{ padding: '64px var(--page-pad) 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          color: 'var(--ink)',
          marginBottom: '12px',
        }}>
          Contact Us
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--ink-muted)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
          Whether you're a customer or a potential partner, we'd love to hear from you.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '28px',
        maxWidth: '960px',
        margin: '0 auto',
      }}>
        <ContactForm
          title="Customer Support"
          subtitle="Need help with an order, product, or shipping? Fill out the form and we'll get back to you."
          submitLabel="Send Message"
          formType="support"
          fields={[
            { name: 'fullName', label: 'Full Name', type: 'text', required: true },
            { name: 'email', label: 'Email Address', type: 'email', required: true },
            { name: 'orderNumber', label: 'Order Number', type: 'text', required: false, placeholder: 'If applicable' },
            {
              name: 'subject', label: 'Subject', type: 'select', required: true,
              options: ['Order Issue', 'Product Question', 'Shipping & Delivery', 'Returns & Refunds', 'Other'],
            },
            { name: 'message', label: 'Message', type: 'textarea', required: true },
          ]}
        />

        <ContactForm
          title="Business Inquiries"
          subtitle="Interested in wholesale, partnerships, or collaborations? Reach out and let's talk."
          submitLabel="Submit Inquiry"
          formType="business"
          fields={[
            { name: 'contactName', label: 'Contact Name', type: 'text', required: true },
            { name: 'company', label: 'Company / Organization', type: 'text', required: true },
            { name: 'businessEmail', label: 'Business Email', type: 'email', required: true },
            {
              name: 'inquiryType', label: 'Inquiry Type', type: 'select', required: true,
              options: ['Wholesale', 'Partnership / Collaboration', 'Custom Orders', 'Press / Media', 'Other'],
            },
            { name: 'message', label: 'Message', type: 'textarea', required: true },
          ]}
        />
      </div>

      <style>{`
        @media (max-width: 767px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
