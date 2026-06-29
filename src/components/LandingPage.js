import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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

// Block catalog scoped to product pages. Video lives in product images, not
// here, so it's dropped from the picker — but the renderer below still handles
// legacy 'video' blocks so old data keeps rendering after the catalog shrunk.
//
// 'columns' = the Bowl-style multi-column headed list (Vendors / Timeline /
// Price / Kit Contents). Each column has a title and an array of bullet items.
// 'products' = embedded buy cards for existing in-stock products or group
// buys. The renderer fetches the catalog on mount and filters by id.
const BLOCK_DEFAULTS = {
  'hero-image': () => ({ url: '', alt: '', caption: '', fullBleed: false }),
  'rich-text':  () => ({ markdown: '' }),
  'two-column': () => ({ imageOnLeft: true, imageUrl: '', alt: '', markdown: '' }),
  'gallery':    () => ({ images: [], columns: 3 }),
  'spec-list':  () => ({ title: '', rows: [] }),
  'columns':    () => ({ columns: [{ title: '', items: [''] }, { title: '', items: [''] }] }),
  'products':   () => ({ productIds: [], groupBuyIds: [], columns: 3 }),
};

// Labels match the section catalog the user picked: Hero / Banner / Text+Image
// / Gallery / Feature grid / Columns / Products. 'video' label kept for legacy
// block summaries.
const BLOCK_LABELS = {
  'hero-image': 'Hero',
  'rich-text':  'Banner',
  'two-column': 'Text + Image',
  'gallery':    'Gallery',
  'spec-list':  'Feature grid',
  'columns':    'Columns',
  'products':   'Products',
  'video':      'Video',
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
              {b.type === 'columns'    && <LpColumns   data={b.data || {}} />}
              {b.type === 'products'   && <LpProducts  data={b.data || {}} />}
            </div>
          </div>
        );
      })}
      <style>{`
        /* Tightened from earlier 56px/48px values — the old gaps left huge
           empty bands between blocks and made the page feel half-finished.
           32px keeps each block visually distinct without hogging the page. */
        .lp-section { display: flex; flex-direction: column; }
        .lp-block { width: 100%; }
        .lp-block-inner { max-width: 1000px; margin: 0 auto; padding: 32px var(--page-pad); }
        .lp-bg-none  { background: transparent; }
        .lp-bg-muted { background: var(--bg-secondary); }
        .lp-bg-dark  { background: #1a1612; color: #f3eee5; }
        .lp-bg-dark .lp-rich h1, .lp-bg-dark .lp-rich h2, .lp-bg-dark .lp-rich h3, .lp-bg-dark .lp-rich strong { color: #f3eee5; }
        .lp-bg-dark .lp-rich a { color: #f3eee5; }
        .lp-bg-dark .lp-spec-list { border-color: rgba(255,255,255,0.18); }
        .lp-bg-dark .lp-spec-list .lp-spec-row { border-color: rgba(255,255,255,0.12); }
        .lp-bg-dark .lp-spec-list .lp-spec-label { color: #d8cfbe; }
        .lp-rich h1, .lp-rich h2, .lp-rich h3 { font-family: 'DM Serif Display', serif; }
        .lp-rich p:first-child { margin-top: 0; }
        .lp-rich p:last-child { margin-bottom: 0; }
        .lp-hero-fullbleed { margin-left: calc(-1 * var(--page-pad)); margin-right: calc(-1 * var(--page-pad)); border-radius: 0 !important; }
        .lp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; }
        .lp-gallery { display: grid; gap: 10px; }
        .lp-gallery-2 { grid-template-columns: repeat(2, 1fr); }
        .lp-gallery-3 { grid-template-columns: repeat(3, 1fr); }
        .lp-gallery-4 { grid-template-columns: repeat(4, 1fr); }
        .lp-video-frame { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: var(--radius-sm); overflow: hidden; background: #000; }
        .lp-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
        .lp-spec-list { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px 20px; }
        .lp-spec-list-title { font-family: 'DM Serif Display', serif; font-size: 1.15rem; margin-bottom: 10px; }
        .lp-spec-row { display: grid; grid-template-columns: 200px 1fr; gap: 12px; padding: 7px 0; border-top: 1px solid var(--border-subtle); }
        .lp-spec-row:first-child { border-top: none; padding-top: 0; }
        .lp-spec-label { color: var(--ink-muted); font-size: 0.82rem; }
        .lp-spec-value { font-size: 0.9rem; }
        /* Multi-column headed list (Bowl Oblique 'Vendors / Timeline / Price /
           Kit Contents' style). Each column has a small uppercase eyebrow
           title and a stacked list underneath. */
        .lp-cols { display: grid; gap: 28px; }
        .lp-cols-2 { grid-template-columns: repeat(2, 1fr); }
        .lp-cols-3 { grid-template-columns: repeat(3, 1fr); }
        .lp-cols-4 { grid-template-columns: repeat(4, 1fr); }
        .lp-col-title { font-size: 0.72rem; font-weight: 600; letterSpacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); margin: 0 0 10px 0; }
        .lp-bg-dark .lp-col-title { color: #cdc4b3; }
        .lp-col-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; font-size: 0.92rem; line-height: 1.55; }
        .lp-col-items li { padding: 0; }
        /* Products grid — slim buy cards for in-page CTAs. */
        .lp-products { display: grid; gap: 16px; }
        .lp-products-2 { grid-template-columns: repeat(2, 1fr); }
        .lp-products-3 { grid-template-columns: repeat(3, 1fr); }
        .lp-products-4 { grid-template-columns: repeat(4, 1fr); }
        .lp-product-card { display: flex; flex-direction: column; text-decoration: none; color: inherit; }
        .lp-product-card-img { width: 100%; aspect-ratio: 1/1; background: var(--bg-secondary); border-radius: var(--radius-sm); overflow: hidden; }
        .lp-product-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
        .lp-product-card:hover .lp-product-card-img img { transform: scale(1.03); }
        .lp-product-card-meta { padding: 10px 2px 0; }
        .lp-product-card-tag { font-size: 0.66rem; font-weight: 600; letterSpacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); margin: 0 0 4px 0; }
        .lp-product-card-name { font-family: 'DM Serif Display', serif; font-size: 1.05rem; margin: 0 0 4px 0; line-height: 1.2; }
        .lp-product-card-price { font-size: 0.88rem; color: var(--ink-muted); margin: 0; }
        .lp-bg-dark .lp-product-card-img { background: #2a231d; }
        .lp-bg-dark .lp-product-card-price { color: #d8cfbe; }
        @media (max-width: 760px) {
          .lp-block-inner { padding: 24px var(--page-pad); }
          .lp-two-col { grid-template-columns: 1fr !important; gap: 20px !important; }
          .lp-gallery-3, .lp-gallery-4 { grid-template-columns: repeat(2, 1fr); }
          .lp-spec-row { grid-template-columns: 1fr; gap: 4px; }
          .lp-cols-3, .lp-cols-4 { grid-template-columns: repeat(2, 1fr); gap: 18px; }
          .lp-products-3, .lp-products-4 { grid-template-columns: repeat(2, 1fr); }
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
  // Margins must match the lp-block-inner padding values (32px above).
  const fullBleedStyle = data.fullBleed
    ? { marginTop: -32, marginBottom: -32, marginLeft: 'calc(-1 * var(--page-pad))', marginRight: 'calc(-1 * var(--page-pad))' }
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

// Multi-column headed list. Each column = { title, items: string[] }. Empty
// columns (no title and no non-blank items) are pruned so the grid stays even.
function LpColumns({ data }) {
  const cols = (data.columns || []).map(c => ({
    title: (c?.title || '').trim(),
    items: (c?.items || []).map(s => (s || '').trim()).filter(Boolean),
  })).filter(c => c.title || c.items.length > 0);
  if (cols.length === 0) return null;
  const n = Math.min(Math.max(cols.length, 2), 4);
  return (
    <div className={`lp-cols lp-cols-${n}`}>
      {cols.map((c, i) => (
        <div key={i}>
          {c.title && <p className="lp-col-title">{c.title}</p>}
          {c.items.length > 0 && (
            <ul className="lp-col-items">
              {c.items.map((item, j) => <li key={j}>{item}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// Embedded buy cards. Fetches the public active feeds once and filters by the
// referenced ids. Keeps each card slim — image, name, price — and links to
// the canonical product or group-buy page so the buy CTA stays familiar.
function LpProducts({ data }) {
  const productIds = data.productIds || [];
  const groupBuyIds = data.groupBuyIds || [];
  const cols = [2, 3, 4].includes(data.columns) ? data.columns : 3;
  const [products, setProducts] = useState([]);
  const [groupBuys, setGroupBuys] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Only hit the endpoints that are actually referenced — most blocks
        // will pick one kind or the other, not both.
        const tasks = [];
        if (productIds.length > 0) tasks.push(apiFetch('/products/active').then(r => Array.isArray(r) ? r : (r.products || [])));
        else tasks.push(Promise.resolve([]));
        if (groupBuyIds.length > 0) tasks.push(apiFetch('/group-buys/active').then(r => Array.isArray(r) ? r : (r.groupBuys || [])));
        else tasks.push(Promise.resolve([]));
        const [ps, gs] = await Promise.all(tasks);
        if (cancelled) return;
        setProducts(ps);
        setGroupBuys(gs);
      } catch {
        // Silent failure — the block just renders empty rather than crashing
        // the entire customer page.
      }
    })();
    return () => { cancelled = true; };
  }, [productIds.join(','), groupBuyIds.join(',')]);

  // Preserve admin-chosen order: filter the fetched arrays by the original id
  // list so cards appear in the sequence the admin set, not the API's order.
  const productCards = productIds.map(id => products.find(p => p._id === id)).filter(Boolean);
  const gbCards = groupBuyIds.map(id => groupBuys.find(g => g._id === id)).filter(Boolean);
  const cards = [
    ...productCards.map(p => ({ kind: 'product', _id: p._id, name: p.name, image: p.images?.[0]?.url, price: p.price, status: p.stocks === 0 ? 'Sold out' : 'In stock' })),
    ...gbCards.map(g => ({ kind: 'gb', _id: g._id, name: g.name, image: g.images?.[0]?.url, price: g.basePrice, status: 'Group buy' })),
  ];
  if (cards.length === 0) return null;

  const formatPrice = (n) => `₱${Number(n || 0).toLocaleString()}`;
  return (
    <div className={`lp-products lp-products-${cols}`}>
      {cards.map((c) => {
        const href = c.kind === 'product' ? `/products/${c._id}` : `/group-buys/${c._id}`;
        return (
          <Link key={`${c.kind}-${c._id}`} to={href} className="lp-product-card">
            <div className="lp-product-card-img">
              {c.image && <img src={c.image} alt={c.name} />}
            </div>
            <div className="lp-product-card-meta">
              <p className="lp-product-card-tag">{c.status}</p>
              <p className="lp-product-card-name">{c.name}</p>
              <p className="lp-product-card-price">From {formatPrice(c.price)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   EDITOR — admin
   Top toolbar pins the Edit/Preview toggle and the row of "+ Add" buttons so
   admins never have to scroll past 5 expanded blocks to add another. Each block
   collapses to a one-line summary (type + a preview snippet) by default and
   expands inline on click; new blocks open expanded, existing ones stay closed.
   Preview mode renders the assembled landing page via LandingPageRenderer so
   admins can see the actual customer-facing output without leaving the modal.
═══════════════════════════════════════════════ */

// Pulls the most representative snippet out of each block type for the
// collapsed header — gives admins a "what is this block" hint at a glance.
function summarizeBlock(b) {
  const d = b.data || {};
  if (b.type === 'rich-text') {
    const text = (d.markdown || '').replace(/[#*_>`-]/g, '').trim();
    return text.slice(0, 80) || 'empty';
  }
  if (b.type === 'hero-image') {
    return d.caption || d.alt || (d.url ? 'image set' : 'empty');
  }
  if (b.type === 'two-column') {
    const text = (d.markdown || '').replace(/[#*_>`-]/g, '').trim();
    return text.slice(0, 60) || (d.imageUrl ? 'image only' : 'empty');
  }
  if (b.type === 'gallery') {
    const n = (d.images || []).filter(im => im?.url).length;
    return n > 0 ? `${n} image${n === 1 ? '' : 's'}` : 'empty';
  }
  if (b.type === 'video') {
    return d.url || 'no url';
  }
  if (b.type === 'spec-list') {
    const n = (d.rows || []).filter(r => r?.label?.trim() || r?.value?.trim()).length;
    return d.title ? `${d.title}${n > 0 ? ` · ${n} row${n === 1 ? '' : 's'}` : ''}` : (n > 0 ? `${n} row${n === 1 ? '' : 's'}` : 'empty');
  }
  if (b.type === 'columns') {
    const cols = (d.columns || []);
    const titles = cols.map(c => (c?.title || '').trim()).filter(Boolean).slice(0, 3);
    if (titles.length > 0) return `${cols.length} col · ${titles.join(' / ')}`;
    return cols.length > 0 ? `${cols.length} col` : 'empty';
  }
  if (b.type === 'products') {
    const n = (d.productIds || []).length + (d.groupBuyIds || []).length;
    return n > 0 ? `${n} item${n === 1 ? '' : 's'}` : 'empty';
  }
  return '';
}

export function LandingPageEditor({ value, onChange }) {
  const blocks = Array.isArray(value) ? value : [];

  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  // Track which blocks are expanded. New blocks open by default; pre-existing
  // ones stay collapsed so the editor doesn't sprawl. Set-of-ids keeps state
  // local to this session (not persisted on the product doc).
  const [openIds, setOpenIds] = useState(() => new Set());
  const toggleOpen = (id) => setOpenIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const addBlock = (type) => {
    const id = tempId();
    onChange([...blocks, { _id: id, type, data: BLOCK_DEFAULTS[type](), bg: 'none' }]);
    setOpenIds(prev => new Set(prev).add(id));
    if (mode === 'preview') setMode('edit');
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

  const expandAll = () => setOpenIds(new Set(blocks.map(b => b._id).filter(Boolean)));
  const collapseAll = () => setOpenIds(new Set());

  // ── Preview mode — render the actual customer-facing landing page so the
  //    admin sees the assembled output without leaving the modal.
  if (mode === 'preview') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <ModeTabs mode={mode} onChange={setMode} />
          <span style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>
            Customer-facing preview · {blocks.length} block{blocks.length === 1 ? '' : 's'}
          </span>
        </div>
        {blocks.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>
            Nothing to preview yet. Switch back to Edit and add a block.
          </p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg)' }}>
            <LandingPageRenderer blocks={blocks} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* ── Top toolbar — mode tabs + add buttons. Sticky so it stays in view
            even when the modal is scrolled past several expanded blocks. */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 2,
        background: 'var(--bg)', borderBottom: '1px solid var(--border-subtle)',
        padding: '8px 0', marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <ModeTabs mode={mode} onChange={setMode} />
          {blocks.length > 1 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={collapseAll}
                style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', cursor: 'pointer' }}>
                Collapse all
              </button>
              <button type="button" onClick={expandAll}
                style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '3px 10px', cursor: 'pointer' }}>
                Expand all
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginRight: 4 }}>+ Add:</span>
          {Object.keys(BLOCK_DEFAULTS).map(type => (
            <button key={type} type="button" onClick={() => addBlock(type)}
              style={{ fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 11px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginBottom: '10px' }}>
        Optional. Build a marketing landing page rendered below the buy section. Click a block header to expand it; use Preview to see the assembled page.
      </p>

      {blocks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blocks.map((b, i) => {
            const open = openIds.has(b._id);
            return (
              <div key={b._id || i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                {/* Header — clicking the label area toggles open/closed. Action
                    buttons live on the right and don't bubble the click. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface)', borderBottom: open ? '1px solid var(--border)' : 'none', flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" onClick={() => toggleOpen(b._id)}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', width: 12 }}>›</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                      {i + 1}. {BLOCK_LABELS[b.type] || b.type}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                      {summarizeBlock(b)}
                    </span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                    <BgPicker value={b.bg || 'none'} onChange={bg => setBlockBg(i, bg)} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <BlockBtn onClick={() => moveBlock(i, -1)} disabled={i === 0} title="Move up">↑</BlockBtn>
                      <BlockBtn onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} title="Move down">↓</BlockBtn>
                      <BlockBtn onClick={() => duplicateBlock(i)} title="Duplicate">⧉</BlockBtn>
                      <BlockBtn onClick={() => removeBlock(i)} title="Remove" danger>✕</BlockBtn>
                    </div>
                  </div>
                </div>
                {open && (
                  <div style={{ padding: '12px' }}>
                    {b.type === 'rich-text'  && <RichTextBlockEditor  data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                    {b.type === 'hero-image' && <HeroImageBlockEditor data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                    {b.type === 'two-column' && <TwoColumnBlockEditor data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                    {b.type === 'gallery'    && <GalleryBlockEditor   data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                    {b.type === 'video'      && <VideoBlockEditor     data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                    {b.type === 'spec-list'  && <SpecListBlockEditor  data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                    {b.type === 'columns'    && <ColumnsBlockEditor   data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                    {b.type === 'products'   && <ProductsBlockEditor  data={b.data || {}} onChange={p => updateBlock(i, p)} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {blocks.length === 0 && (
        <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
          No blocks yet. Pick one from the "+ Add" row above to get started.
        </p>
      )}
    </div>
  );
}

function ModeTabs({ mode, onChange }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', fontSize: '0.74rem' }}>
      {[{ k: 'edit', label: 'Edit' }, { k: 'preview', label: 'Preview' }].map(opt => (
        <button key={opt.k} type="button" onClick={() => onChange(opt.k)}
          style={{
            padding: '5px 16px',
            background: mode === opt.k ? 'var(--accent)' : 'transparent',
            color: mode === opt.k ? '#fff' : 'var(--ink-muted)',
            border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
          }}>
          {opt.label}
        </button>
      ))}
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
        background: 'var(--surface)', color: danger ? 'var(--danger)' : 'var(--ink-muted)',
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

/* Markdown textarea with a small formatting toolbar. Buttons wrap the current
   selection in the right markdown syntax, or insert a placeholder when no
   text is selected. Saves admins from having to memorise *asterisks* + hash
   marks. Selection is restored after each insertion so chained edits feel
   natural ("select text → B → I" keeps both highlights focused). */
function MarkdownArea({ value, onChange, minHeight = 100, placeholder }) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef(null);

  const wrap = (before, after = before, placeholderText = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const v = el.value;
    const selected = v.slice(start, end);
    const inner = selected || placeholderText;
    const next = v.slice(0, start) + before + inner + after + v.slice(end);
    onChange(next);
    // Restore selection / cursor after React commits the new value.
    requestAnimationFrame(() => {
      el.focus();
      const newStart = start + before.length;
      const newEnd = newStart + inner.length;
      el.setSelectionRange(newStart, newEnd);
    });
  };
  const linePrefix = (prefix, placeholderText = 'item') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const v = el.value;
    // Expand selection to the start of the first selected line.
    const lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const block = v.slice(lineStart, end);
    const lines = block.length === 0 ? [placeholderText] : block.split('\n');
    const prefixed = lines.map(l => `${prefix}${l}`).join('\n');
    const next = v.slice(0, lineStart) + prefixed + v.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const newEnd = lineStart + prefixed.length;
      el.setSelectionRange(lineStart, newEnd);
    });
  };
  const insertLink = () => {
    const url = window.prompt('Link URL:');
    if (!url) return;
    wrap('[', `](${url})`, 'link text');
  };

  const btnStyle = {
    fontSize: '0.72rem', fontWeight: 600,
    padding: '3px 8px', borderRadius: 4,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--ink)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
    minWidth: 24, lineHeight: 1,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 6, flexWrap: 'wrap' }}>
        {!preview ? (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => wrap('**', '**', 'bold')} title="Bold (wrap with **)" style={{ ...btnStyle, fontWeight: 700 }}>B</button>
            <button type="button" onClick={() => wrap('*', '*', 'italic')} title="Italic (wrap with *)" style={{ ...btnStyle, fontStyle: 'italic' }}>I</button>
            <button type="button" onClick={() => linePrefix('# ', 'Heading')} title="Heading 1" style={btnStyle}>H1</button>
            <button type="button" onClick={() => linePrefix('## ', 'Heading')} title="Heading 2" style={btnStyle}>H2</button>
            <button type="button" onClick={() => linePrefix('- ', 'item')} title="Bullet list" style={btnStyle}>• List</button>
            <button type="button" onClick={insertLink} title="Insert link" style={btnStyle}>🔗 Link</button>
          </div>
        ) : <span />}
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
        <textarea ref={textareaRef} className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem', width: '100%' }} />
      )}
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
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
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
            style={{ padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={addRow}
        style={{ alignSelf: 'flex-start', fontSize: '0.74rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
        + Add Row
      </button>
    </div>
  );
}

/* Multi-column headed list editor (Bowl Oblique 'Vendors / Timeline / Price /
   Kit Contents' style). Admins add 2–4 columns; each column has an uppercase
   eyebrow title and an editable list of bullet items. Items use a textarea so
   newlines map 1:1 to bullet rows — quicker than per-row inputs for short
   labels and matches how admins draft this content elsewhere. */
function ColumnsBlockEditor({ data, onChange }) {
  const cols = data.columns || [];
  const setColAt = (i, patch) => onChange({ columns: cols.map((c, j) => j !== i ? c : { ...c, ...patch }) });
  const setItemsText = (i, text) => setColAt(i, { items: text.split('\n') });
  const addCol = () => { if (cols.length < 4) onChange({ columns: [...cols, { title: '', items: [''] }] }); };
  const removeCol = (i) => onChange({ columns: cols.filter((_, j) => j !== i) });
  const moveCol = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= cols.length) return;
    const next = cols.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ columns: next });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', margin: 0 }}>
        2–4 columns of bullet items (e.g. Vendors · Timeline · Price · Kit Contents). One item per line.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Math.max(cols.length, 1), 4)}, 1fr)`, gap: 10 }}>
        {cols.map((c, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <span style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Col {i + 1}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button type="button" onClick={() => moveCol(i, -1)} disabled={i === 0} title="Move left"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.4 : 1, fontSize: '0.7rem' }}>←</button>
                <button type="button" onClick={() => moveCol(i, 1)} disabled={i === cols.length - 1} title="Move right"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', cursor: i === cols.length - 1 ? 'not-allowed' : 'pointer', opacity: i === cols.length - 1 ? 0.4 : 1, fontSize: '0.7rem' }}>→</button>
                <button type="button" onClick={() => removeCol(i)} title="Remove column"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
              </div>
            </div>
            <input className="form-input" value={c.title || ''} onChange={e => setColAt(i, { title: e.target.value })}
              placeholder="Title (e.g. Vendors)" style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
            <textarea className="form-input" value={(c.items || []).join('\n')} onChange={e => setItemsText(i, e.target.value)}
              placeholder={'One item per line:\nAsia / Origami Keys\nNA / KeebsForAll'}
              style={{ minHeight: 110, resize: 'vertical', fontSize: '0.82rem', lineHeight: 1.55, fontFamily: 'inherit' }} />
          </div>
        ))}
      </div>
      {cols.length < 4 && (
        <button type="button" onClick={addCol}
          style={{ alignSelf: 'flex-start', fontSize: '0.74rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          + Add Column
        </button>
      )}
    </div>
  );
}

/* Products block editor — admin picks in-stock products and/or group buys to
   embed as buy cards. Fetches the active catalog once per editor instance and
   caches it locally so multi-select clicks don't refetch. Selected ids keep
   their insertion order — that drives the order cards render in. */
function ProductsBlockEditor({ data, onChange }) {
  const productIds = data.productIds || [];
  const groupBuyIds = data.groupBuyIds || [];
  const cols = [2, 3, 4].includes(data.columns) ? data.columns : 3;
  const [products, setProducts] = useState([]);
  const [groupBuys, setGroupBuys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState('all'); // 'all' | 'product' | 'gb'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ps, gs] = await Promise.all([
          apiFetch('/products/active').then(r => Array.isArray(r) ? r : (r.products || [])),
          apiFetch('/group-buys/active').then(r => Array.isArray(r) ? r : (r.groupBuys || [])),
        ]);
        if (cancelled) return;
        setProducts(ps);
        setGroupBuys(gs);
      } catch (err) { toast.error('Failed to load catalog'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleProduct = (id) => {
    onChange({ productIds: productIds.includes(id) ? productIds.filter(x => x !== id) : [...productIds, id] });
  };
  const toggleGB = (id) => {
    onChange({ groupBuyIds: groupBuyIds.includes(id) ? groupBuyIds.filter(x => x !== id) : [...groupBuyIds, id] });
  };
  const removeAt = (kind, id) => {
    if (kind === 'product') onChange({ productIds: productIds.filter(x => x !== id) });
    else onChange({ groupBuyIds: groupBuyIds.filter(x => x !== id) });
  };
  const moveSelected = (idx, dir) => {
    // Combined ordering: products first, then group buys. Reorder within the
    // combined sequence rather than separately so admins can interleave.
    const combined = [
      ...productIds.map(id => ({ kind: 'product', id })),
      ...groupBuyIds.map(id => ({ kind: 'gb', id })),
    ];
    const j = idx + dir;
    if (j < 0 || j >= combined.length) return;
    [combined[idx], combined[j]] = [combined[j], combined[idx]];
    onChange({
      productIds: combined.filter(c => c.kind === 'product').map(c => c.id),
      groupBuyIds: combined.filter(c => c.kind === 'gb').map(c => c.id),
    });
  };

  const q = filter.trim().toLowerCase();
  const matches = (name) => !q || (name || '').toLowerCase().includes(q);
  const visibleProducts = kind === 'gb' ? [] : products.filter(p => matches(p.name));
  const visibleGBs = kind === 'product' ? [] : groupBuys.filter(g => matches(g.name));

  const selectedRows = [
    ...productIds.map(id => {
      const p = products.find(x => x._id === id);
      return { kind: 'product', id, name: p?.name || 'Unknown product', image: p?.images?.[0]?.url };
    }),
    ...groupBuyIds.map(id => {
      const g = groupBuys.find(x => x._id === id);
      return { kind: 'gb', id, name: g?.name || 'Unknown group buy', image: g?.images?.[0]?.url };
    }),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Columns:</span>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', fontSize: '0.7rem' }}>
          {[2, 3, 4].map(n => (
            <button key={n} type="button" onClick={() => onChange({ columns: n })}
              style={{ padding: '4px 10px', background: cols === n ? 'var(--accent)' : 'transparent', color: cols === n ? '#fff' : 'var(--ink-muted)', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Selected items — small row with reorder + remove. Empty placeholder
          when nothing's picked so admins know where to look. */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Selected ({selectedRows.length})
        </p>
        {selectedRows.length === 0 ? (
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', fontStyle: 'italic', margin: 0 }}>None yet. Pick from the catalog below.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selectedRows.map((row, i) => (
              <div key={`${row.kind}-${row.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', background: 'var(--surface)', borderRadius: 4, border: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden', flexShrink: 0 }}>
                  {row.image && <img src={row.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <span style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 48 }}>{row.kind === 'product' ? 'Stock' : 'Group buy'}</span>
                <span style={{ flex: 1, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                <button type="button" onClick={() => moveSelected(i, -1)} disabled={i === 0} title="Move up"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.4 : 1, fontSize: '0.7rem' }}>↑</button>
                <button type="button" onClick={() => moveSelected(i, 1)} disabled={i === selectedRows.length - 1} title="Move down"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--ink-muted)', cursor: i === selectedRows.length - 1 ? 'not-allowed' : 'pointer', opacity: i === selectedRows.length - 1 ? 0.4 : 1, fontSize: '0.7rem' }}>↓</button>
                <button type="button" onClick={() => removeAt(row.kind, row.id)} title="Remove"
                  style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catalog browser — filter + kind tabs. Click a card to toggle it in
          the selected list above. */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="form-input" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by name…" style={{ flex: 1, minWidth: 160, fontSize: '0.82rem', padding: '6px 9px' }} />
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', fontSize: '0.7rem' }}>
          {[{ k: 'all', label: 'All' }, { k: 'product', label: 'In stock' }, { k: 'gb', label: 'Group buys' }].map(opt => (
            <button key={opt.k} type="button" onClick={() => setKind(opt.k)}
              style={{ padding: '4px 10px', background: kind === opt.k ? 'var(--accent)' : 'transparent', color: kind === opt.k ? '#fff' : 'var(--ink-muted)', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>Loading catalog…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, maxHeight: 260, overflowY: 'auto', padding: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          {visibleProducts.map(p => (
            <CatalogTile key={`p-${p._id}`} name={p.name} image={p.images?.[0]?.url} tag="Stock" selected={productIds.includes(p._id)} onClick={() => toggleProduct(p._id)} />
          ))}
          {visibleGBs.map(g => (
            <CatalogTile key={`g-${g._id}`} name={g.name} image={g.images?.[0]?.url} tag="GB" selected={groupBuyIds.includes(g._id)} onClick={() => toggleGB(g._id)} />
          ))}
          {visibleProducts.length === 0 && visibleGBs.length === 0 && (
            <p style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No matches.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* Tiny selectable catalog tile used by ProductsBlockEditor. */
function CatalogTile({ name, image, tag, selected, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
        background: selected ? 'var(--accent-light)' : 'var(--bg-secondary)',
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', padding: 4, cursor: 'pointer',
      }}>
      <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--surface)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        {image && <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <span style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tag}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </button>
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
