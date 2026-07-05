import { useState } from 'react';
import emailjs from '@emailjs/browser';
import { apiFetch } from '../utils/api';

// EmailJS config — the PRIMARY delivery channel. Submissions are emailed
// straight to the shop's Gmail (via the EmailJS service connected to that
// inbox). All three values are PUBLIC client-side keys (that's how EmailJS is
// designed), so they're baked in as fallbacks. .env (REACT_APP_EMAILJS_*)
// overrides them, but the hardcoded defaults guarantee delivery works even in a
// build/dev-server that never loaded the .env values.
const EMAILJS_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID || 'service_281lukq';
const EMAILJS_TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID || 'template_31z3lg7';
const EMAILJS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || '997bhOz5U46sTWykZ';
// Only attempt the email channel once all three are present. Until the template
// id + public key are filled in, the form still works via the server log below.
const EMAILJS_READY = Boolean(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);

function ContactForm({ fields, submitLabel, formType, formLabel }) {
  const initial = fields.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {});
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Flatten the form into a normalized, template-friendly payload. `details` is
  // a ready-to-print list of every field so a single generic EmailJS template
  // covers both form types (and any future field) without edits. `reply_to`
  // lets the shop reply to the customer straight from Gmail.
  const buildEmailParams = () => {
    const emailField = fields.find(f => f.type === 'email');
    const nameField = fields.find(f => f.type === 'text' && f.required) || fields[0];
    const subjectField = fields.find(f => f.type === 'select');
    const details = fields.map(f => `${f.label}: ${form[f.name] || '—'}`).join('\n');
    const senderName = nameField ? form[nameField.name] : '';
    const senderEmail = emailField ? form[emailField.name] : '';
    const subject = `[${formLabel || formType}]${subjectField && form[subjectField.name] ? ` ${form[subjectField.name]}` : ''}`;

    // Escape sender-supplied text: details_html is injected into the email via a
    // triple-brace ({{{details_html}}}) unescaped Handlebars var, so raw markup
    // in a submission must be neutralized to prevent HTML/style injection.
    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // Structured field rows so the template can contrast the muted field LABELS
    // against the sender-filled VALUES. Labels come from our config (trusted),
    // values are escaped. The message/textarea keeps its line breaks.
    const detailsHtml =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' +
      fields.map((f, i) => {
        const raw = form[f.name];
        const isMsg = f.type === 'textarea';
        const value = raw
          ? `<div style="color:#1a1a18; font-size:15px; line-height:1.65;${isMsg ? ' white-space:pre-line;' : ''}">${esc(raw)}</div>`
          : '<div style="color:#c4c1b8; font-size:15px;">—</div>';
        const divider = i < fields.length - 1 ? 'border-bottom:1px solid #eeede8;' : '';
        return `<tr><td style="padding:12px 0;${divider}">` +
          `<div style="color:#9a978f; font-size:11px; font-weight:700; letter-spacing:1.3px; text-transform:uppercase; margin-bottom:4px;">${esc(f.label)}</div>` +
          value + '</td></tr>';
      }).join('') +
      '</table>';

    // Sort fields by role so the template can make the inquiry CONTENT the hero
    // (subject heading, order badge, message card) and push the sender's contact
    // info to a secondary "side" panel. Heuristic, works for both form types:
    //   message  = the textarea      subject/type = the select
    //   order    = a text field whose name/label mentions "order"
    //   contact  = everything else (names, emails, company)
    const messageField = fields.find(f => f.type === 'textarea');
    const selectField = fields.find(f => f.type === 'select');
    const orderField = fields.find(f => /order/i.test(f.name) || /order/i.test(f.label));
    const contactFields = fields.filter(f => f !== messageField && f !== selectField && f !== orderField);

    const inquiryTypeLabel = selectField ? selectField.label : 'Subject';
    const inquiryType = selectField ? (form[selectField.name] || '—') : '';
    const messageValue = messageField ? (form[messageField.name] || '') : (form.message || '');

    // Order badge — empty string when the form has no order field/value, so the
    // template (Handlebars has no inline conditionals here) renders nothing.
    const orderValue = orderField ? form[orderField.name] : '';
    const orderHtml = orderValue
      ? `<div style="display:inline-block; background:#d6ebe3; color:#2e5d4b; font-size:12px; font-weight:700; letter-spacing:0.4px; padding:6px 15px; border-radius:50px;">${esc(orderField.label)}: ${esc(orderValue)}</div>`
      : '';

    // Pre-filled subject for the admin's "Reply to" mailto button: the inquiry
    // type plus the order number when present. URL-encoded so it drops straight
    // into the href (encodeURIComponent output has no HTML-special chars, so the
    // {{reply_subject}} double-brace won't alter it).
    const replyCore = (selectField && form[selectField.name]) ? form[selectField.name] : (formLabel || formType);
    const replySubject = encodeURIComponent(`Re: ${replyCore}${orderValue ? ` — Order #${orderValue}` : ''}`);

    // Secondary "who sent it" block — compact label/value rows for the side panel.
    const contactHtml = contactFields.map(f => {
      const v = form[f.name];
      return '<div style="margin-bottom:14px;">' +
        `<div style="color:#9a978f; font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; margin-bottom:2px;">${esc(f.label)}</div>` +
        `<div style="color:#1a1a18; font-size:14px; line-height:1.5; word-break:break-word;">${v ? esc(v) : '—'}</div>` +
        '</div>';
    }).join('');

    return {
      // EmailJS default template variable names (match the {{name}}/{{email}}/
      // {{title}}/{{message}} placeholders a new template ships with).
      name: senderName,
      email: senderEmail,
      title: subject,
      message: messageValue,
      // Descriptive aliases, in case the template uses these instead.
      form_type: formLabel || formType,
      subject,
      from_name: senderName,
      reply_to: senderEmail,
      details,          // plain-text fallback
      details_html: detailsHtml, // full styled list — {{{details_html}}}
      // Role-sorted pieces for the priority layout (order/subject = hero,
      // contact = side panel). HTML pieces are unescaped → {{{ }}}.
      inquiry_type_label: inquiryTypeLabel,
      inquiry_type: inquiryType,
      order_html: orderHtml,
      contact_html: contactHtml,
      reply_subject: replySubject,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Primary channel: email the inquiry straight to the shop's Gmail.
    let emailOk = false;
    if (EMAILJS_READY) {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, buildEmailParams(), { publicKey: EMAILJS_PUBLIC_KEY });
        emailOk = true;
      } catch (err) {
        console.error('EmailJS send failed:', err);
      }
    }

    // Secondary channel: keep a copy in the site's message log (ContactAdmin).
    // Best-effort — a failure here doesn't hide a successful email.
    let saveOk = false;
    try {
      await apiFetch('/contact', {
        method: 'POST',
        body: JSON.stringify({ formType, fields: form }),
      });
      saveOk = true;
    } catch (err) {
      console.error('Contact log save failed:', err);
    }

    if (emailOk || saveOk) {
      setSubmitted(true);
      setForm(initial);
    } else {
      setError('Something went wrong sending your message. Please try again, or email us directly.');
    }
    setLoading(false);
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
          formLabel={tab.label}
        />
      </div>
    </div>
  );
}
