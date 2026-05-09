import { useState } from 'react';
import { RichText } from './AdminView';

/* ─────────────────────────────────────────────────────────────────────────────
   LANDING PAGE — Amazon A+ style content rendered below the buy section.

   Block-based: each block has { _id, type, data }. New types can be added by
   registering a renderer + an editor here without schema migrations server-side
   (the `data` field is Mongoose Mixed).

   Stable client-side keys: existing blocks reuse their Mongo _id; new ones get
   a temporary id we strip before sending to the server (so Mongo allocates a
   real ObjectId on save).
   ───────────────────────────────────────────────────────────────────────── */

const tempId = () => `tmp-${Math.random().toString(36).slice(2, 10)}`;

const BLOCK_DEFAULTS = {
  'rich-text':  () => ({ markdown: '' }),
  'hero-image': () => ({ url: '', alt: '', caption: '', fullBleed: false }),
  'two-column': () => ({ imageUrl: '', alt: '', markdown: '', imageOnLeft: true }),
};

const BLOCK_LABELS = {
  'rich-text':  'Rich text',
  'hero-image': 'Hero image',
  'two-column': 'Two column',
};

/* ═══════════════════════════════════════════════
   RENDERER — customer-facing
═══════════════════════════════════════════════ */
export function LandingPageRenderer({ blocks }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  return (
    <section className="lp-section">
      {blocks.map((b, i) => {
        const key = b._id || i;
        if (b.type === 'rich-text')  return <LpRichText  key={key} data={b.data || {}} />;
        if (b.type === 'hero-image') return <LpHeroImage key={key} data={b.data || {}} />;
        if (b.type === 'two-column') return <LpTwoColumn key={key} data={b.data || {}} />;
        return null;
      })}
      <style>{`
        .lp-section { padding: 40px var(--page-pad) 24px; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 48px; }
        .lp-rich h1, .lp-rich h2, .lp-rich h3 { font-family: 'DM Serif Display', serif; }
        .lp-hero-fullbleed { margin-left: calc(-1 * var(--page-pad)); margin-right: calc(-1 * var(--page-pad)); }
        .lp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
        @media (max-width: 760px) {
          .lp-two-col { grid-template-columns: 1fr !important; gap: 24px !important; }
          .lp-two-col-image-left .lp-two-col-image { order: 0; }
          .lp-two-col-image-left .lp-two-col-text  { order: 1; }
          .lp-two-col-image-right .lp-two-col-image { order: 0; }
          .lp-two-col-image-right .lp-two-col-text  { order: 1; }
        }
      `}</style>
    </section>
  );
}

function LpRichText({ data }) {
  if (!data.markdown?.trim()) return null;
  return <div className="lp-rich" style={{ fontSize: '1rem', lineHeight: 1.8 }}><RichText content={data.markdown} /></div>;
}

function LpHeroImage({ data }) {
  if (!data.url) return null;
  return (
    <figure className={data.fullBleed ? 'lp-hero-fullbleed' : ''} style={{ margin: 0 }}>
      <img src={data.url} alt={data.alt || ''} style={{ width: '100%', display: 'block', borderRadius: data.fullBleed ? 0 : 'var(--radius-sm)' }} />
      {data.caption && (
        <figcaption style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginTop: 10, textAlign: 'center' }}>{data.caption}</figcaption>
      )}
    </figure>
  );
}

function LpTwoColumn({ data }) {
  const left = data.imageOnLeft;
  const image = data.imageUrl
    ? <img className="lp-two-col-image" src={data.imageUrl} alt={data.alt || ''} style={{ width: '100%', borderRadius: 'var(--radius-sm)', display: 'block' }} />
    : <div className="lp-two-col-image" style={{ aspectRatio: '4/3', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }} />;
  const text = (
    <div className="lp-two-col-text lp-rich" style={{ fontSize: '1rem', lineHeight: 1.8 }}>
      <RichText content={data.markdown || ''} />
    </div>
  );
  return (
    <div className={`lp-two-col ${left ? 'lp-two-col-image-left' : 'lp-two-col-image-right'}`}>
      {left ? <>{image}{text}</> : <>{text}{image}</>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   EDITOR — admin
═══════════════════════════════════════════════ */
export function LandingPageEditor({ value, onChange }) {
  const blocks = Array.isArray(value) ? value : [];

  const addBlock = (type) => {
    onChange([...blocks, { _id: tempId(), type, data: BLOCK_DEFAULTS[type]() }]);
  };
  const updateBlock = (idx, patch) => {
    onChange(blocks.map((b, i) => i !== idx ? b : { ...b, data: { ...b.data, ...patch } }));
  };
  const removeBlock = (idx) => onChange(blocks.filter((_, i) => i !== idx));
  const moveBlock = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                  {i + 1}. {BLOCK_LABELS[b.type] || b.type}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <BlockBtn onClick={() => moveBlock(i, -1)} disabled={i === 0} title="Move up">↑</BlockBtn>
                  <BlockBtn onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} title="Move down">↓</BlockBtn>
                  <BlockBtn onClick={() => removeBlock(i)} title="Remove" danger>✕</BlockBtn>
                </div>
              </div>
              <div style={{ padding: '12px' }}>
                {b.type === 'rich-text'  && <RichTextBlockEditor  data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                {b.type === 'hero-image' && <HeroImageBlockEditor data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                {b.type === 'two-column' && <TwoColumnBlockEditor data={b.data || {}} onChange={p => updateBlock(i, p)} />}
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
      <input className="form-input" value={data.url || ''} onChange={e => onChange({ url: e.target.value })}
        placeholder="Image URL (https://…)" />
      {data.url && (
        <img src={data.url} alt="" style={{ maxWidth: 220, maxHeight: 120, objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', alignSelf: 'flex-start' }} />
      )}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input className="form-input" value={data.imageUrl || ''} onChange={e => onChange({ imageUrl: e.target.value })}
            placeholder="Image URL" />
          {data.imageUrl && (
            <img src={data.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
          )}
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
    </div>
  );
}

/* Strip client-only temp ids so Mongo assigns real ObjectIds on save. */
export function serializeLandingPage(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(b => {
    const { _id, type, data } = b;
    const isTempId = typeof _id === 'string' && _id.startsWith('tmp-');
    return isTempId ? { type, data } : { _id, type, data };
  });
}
