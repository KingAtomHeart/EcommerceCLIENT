import { useState } from 'react';
import { RichText } from './AdminView';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────────────────────
   LANDING PAGE — Amazon A+ style content rendered below the buy section.

   Block-based: each block has { _id, type, data, bg }. New types are registered
   in BLOCK_DEFAULTS / BLOCK_LABELS plus an editor and a renderer below.

   `bg` is rendered uniformly by the wrapper ('none' | 'muted' | 'dark'); each
   block's data only describes its own content.

   Stable client-side keys: existing blocks reuse their Mongo _id; new ones get
   a temporary id we strip before sending so Mongo allocates a real ObjectId.
   ───────────────────────────────────────────────────────────────────────── */

const tempId = () => `tmp-${Math.random().toString(36).slice(2, 10)}`;

const BLOCK_DEFAULTS = {
  'rich-text':  () => ({ markdown: '' }),
  'hero-image': () => ({ url: '', alt: '', caption: '', fullBleed: false }),
  'two-column': () => ({ imageUrl: '', alt: '', markdown: '', imageOnLeft: true }),
  'gallery':    () => ({ images: [], columns: 3 }),
  'video':      () => ({ url: '', caption: '' }),
  'spec-list':  () => ({ title: '', rows: [] }),
};

const BLOCK_LABELS = {
  'rich-text':  'Rich text',
  'hero-image': 'Hero image',
  'two-column': 'Two column',
  'gallery':    'Gallery',
  'video':      'Video',
  'spec-list':  'Spec list',
};

const BG_OPTIONS = [
  { key: 'none',  label: 'None'  },
  { key: 'muted', label: 'Muted' },
  { key: 'dark',  label: 'Dark'  },
];

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const data = await apiFetch('/upload/single', { method: 'POST', body: fd });
  return data.url;
}

// Parse common YouTube/Vimeo URLs to embed URLs. Returns null if unrecognised.
function toEmbedUrl(input) {
  if (!input) return null;
  const url = String(input).trim();
  // youtu.be/ID
  let m = url.match(/youtu\.be\/([\w-]{6,})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  // youtube.com/watch?v=ID
  m = url.match(/youtube\.com\/.*[?&]v=([\w-]{6,})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  // youtube.com/embed/ID (already correct)
  m = url.match(/youtube\.com\/embed\/([\w-]{6,})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  // vimeo.com/ID
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

/* ═══════════════════════════════════════════════
   RENDERER — customer-facing
═══════════════════════════════════════════════ */
export function LandingPageRenderer({ blocks }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  return (
    <section className="lp-section">
      {blocks.map((b, i) => {
        const key = b._id || i;
        const bg = b.bg || 'none';
        return (
          <div key={key} className={`lp-block lp-bg-${bg}`}>
            <div className="lp-block-inner">
              {b.type === 'rich-text'  && <LpRichText  data={b.data || {}} />}
              {b.type === 'hero-image' && <LpHeroImage data={b.data || {}} bg={bg} />}
              {b.type === 'two-column' && <LpTwoColumn data={b.data || {}} />}
              {b.type === 'gallery'    && <LpGallery   data={b.data || {}} />}
              {b.type === 'video'      && <LpVideo     data={b.data || {}} />}
              {b.type === 'spec-list'  && <LpSpecList  data={b.data || {}} />}
            </div>
          </div>
        );
      })}
      <style>{`
        .lp-section { display: flex; flex-direction: column; }
        .lp-block { width: 100%; }
        .lp-block-inner { max-width: 1100px; margin: 0 auto; padding: 56px var(--page-pad); }
        .lp-bg-none  { background: transparent; }
        .lp-bg-muted { background: var(--bg-secondary); }
        .lp-bg-dark  { background: #1a1612; color: #f3eee5; }
        .lp-bg-dark .lp-rich h1, .lp-bg-dark .lp-rich h2, .lp-bg-dark .lp-rich h3, .lp-bg-dark .lp-rich strong { color: #f3eee5; }
        .lp-bg-dark .lp-rich a { color: #f3eee5; }
        .lp-bg-dark .lp-spec-list { border-color: rgba(255,255,255,0.18); }
        .lp-bg-dark .lp-spec-list .lp-spec-row { border-color: rgba(255,255,255,0.12); }
        .lp-bg-dark .lp-spec-list .lp-spec-label { color: #d8cfbe; }
        .lp-rich h1, .lp-rich h2, .lp-rich h3 { font-family: 'DM Serif Display', serif; }
        .lp-hero-fullbleed { margin-left: calc(-1 * var(--page-pad)); margin-right: calc(-1 * var(--page-pad)); border-radius: 0 !important; }
        .lp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
        .lp-gallery { display: grid; gap: 12px; }
        .lp-gallery-2 { grid-template-columns: repeat(2, 1fr); }
        .lp-gallery-3 { grid-template-columns: repeat(3, 1fr); }
        .lp-gallery-4 { grid-template-columns: repeat(4, 1fr); }
        .lp-video-frame { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: var(--radius-sm); overflow: hidden; background: #000; }
        .lp-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
        .lp-spec-list { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 18px 24px; }
        .lp-spec-list-title { font-family: 'DM Serif Display', serif; font-size: 1.2rem; margin-bottom: 12px; }
        .lp-spec-row { display: grid; grid-template-columns: 220px 1fr; gap: 12px; padding: 8px 0; border-top: 1px solid var(--border-subtle); }
        .lp-spec-row:first-child { border-top: none; }
        .lp-spec-label { color: var(--ink-muted); font-size: 0.84rem; }
        .lp-spec-value { font-size: 0.92rem; }
        @media (max-width: 760px) {
          .lp-block-inner { padding: 40px var(--page-pad); }
          .lp-two-col { grid-template-columns: 1fr !important; gap: 24px !important; }
          .lp-gallery-3, .lp-gallery-4 { grid-template-columns: repeat(2, 1fr); }
          .lp-spec-row { grid-template-columns: 1fr; gap: 4px; }
        }
      `}</style>
    </section>
  );
}

function LpRichText({ data }) {
  if (!data.markdown?.trim()) return null;
  return <div className="lp-rich" style={{ fontSize: '1rem', lineHeight: 1.8 }}><RichText content={data.markdown} /></div>;
}

function LpHeroImage({ data, bg }) {
  if (!data.url) return null;
  // Full-bleed escapes the inner padding too — pull it back to the section edge.
  const fullBleedStyle = data.fullBleed
    ? { marginTop: -56, marginBottom: -56, marginLeft: 'calc(-1 * var(--page-pad))', marginRight: 'calc(-1 * var(--page-pad))' }
    : {};
  return (
    <figure style={{ margin: 0, ...fullBleedStyle }}>
      <img src={data.url} alt={data.alt || ''} style={{ width: '100%', display: 'block', borderRadius: data.fullBleed ? 0 : 'var(--radius-sm)' }} />
      {data.caption && (
        <figcaption style={{ fontSize: '0.82rem', color: bg === 'dark' ? '#cdc4b3' : 'var(--ink-muted)', marginTop: 10, textAlign: 'center', padding: data.fullBleed ? '0 var(--page-pad)' : 0 }}>
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
}

function LpTwoColumn({ data }) {
  const left = data.imageOnLeft !== false;
  const image = data.imageUrl
    ? <img src={data.imageUrl} alt={data.alt || ''} style={{ width: '100%', borderRadius: 'var(--radius-sm)', display: 'block' }} />
    : <div style={{ aspectRatio: '4/3', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }} />;
  const text = (
    <div className="lp-rich" style={{ fontSize: '1rem', lineHeight: 1.8 }}>
      <RichText content={data.markdown || ''} />
    </div>
  );
  return (
    <div className="lp-two-col">
      {left ? <>{image}{text}</> : <>{text}{image}</>}
    </div>
  );
}

function LpGallery({ data }) {
  const images = (data.images || []).filter(im => im?.url);
  if (images.length === 0) return null;
  const cols = [2, 3, 4].includes(data.columns) ? data.columns : 3;
  return (
    <div className={`lp-gallery lp-gallery-${cols}`}>
      {images.map((im, i) => (
        <img key={i} src={im.url} alt={im.alt || ''}
          style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }} />
      ))}
    </div>
  );
}

function LpVideo({ data }) {
  const embed = toEmbedUrl(data.url);
  if (!embed) return null;
  return (
    <figure style={{ margin: 0 }}>
      <div className="lp-video-frame">
        <iframe src={embed} title="Embedded video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      {data.caption && <figcaption style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginTop: 10, textAlign: 'center' }}>{data.caption}</figcaption>}
    </figure>
  );
}

function LpSpecList({ data }) {
  const rows = (data.rows || []).filter(r => r?.label?.trim() || r?.value?.trim());
  if (rows.length === 0 && !data.title) return null;
  return (
    <div className="lp-spec-list">
      {data.title && <p className="lp-spec-list-title">{data.title}</p>}
      {rows.map((r, i) => (
        <div key={i} className="lp-spec-row">
          <div className="lp-spec-label">{r.label}</div>
          <div className="lp-spec-value">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   EDITOR — admin
═══════════════════════════════════════════════ */
export function LandingPageEditor({ value, onChange }) {
  const blocks = Array.isArray(value) ? value : [];

  const addBlock = (type) => {
    onChange([...blocks, { _id: tempId(), type, data: BLOCK_DEFAULTS[type](), bg: 'none' }]);
  };
  const updateBlock = (idx, patch) => {
    onChange(blocks.map((b, i) => i !== idx ? b : { ...b, data: { ...b.data, ...patch } }));
  };
  const setBlockBg = (idx, bg) => {
    onChange(blocks.map((b, i) => i !== idx ? b : { ...b, bg }));
  };
  const removeBlock = (idx) => onChange(blocks.filter((_, i) => i !== idx));
  const moveBlock = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const duplicateBlock = (idx) => {
    const orig = blocks[idx];
    if (!orig) return;
    // Deep-copy data so list/array fields don't share references with the source block.
    const copy = { _id: tempId(), type: orig.type, bg: orig.bg || 'none', data: JSON.parse(JSON.stringify(orig.data || {})) };
    onChange([...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)]);
  };

  return (
    <div>
      <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
        Optional. Build a marketing landing page rendered below the buy section. Blocks render in the order shown here.
      </p>

      {blocks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {blocks.map((b, i) => (
            <div key={b._id || i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                  {i + 1}. {BLOCK_LABELS[b.type] || b.type}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BgPicker value={b.bg || 'none'} onChange={bg => setBlockBg(i, bg)} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <BlockBtn onClick={() => moveBlock(i, -1)} disabled={i === 0} title="Move up">↑</BlockBtn>
                    <BlockBtn onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} title="Move down">↓</BlockBtn>
                    <BlockBtn onClick={() => duplicateBlock(i)} title="Duplicate">⧉</BlockBtn>
                    <BlockBtn onClick={() => removeBlock(i)} title="Remove" danger>✕</BlockBtn>
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px' }}>
                {b.type === 'rich-text'  && <RichTextBlockEditor  data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                {b.type === 'hero-image' && <HeroImageBlockEditor data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                {b.type === 'two-column' && <TwoColumnBlockEditor data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                {b.type === 'gallery'    && <GalleryBlockEditor   data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                {b.type === 'video'      && <VideoBlockEditor     data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                {b.type === 'spec-list'  && <SpecListBlockEditor  data={b.data || {}} onChange={p => updateBlock(i, p)} />}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', alignSelf: 'center', marginRight: 4 }}>Add:</span>
        {Object.keys(BLOCK_DEFAULTS).map(type => (
          <button key={type} type="button" onClick={() => addBlock(type)}
            style={{ fontSize: '0.74rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '5px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            + {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

function BgPicker({ value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', fontSize: '0.66rem' }}>
      {BG_OPTIONS.map(opt => (
        <button key={opt.key} type="button" onClick={() => onChange(opt.key)} title={`Background: ${opt.label}`}
          style={{
            padding: '3px 9px',
            background: value === opt.key ? 'var(--accent)' : 'transparent',
            color: value === opt.key ? '#fff' : 'var(--ink-muted)',
            border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function BlockBtn({ children, onClick, disabled, title, danger }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{
        width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
        background: 'var(--surface)', color: danger ? '#c0392b' : 'var(--ink-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.78rem', lineHeight: 1,
        opacity: disabled ? 0.4 : 1,
      }}>
      {children}
    </button>
  );
}

/* Reusable: image URL input + thumbnail preview + Upload button. */
function ImageInput({ value, onChange, placeholder = 'Image URL', disabled }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try { onChange(await uploadImage(file)); }
    catch (err) { toast.error(err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled} style={{ flex: 1 }} />
        <label
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)',
            color: 'var(--accent)', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.74rem',
            fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
          }}>
          {uploading ? '…' : '↑ Upload'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>
      {value && (
        <img src={value} alt="" style={{ maxWidth: 220, maxHeight: 120, objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', alignSelf: 'flex-start' }} />
      )}
    </div>
  );
}

function MarkdownArea({ value, onChange, minHeight = 100, placeholder }) {
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button type="button" onClick={() => setPreview(p => !p)}
          style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {preview ? (
        <div style={{ minHeight, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', fontSize: '0.88rem', lineHeight: 1.7 }}>
          {value?.trim() ? <RichText content={value} /> : <span style={{ color: 'var(--ink-faint)' }}>Nothing to preview yet.</span>}
        </div>
      ) : (
        <textarea className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem', width: '100%' }} />
      )}
      <p style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', marginTop: 4 }}>
        Markdown: **bold** · *italic* · # Heading · - bullet · blank line = new paragraph
      </p>
    </div>
  );
}

function RichTextBlockEditor({ data, onChange }) {
  return <MarkdownArea value={data.markdown} onChange={v => onChange({ markdown: v })} placeholder="Section heading and prose…" />;
}

function HeroImageBlockEditor({ data, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ImageInput value={data.url} onChange={v => onChange({ url: v })} placeholder="Image URL or click Upload" />
      <input className="form-input" value={data.alt || ''} onChange={e => onChange({ alt: e.target.value })}
        placeholder="Alt text (for accessibility)" />
      <input className="form-input" value={data.caption || ''} onChange={e => onChange({ caption: e.target.value })}
        placeholder="Caption (optional)" />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
        <input type="checkbox" checked={!!data.fullBleed} onChange={e => onChange({ fullBleed: e.target.checked })} />
        Full-bleed (edge to edge)
      </label>
    </div>
  );
}

function TwoColumnBlockEditor({ data, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ImageInput value={data.imageUrl} onChange={v => onChange({ imageUrl: v })} placeholder="Image URL or click Upload" />
        <input className="form-input" value={data.alt || ''} onChange={e => onChange({ alt: e.target.value })}
          placeholder="Alt text" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
          <input type="checkbox" checked={data.imageOnLeft !== false}
            onChange={e => onChange({ imageOnLeft: e.target.checked })} />
          Image on left
        </label>
      </div>
      <MarkdownArea value={data.markdown} onChange={v => onChange({ markdown: v })} minHeight={140}
        placeholder="Heading and copy for this section…" />
    </div>
  );
}

function GalleryBlockEditor({ data, onChange }) {
  const images = data.images || [];
  const setImageAt = (i, patch) => onChange({ images: images.map((im, j) => j !== i ? im : { ...im, ...patch }) });
  const addImage = () => onChange({ images: [...images, { url: '', alt: '' }] });
  const removeImage = (i) => onChange({ images: images.filter((_, j) => j !== i) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Columns:</span>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', fontSize: '0.7rem' }}>
          {[2, 3, 4].map(n => (
            <button key={n} type="button" onClick={() => onChange({ columns: n })}
              style={{ padding: '4px 10px', background: data.columns === n ? 'var(--accent)' : 'transparent', color: data.columns === n ? '#fff' : 'var(--ink-muted)', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              {n}
            </button>
          ))}
        </div>
      </div>
      {images.map((im, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, alignItems: 'flex-start', padding: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          <ImageInput value={im.url} onChange={v => setImageAt(i, { url: v })} placeholder="Image URL or upload" />
          <input className="form-input" value={im.alt || ''} onChange={e => setImageAt(i, { alt: e.target.value })}
            placeholder="Alt text" style={{ alignSelf: 'flex-start' }} />
          <button type="button" onClick={() => removeImage(i)}
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={addImage}
        style={{ alignSelf: 'flex-start', fontSize: '0.74rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
        + Add Image
      </button>
    </div>
  );
}

function VideoBlockEditor({ data, onChange }) {
  const embed = toEmbedUrl(data.url);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input className="form-input" value={data.url || ''} onChange={e => onChange({ url: e.target.value })}
        placeholder="YouTube or Vimeo URL" />
      {data.url && !embed && (
        <p style={{ fontSize: '0.72rem', color: '#c0392b' }}>Unrecognised video URL — only YouTube and Vimeo are supported.</p>
      )}
      <input className="form-input" value={data.caption || ''} onChange={e => onChange({ caption: e.target.value })}
        placeholder="Caption (optional)" />
    </div>
  );
}

function SpecListBlockEditor({ data, onChange }) {
  const rows = data.rows || [];
  const setRowAt = (i, patch) => onChange({ rows: rows.map((r, j) => j !== i ? r : { ...r, ...patch }) });
  const addRow = () => onChange({ rows: [...rows, { label: '', value: '' }] });
  const removeRow = (i) => onChange({ rows: rows.filter((_, j) => j !== i) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input className="form-input" value={data.title || ''} onChange={e => onChange({ title: e.target.value })}
        placeholder="Section title (e.g. Case Specifications) — optional" />
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 6 }}>
          <input className="form-input" value={r.label || ''} onChange={e => setRowAt(i, { label: e.target.value })}
            placeholder="Label" />
          <input className="form-input" value={r.value || ''} onChange={e => setRowAt(i, { value: e.target.value })}
            placeholder="Value" />
          <button type="button" onClick={() => removeRow(i)}
            style={{ padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={addRow}
        style={{ alignSelf: 'flex-start', fontSize: '0.74rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
        + Add Row
      </button>
    </div>
  );
}

/* Strip client-only temp ids so Mongo assigns real ObjectIds on save. */
export function serializeLandingPage(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(b => {
    const { _id, type, data, bg } = b;
    const isTempId = typeof _id === 'string' && _id.startsWith('tmp-');
    const out = isTempId ? { type, data, bg: bg || 'none' } : { _id, type, data, bg: bg || 'none' };
    return out;
  });
}
