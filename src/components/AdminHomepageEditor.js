import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

function relativeTime(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const LAYOUTS = [
  { value: 'split', label: 'Split', desc: 'Text left, image right' },
  { value: 'overlay', label: 'Overlay', desc: 'Text over full image' },
  { value: 'stacked', label: 'Stacked', desc: 'Image top, text below' },
  { value: 'fullbleed', label: 'Full Bleed', desc: 'Edge-to-edge image' },
];

export default function AdminHomepageEditor() {
  const [doc, setDoc] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const heroFileRef = useRef(null);
  const bannerFileRef = useRef(null);

  const fetchContent = () => {
    apiFetch('/homepage')
      .then(d => { setDoc(d); setForm(d); })
      .catch(() => toast.error('Failed to load homepage content'));
  };

  useEffect(() => { fetchContent(); }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        heroEyebrow: form.heroEyebrow,
        heroTitle: form.heroTitle,
        heroSubtitle: form.heroSubtitle,
        heroPrimaryCtaLabel: form.heroPrimaryCtaLabel,
        heroPrimaryCtaLink: form.heroPrimaryCtaLink,
        heroSecondaryCtaLabel: form.heroSecondaryCtaLabel,
        heroSecondaryCtaLink: form.heroSecondaryCtaLink,
        bannerEyebrow: form.bannerEyebrow,
        bannerTitle: form.bannerTitle,
        bannerSubtitle: form.bannerSubtitle,
        bannerCtaLabel: form.bannerCtaLabel,
        bannerCtaLink: form.bannerCtaLink,
        bannerLayout: form.bannerLayout,
      };
      const updated = await apiFetch('/homepage', { method: 'PATCH', body: JSON.stringify(payload) });
      setDoc(updated);
      setForm(updated);
      toast.success('Homepage updated');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadHeroImages = async (files) => {
    const fd = new FormData();
    for (const f of files) fd.append('images', f);
    try {
      await apiFetch('/homepage/hero-images', { method: 'POST', body: fd });
      fetchContent();
      toast.success('Images uploaded');
    } catch { toast.error('Upload failed'); }
  };

  const deleteHeroImage = async (id) => {
    try {
      await apiFetch(`/homepage/hero-images/${id}`, { method: 'DELETE' });
      fetchContent();
      toast.success('Image removed');
    } catch { toast.error('Delete failed'); }
  };

  const reorderHeroImages = async (images) => {
    try {
      await apiFetch('/homepage/hero-images/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ imageIds: images.map(i => i._id) }),
      });
      fetchContent();
    } catch { toast.error('Reorder failed'); }
  };

  const uploadBannerImage = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      await apiFetch('/homepage/banner-image', { method: 'POST', body: fd });
      fetchContent();
      toast.success('Banner image updated');
    } catch { toast.error('Upload failed'); }
  };

  const handleHeroDragStart = (e, idx) => { e.dataTransfer.setData('heroIdx', idx); };
  const handleHeroDrop = (e, idx) => {
    const from = parseInt(e.dataTransfer.getData('heroIdx'), 10);
    if (isNaN(from) || from === idx) return;
    const imgs = [...(doc?.heroImages || [])];
    const [moved] = imgs.splice(from, 1);
    imgs.splice(idx, 0, moved);
    reorderHeroImages(imgs);
  };

  if (!doc) return <div className="loading-center"><div className="spinner" /></div>;

  const cardStyle = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '28px 32px', marginBottom: '24px',
  };
  const sectionTitle = {
    fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem',
    letterSpacing: '-0.02em', marginBottom: '20px', color: 'var(--ink)',
  };
  const note = { fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: '16px', lineHeight: 1.5 };
  const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };

  return (
    <div style={{ paddingBottom: '100px' }}>

      {/* ── Section 1: Hero Images ── */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Hero Images</h3>
        <p style={note}>
          These images cycle in the hero carousel. Recommended size: 2400 × 1200px, landscape orientation.
          Drag to reorder.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {(doc.heroImages || []).map((img, i) => (
            <div
              key={img._id}
              draggable
              onDragStart={e => handleHeroDragStart(e, i)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleHeroDrop(e, i)}
              style={{ position: 'relative', cursor: 'grab', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}
            >
              <img src={img.url} alt={img.altText || `Hero ${i + 1}`}
                style={{ width: 120, height: 80, objectFit: 'cover', display: 'block' }} />
              <button
                onClick={() => deleteHeroImage(img._id)}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                  background: '#c0392b', color: '#fff', border: 'none', borderRadius: '50%',
                  cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Delete image"
              >✕</button>
            </div>
          ))}
          {doc.heroImages?.length === 0 && (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>No hero images yet.</p>
          )}
        </div>
        <input
          ref={heroFileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) uploadHeroImages(Array.from(e.target.files)); e.target.value = ''; }}
        />
        <button className="btn-outline" onClick={() => heroFileRef.current?.click()}>
          + Upload Images
        </button>
      </div>

      {/* ── Section 2: Hero Text ── */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Hero Text</h3>
        <p style={note}>Wrap words in *asterisks* to italicize. Example: 'Craft your *perfect setup*'</p>
        <div style={{ marginBottom: '14px' }}>
          <label className="form-label">Eyebrow</label>
          <input className="form-input" value={form.heroEyebrow || ''} onChange={e => set('heroEyebrow', e.target.value)} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label className="form-label">Title</label>
          <input className="form-input" value={form.heroTitle || ''} onChange={e => set('heroTitle', e.target.value)} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label">Subtitle</label>
          <textarea className="form-input" rows={3} value={form.heroSubtitle || ''} onChange={e => set('heroSubtitle', e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div style={rowStyle}>
          <div>
            <label className="form-label">Primary CTA Label</label>
            <input className="form-input" value={form.heroPrimaryCtaLabel || ''} onChange={e => set('heroPrimaryCtaLabel', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Primary CTA Link</label>
            <input className="form-input" value={form.heroPrimaryCtaLink || ''} onChange={e => set('heroPrimaryCtaLink', e.target.value)} />
          </div>
        </div>
        <div style={{ ...rowStyle, marginTop: '14px' }}>
          <div>
            <label className="form-label">Secondary CTA Label</label>
            <input className="form-input" value={form.heroSecondaryCtaLabel || ''} onChange={e => set('heroSecondaryCtaLabel', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Secondary CTA Link</label>
            <input className="form-input" value={form.heroSecondaryCtaLink || ''} onChange={e => set('heroSecondaryCtaLink', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Section 3: Banner Layout ── */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Banner Layout</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {LAYOUTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set('bannerLayout', opt.value)}
              style={{
                padding: '16px 12px', borderRadius: 'var(--radius-sm)',
                border: `2px solid ${form.bannerLayout === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                background: form.bannerLayout === opt.value ? 'var(--accent-light)' : 'var(--bg)',
                cursor: 'pointer', textAlign: 'center', transition: 'var(--transition)',
              }}
            >
              <LayoutPreview type={opt.value} />
              <p style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '2px', color: 'var(--ink)' }}>{opt.label}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 4: Banner Image ── */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Banner Image</h3>
        {doc.bannerImage?.url ? (
          <img src={doc.bannerImage.url} alt="Banner"
            style={{ width: 320, height: 180, objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'block' }} />
        ) : (
          <div style={{ width: 320, height: 180, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>No banner image</p>
          </div>
        )}
        <input
          ref={bannerFileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) uploadBannerImage(e.target.files[0]); e.target.value = ''; }}
        />
        <button className="btn-outline" onClick={() => bannerFileRef.current?.click()}>
          Replace Image
        </button>
      </div>

      {/* ── Section 5: Banner Text ── */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Banner Text</h3>
        <p style={note}>Wrap words in *asterisks* to italicize.</p>
        <div style={{ marginBottom: '14px' }}>
          <label className="form-label">Eyebrow</label>
          <input className="form-input" value={form.bannerEyebrow || ''} onChange={e => set('bannerEyebrow', e.target.value)} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label className="form-label">Title</label>
          <input className="form-input" value={form.bannerTitle || ''} onChange={e => set('bannerTitle', e.target.value)} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label">Subtitle</label>
          <textarea className="form-input" rows={2} value={form.bannerSubtitle || ''} onChange={e => set('bannerSubtitle', e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div style={rowStyle}>
          <div>
            <label className="form-label">CTA Label</label>
            <input className="form-input" value={form.bannerCtaLabel || ''} onChange={e => set('bannerCtaLabel', e.target.value)} />
          </div>
          <div>
            <label className="form-label">CTA Link</label>
            <input className="form-input" value={form.bannerCtaLink || ''} onChange={e => set('bannerCtaLink', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Sticky footer bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        padding: '14px var(--page-pad)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
          Last saved: {relativeTime(doc?.updatedAt)}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-outline" onClick={fetchContent}>Cancel</button>
          <button className="btn-dark" onClick={handleSave} disabled={saving}>
            <span>{saving ? 'Saving…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* Small layout preview diagrams */
function LayoutPreview({ type }) {
  const base = { width: '100%', height: 40, borderRadius: 4, overflow: 'hidden', marginBottom: 8, position: 'relative', background: 'var(--border)' };
  if (type === 'split') return (
    <div style={base}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%', background: 'var(--ink-faint)' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%', background: 'var(--border)' }} />
    </div>
  );
  if (type === 'overlay') return (
    <div style={base}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--border)' }} />
      <div style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: '50%', height: 3, background: 'var(--ink-faint)', borderRadius: 2 }} />
    </div>
  );
  if (type === 'stacked') return (
    <div style={base}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', background: 'var(--border)' }} />
      <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: '60%', height: 3, background: 'var(--ink-faint)', borderRadius: 2 }} />
    </div>
  );
  // fullbleed
  return (
    <div style={base}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--border)' }} />
      <div style={{ position: 'absolute', bottom: 4, left: 6, width: '55%', height: 3, background: 'var(--ink-faint)', borderRadius: 2 }} />
    </div>
  );
}
