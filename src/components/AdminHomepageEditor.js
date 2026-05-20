import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { apiFetch } from '../utils/api';
import { BlockRenderer } from '../pages/Home';
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

const BANNER_LAYOUTS = [
  { value: 'split', label: 'Split', desc: 'Text left, image right' },
  { value: 'overlay', label: 'Overlay', desc: 'Text over full image' },
  { value: 'stacked', label: 'Stacked', desc: 'Image top, text below' },
  { value: 'fullbleed', label: 'Full Bleed', desc: 'Edge-to-edge image' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'keyboards', label: 'Keyboards' },
  { value: 'keycaps', label: 'Keycaps' },
  { value: 'switches', label: 'Switches' },
  { value: 'desk-accessories', label: 'Desk Accessories' },
  { value: 'tools-accessories', label: 'Tools & Accessories' },
];

// Background and alignment options for content-bearing blocks (productGrid,
// groupBuys, banner). The visual definitions live in Home.js so the editor and
// renderer can't drift apart.
const BG_OPTIONS = [
  { value: 'default', label: 'Default',  swatch: 'var(--bg)' },
  { value: 'tinted',  label: 'Tinted',   swatch: 'var(--bg-secondary)' },
  { value: 'surface', label: 'Surface',  swatch: 'var(--surface)' },
  { value: 'accent',  label: 'Accent',   swatch: 'var(--accent-light)' },
  { value: 'dark',    label: 'Dark',     swatch: 'var(--ink)' },
];
const ALIGN_OPTIONS = [
  { value: 'left',   label: 'Left',     desc: 'Title left · view-all right' },
  { value: 'center', label: 'Centered', desc: 'Title centered · view-all below' },
];

const BLOCK_META = {
  hero:          { label: 'Hero',           icon: '✦', summary: (d) => d.title || 'Untitled hero' },
  categoryStrip: { label: 'Category Strip', icon: '≡', summary: ()  => 'Top nav row — links to each category' },
  // The new unified row-of-items block. Replaces productGrid / groupBuys /
  // productHero in the add menu; admin picks `source` + `layout` inside.
  collection:    { label: 'Section',        icon: '▤', summary: (d) => {
    const src = d.source === 'group-buys'
      ? (d.gbMode === 'interest-check' ? 'Interest checks' : 'Active group buys')
      : 'Products';
    const layout = d.layout || 'carousel';
    return d.title || `${src} · ${layout}`;
  } },
  banner:        { label: 'Banner',         icon: '▭', summary: (d) => d.title || 'Untitled banner' },
  // Legacy types — kept here so already-rendered admin rows display correctly
  // before the controller migrates them to `collection`. `hidden: true` keeps
  // them out of the "+ Insert" / "+ Add Section" menus.
  productGrid:   { hidden: true, label: 'Product Grid (legacy)', icon: '▦', summary: (d) => d.title || 'Untitled product grid' },
  productHero:   { hidden: true, label: 'Product Hero (legacy)', icon: '◑', summary: (d) => {
    const n = (d.tiles || []).filter(t => t.productId).length;
    return d.title || `${n} ${n === 1 ? 'product' : 'products'} hero`;
  } },
  groupBuys:     { hidden: true, label: 'Group Buys (legacy)',   icon: '◍', summary: (d) => d.title || (d.mode === 'interest-check' ? 'Interest checks' : 'Active group buys') },
};

// Defaults used when admin clicks "+ Add" for a given block type.
const BLOCK_DEFAULTS = {
  hero: () => ({
    eyebrow: 'New Hero',
    title: 'Title here',
    subtitle: '',
    primaryCtaLabel: 'Shop Now',
    primaryCtaLink: '/products',
    secondaryCtaLabel: '',
    secondaryCtaLink: '',
    images: [],
  }),
  categoryStrip: () => ({}),
  productGrid: () => ({
    title: 'Products', subtitle: '',
    category: '', sort: 'featured', limit: 6, viewAllLink: '/products',
  }),
  // Unified collection — defaults to a featured-products carousel, the most
  // common new-section choice. Admin then picks source/layout to vary.
  collection: () => ({
    source: 'products', layout: 'carousel',
    title: 'Featured Products', subtitle: '', eyebrow: '',
    category: '', sort: 'featured', limit: 6, viewAllLink: '/products',
    align: 'left',
  }),
  productHero: () => ({
    layout: 'pair',
    height: 'tall',
    gap: 8,
    align: 'center',
    imageStyle: 'overlay',
    textColor: 'light',
    textAlign: 'center',
    verticalAlign: 'bottom',
    fullBleed: true,
    title: '',
    subtitle: '',
    eyebrow: '',
    tiles: [
      { productId: '', eyebrow: '', subtitle: '', ctaLabel: 'Shop' },
      { productId: '', eyebrow: '', subtitle: '', ctaLabel: 'Shop' },
    ],
  }),
  groupBuys: () => ({
    title: 'Active Group Buys', subtitle: '',
    mode: 'active', limit: 4, viewAllLink: '/group-buys',
  }),
  banner: () => ({
    eyebrow: 'Limited Drop',
    title: 'Banner title',
    subtitle: '',
    ctaLabel: 'Browse',
    ctaLink: '/products',
    image: { url: '', altText: '' },
    layout: 'overlay',
  }),
};

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await apiFetch('/upload/single', { method: 'POST', body: fd });
  return res.url;
}

// Page registry — the three surfaces this editor can drive.
// Each entry maps to an API endpoint and a customer label. The Homepage doc
// uses the legacy /homepage route; the new Shop / Group Buys pages share the
// generic /page-content/:pageKey route.
const PAGE_OPTIONS = [
  { key: 'homepage',   label: 'Homepage',   endpoint: '/homepage',                   hasGridAlign: false },
  { key: 'shop',       label: 'Shop',       endpoint: '/page-content/shop',          hasGridAlign: true  },
  { key: 'group-buys', label: 'Group Buys', endpoint: '/page-content/group-buys',    hasGridAlign: true  },
];
const endpointFor = (pageKey) => (PAGE_OPTIONS.find(p => p.key === pageKey) || PAGE_OPTIONS[0]).endpoint;

export default function AdminHomepageEditor() {
  // Which page surface this editor is currently driving.
  const [pageKey, setPageKey] = useState('homepage');
  const pageMeta = PAGE_OPTIONS.find(p => p.key === pageKey) || PAGE_OPTIONS[0];

  const [doc, setDoc] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [gridAlign, setGridAlign] = useState('left');
  const [expanded, setExpanded] = useState({}); // { [blockId]: true } — used by list mode
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Live-preview mode needs the same data the customer page consumes.
  const [products, setProducts] = useState([]);
  const [groupBuys, setGroupBuys] = useState([]);

  // 'preview' = WYSIWYG live render with hover overlays; 'list' = the legacy
  // flat list editor (still available for keyboard-friendly bulk edits).
  const [mode, setMode] = useState('preview');

  // Index of the block currently being edited in a modal (preview mode only).
  const [editingIdx, setEditingIdx] = useState(null);

  const fetchContent = () => {
    apiFetch(endpointFor(pageKey))
      .then(d => {
        setDoc(d);
        setBlocks(d.blocks || []);
        setGridAlign(d.gridAlign || 'left');
        setDirty(false);
      })
      .catch(() => toast.error(`Failed to load ${pageMeta.label.toLowerCase()} content`));
  };

  useEffect(() => {
    fetchContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  useEffect(() => {
    apiFetch('/products/active').then(d => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch('/group-buys/active').then(d => setGroupBuys(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Switching pages with unsaved edits would otherwise silently nuke them.
  const switchPage = (next) => {
    if (next === pageKey) return;
    if (dirty && !window.confirm('Discard unsaved changes on this page?')) return;
    setPageKey(next);
    setEditingIdx(null);
  };

  const countByCategory = (slug) =>
    products.filter(p => p.category?.toLowerCase().replace(/\s+/g, '-') === slug).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = pageMeta.hasGridAlign ? { blocks, gridAlign } : { blocks };
      const updated = await apiFetch(endpointFor(pageKey), {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setDoc(updated);
      setBlocks(updated.blocks || []);
      setGridAlign(updated.gridAlign || 'left');
      setDirty(false);
      toast.success(`${pageMeta.label} updated`);
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const mutateBlock = (idx, fn) => {
    setBlocks(prev => prev.map((b, i) => i === idx ? { ...b, ...fn(b) } : b));
    setDirty(true);
  };
  const updateBlockData = (idx, patch) => {
    mutateBlock(idx, (b) => ({ data: { ...(b.data || {}), ...patch } }));
  };
  const toggleEnabled = (idx) => {
    mutateBlock(idx, (b) => ({ enabled: b.enabled === false ? true : false }));
  };
  const moveBlock = (idx, dir) => {
    setBlocks(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setDirty(true);
  };
  const duplicateBlock = (idx) => {
    setBlocks(prev => {
      const next = [...prev];
      const src = next[idx];
      next.splice(idx + 1, 0, { type: src.type, enabled: src.enabled !== false, data: JSON.parse(JSON.stringify(src.data || {})) });
      return next;
    });
    setDirty(true);
  };
  const deleteBlock = (idx) => {
    if (!window.confirm('Delete this section? This only removes it from the homepage layout — your text and images can be recovered by re-adding the same block type and pasting them back.')) return;
    setBlocks(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };
  const addBlock = (type) => {
    const data = (BLOCK_DEFAULTS[type] || (() => ({})))();
    setBlocks(prev => [...prev, { type, enabled: true, data }]);
    setDirty(true);
  };
  const insertBlockAt = (idx, type) => {
    const data = (BLOCK_DEFAULTS[type] || (() => ({})))();
    setBlocks(prev => {
      const next = [...prev];
      next.splice(idx, 0, { type, enabled: true, data });
      return next;
    });
    setDirty(true);
  };

  const blockHandlers = {
    moveBlock, duplicateBlock, deleteBlock, toggleEnabled,
    addBlock, insertBlockAt, updateBlockData,
    openEditor: setEditingIdx,
  };

  if (!doc) return <div className="loading-center"><div className="spinner" /></div>;

  const cardStyle = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px 22px', marginBottom: '14px',
  };
  const note = { fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: '14px', lineHeight: 1.5 };

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Page picker — selects which surface (homepage / shop / group buys) the editor drives. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {PAGE_OPTIONS.map(opt => {
          const active = opt.key === pageKey;
          return (
            <button key={opt.key} onClick={() => switchPage(opt.key)}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-pill)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--ink-muted)',
                fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', fontWeight: 500,
                cursor: 'pointer', transition: 'all var(--transition)',
              }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Mode switcher header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: '18px' }}>
        <div>
          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.4rem', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            {pageMeta.label}
          </h3>
          <p style={note}>
            {mode === 'preview'
              ? 'You\'re seeing the page as a customer would. Hover any section to edit, hide, duplicate, or reorder it.'
              : 'Compact list view. Useful when you have many sections and want to scan them quickly.'}
            {pageMeta.hasGridAlign && (
              <span> Catalog grid renders below the blocks.</span>
            )}
          </p>
        </div>
        <ModeSwitcher mode={mode} setMode={setMode} />
      </div>

      {/* Catalog grid alignment — only relevant for pages that have a catalog under the blocks. */}
      {pageMeta.hasGridAlign && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          padding: '12px 16px', marginBottom: 16,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
              Catalog grid alignment
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 4 }}>
              Controls the {pageMeta.key === 'shop' ? 'products' : 'group buys'} grid that renders below your blocks.
            </p>
          </div>
          <div style={{ minWidth: 240 }}>
            <SegmentedControl
              value={gridAlign}
              options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centered' }]}
              onChange={v => { setGridAlign(v); setDirty(true); }}
              compact
            />
          </div>
        </div>
      )}

      {mode === 'preview' ? (
        <PreviewEditor
          blocks={blocks}
          products={products}
          groupBuys={groupBuys}
          countByCategory={countByCategory}
          handlers={blockHandlers}
        />
      ) : (
        <ListEditorBody
          blocks={blocks}
          cardStyle={cardStyle}
          expanded={expanded}
          setExpanded={setExpanded}
          handlers={blockHandlers}
          products={products}
          groupBuys={groupBuys}
        />
      )}

      {/* Sticky footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        padding: '14px var(--page-pad)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ fontSize: '0.8rem', color: dirty ? 'var(--accent)' : 'var(--ink-muted)' }}>
          {dirty ? `Unsaved changes — ${pageMeta.label}` : `${pageMeta.label} · last saved ${relativeTime(doc?.updatedAt)}`}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-outline" onClick={fetchContent} disabled={!dirty || saving}>Cancel</button>
          <button className="btn-dark" onClick={handleSave} disabled={saving || !dirty}>
            <span>{saving ? 'Saving…' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Inline edit modal (preview mode) */}
      {editingIdx !== null && blocks[editingIdx] && (
        <EditModal
          block={blocks[editingIdx]}
          onChange={patch => updateBlockData(editingIdx, patch)}
          onClose={() => setEditingIdx(null)}
          products={products}
          groupBuys={groupBuys}
        />
      )}
    </div>
  );
}

/* ─── List-editor body (legacy compact view, untouched logic) ─── */
function ListEditorBody({ blocks, cardStyle, expanded, setExpanded, handlers, products, groupBuys = [] }) {
  const { moveBlock, duplicateBlock, deleteBlock, toggleEnabled, updateBlockData, addBlock } = handlers;
  return (
    <>
      {blocks.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px', color: 'var(--ink-muted)' }}>
          No sections yet — add one below to start.
        </div>
      )}

      {blocks.map((block, idx) => {
        const meta = BLOCK_META[block.type] || { label: block.type, icon: '?', summary: () => '' };
        const isExpanded = expanded[block._id || idx];
        const isDisabled = block.enabled === false;
        return (
          <div key={block._id || idx} style={{ ...cardStyle, opacity: isDisabled ? 0.55 : 1 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isExpanded ? '16px' : 0 }}>
              <span style={{ fontSize: '1.1rem', color: 'var(--accent)', width: 22, textAlign: 'center' }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 600 }}>{meta.label}</span>
                  {isDisabled && <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hidden</span>}
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 500, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {meta.summary(block.data || {})}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} title="Move up" style={iconBtn(idx === 0)}>↑</button>
                <button onClick={() => moveBlock(idx, +1)} disabled={idx === blocks.length - 1} title="Move down" style={iconBtn(idx === blocks.length - 1)}>↓</button>
                <button onClick={() => toggleEnabled(idx)} title={isDisabled ? 'Show' : 'Hide'} style={iconBtn(false)}>
                  {isDisabled ? '○' : '●'}
                </button>
                <button onClick={() => duplicateBlock(idx)} title="Duplicate" style={iconBtn(false)}>⎘</button>
                <button onClick={() => deleteBlock(idx)} title="Delete" style={{ ...iconBtn(false), color: '#c0392b' }}>✕</button>
                <button onClick={() => setExpanded(e => ({ ...e, [block._id || idx]: !isExpanded }))} title={isExpanded ? 'Collapse' : 'Edit'}
                  style={{ ...iconBtn(false), fontWeight: 600, padding: '6px 10px', fontSize: '0.72rem' }}>
                  {isExpanded ? 'Done' : 'Edit'}
                </button>
              </div>
            </div>

            {/* Body */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <BlockEditor block={block} onChange={patch => updateBlockData(idx, patch)} products={products} groupBuys={groupBuys} />
              </div>
            )}
          </div>
        );
      })}

      {/* Add-block strip */}
      <div style={{ ...cardStyle, background: 'var(--bg-secondary)', borderStyle: 'dashed' }}>
        <p style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '10px', fontWeight: 600 }}>
          + Add Section
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(BLOCK_META).filter(([, m]) => !m.hidden).map(([type, m]) => (
            <button key={type} onClick={() => addBlock(type)} className="btn-outline" style={{ fontSize: '0.82rem', padding: '8px 14px' }}>
              <span style={{ color: 'var(--accent)', marginRight: 6 }}>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function iconBtn(disabled) {
  return {
    width: 30, height: 30, borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--ink)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize: '0.85rem',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  };
}


/* ─── Per-block field editors ─── */
function BlockEditor({ block, onChange, products = [], groupBuys = [] }) {
  const data = block.data || {};
  switch (block.type) {
    case 'hero':          return <HeroEditor data={data} onChange={onChange} />;
    case 'categoryStrip': return <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>No options — the category strip shows links to all categories with their live counts.</p>;
    case 'collection':    return <CollectionEditor data={data} onChange={onChange} products={products} groupBuys={groupBuys} />;
    case 'productGrid':   return <ProductGridEditor data={data} onChange={onChange} products={products} />;
    case 'productHero':   return <ProductHeroEditor data={data} onChange={onChange} products={products} />;
    case 'groupBuys':     return <GroupBuysEditor data={data} onChange={onChange} />;
    case 'banner':        return <BannerEditor data={data} onChange={onChange} />;
    default:              return <p>Unknown block type</p>;
  }
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label className="form-label">{label}</label>
      {children}
      {hint && <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const Row = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>{children}</div>
);


function HeroEditor({ data, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files) => {
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadImage(f));
      onChange({ images: [...(data.images || []), ...urls.map(url => ({ url, altText: '' }))] });
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (i) => {
    onChange({ images: (data.images || []).filter((_, j) => j !== i) });
  };
  const moveImage = (i, dir) => {
    const imgs = [...(data.images || [])];
    const t = i + dir;
    if (t < 0 || t >= imgs.length) return;
    [imgs[i], imgs[t]] = [imgs[t], imgs[i]];
    onChange({ images: imgs });
  };

  return (
    <>
      <Field label="Eyebrow" hint="Small label above the title.">
        <input className="form-input" value={data.eyebrow || ''} onChange={e => onChange({ eyebrow: e.target.value })} />
      </Field>
      <Field label="Title" hint="Wrap words in *asterisks* to italicize.">
        <input className="form-input" value={data.title || ''} onChange={e => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <textarea className="form-input" rows={3} style={{ resize: 'vertical' }} value={data.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      </Field>
      <Row>
        <Field label="Primary CTA Label">
          <input className="form-input" value={data.primaryCtaLabel || ''} onChange={e => onChange({ primaryCtaLabel: e.target.value })} />
        </Field>
        <Field label="Primary CTA Link">
          <input className="form-input" value={data.primaryCtaLink || ''} onChange={e => onChange({ primaryCtaLink: e.target.value })} />
        </Field>
      </Row>
      <Row>
        <Field label="Secondary CTA Label" hint="Leave blank to hide.">
          <input className="form-input" value={data.secondaryCtaLabel || ''} onChange={e => onChange({ secondaryCtaLabel: e.target.value })} />
        </Field>
        <Field label="Secondary CTA Link">
          <input className="form-input" value={data.secondaryCtaLink || ''} onChange={e => onChange({ secondaryCtaLink: e.target.value })} />
        </Field>
      </Row>

      <Field label="Hero Images" hint="Multiple images cycle as a carousel. Recommended: 2400 × 1200, landscape.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {(data.images || []).map((img, i) => (
            <div key={i} style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <img src={img.url} alt="" style={{ width: 120, height: 80, objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2 }}>
                <button onClick={() => moveImage(i, -1)} disabled={i === 0} style={miniBtn(i === 0)}>‹</button>
                <button onClick={() => moveImage(i, +1)} disabled={i === (data.images || []).length - 1} style={miniBtn(i === (data.images || []).length - 1)}>›</button>
                <button onClick={() => removeImage(i)} style={{ ...miniBtn(false), background: '#c0392b', color: '#fff' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) handleUpload(Array.from(e.target.files)); e.target.value = ''; }} />
        <button className="btn-outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : '+ Upload Images'}
        </button>
      </Field>
    </>
  );
}

function miniBtn(disabled) {
  return {
    width: 20, height: 20, borderRadius: 4,
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    background: 'rgba(0,0,0,0.6)', color: '#fff',
    fontSize: '0.7rem', padding: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}


function ProductGridEditor({ data, onChange, products = [] }) {
  const hasPinned = Array.isArray(data.productIds) && data.productIds.length > 0;
  return (
    <>
      <Row>
        <Field label="Eyebrow" hint="Small label above the title (optional).">
          <input className="form-input" value={data.eyebrow || ''} onChange={e => onChange({ eyebrow: e.target.value })} />
        </Field>
        <Field label="Title">
          <input className="form-input" value={data.title || ''} onChange={e => onChange({ title: e.target.value })} />
        </Field>
      </Row>
      <Field label="Subtitle">
        <input className="form-input" value={data.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      </Field>

      {/* ── Pinned products picker (overrides filter/sort below) ── */}
      <Field
        label={hasPinned ? `Featured products · ${data.productIds.length} pinned` : 'Featured products'}
        hint={hasPinned
          ? 'These exact products will render in this order. The Category/Sort/Limit fields below are ignored while any product is pinned.'
          : 'Pin specific products here, or leave empty to auto-fill using the Category/Sort/Limit below.'}>
        <ProductPicker
          productIds={data.productIds || []}
          products={products}
          onChange={ids => onChange({ productIds: ids })}
        />
      </Field>

      <div style={{ opacity: hasPinned ? 0.55 : 1, pointerEvents: hasPinned ? 'none' : 'auto', borderTop: '1px dashed var(--border-subtle)', paddingTop: 12, marginTop: 12 }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Auto-fill fallback {hasPinned && '(disabled while products are pinned)'}
        </p>
        <Row>
          <Field label="Category Filter">
            <select className="form-input" value={data.category || ''} onChange={e => onChange({ category: e.target.value })}>
              {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Sort">
            <select className="form-input" value={data.sort || 'featured'} onChange={e => onChange({ sort: e.target.value })}>
              <option value="featured">Featured (default order)</option>
              <option value="newest">Newest first</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Limit" hint="Maximum products shown.">
            <input className="form-input" type="number" min="1" max="50" value={data.limit ?? 6} onChange={e => onChange({ limit: Number(e.target.value) || 6 })} />
          </Field>
          <Field label="View-All Link">
            <input className="form-input" value={data.viewAllLink || ''} onChange={e => onChange({ viewAllLink: e.target.value })} />
          </Field>
        </Row>
      </div>

      <ProductPresentationFields data={data} onChange={onChange} />

      <BgAlignFields data={data} onChange={onChange} />
    </>
  );
}


/* ─── Presentation knobs for the product grid block ─── */
const GRID_LAYOUTS = [
  { value: 'carousel', label: 'Carousel', desc: 'Horizontal scroll' },
  { value: 'grid',     label: 'Grid',     desc: 'Wraps into rows' },
];
const CARD_SIZES = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];
const CARD_ASPECTS = [
  { value: 'square',    label: 'Square (1:1)' },
  { value: 'portrait',  label: 'Portrait (3:4)' },
  { value: 'landscape', label: 'Landscape (4:3)' },
];
const CARD_STYLES = [
  { value: 'default', label: 'Default' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'boxed',   label: 'Boxed' },
];
const BUTTON_STYLES = [
  { value: 'arrow',  label: 'Arrow circle' },
  { value: 'text',   label: 'Text + arrow' },
  { value: 'hidden', label: 'No button' },
];

function ProductPresentationFields({ data, onChange }) {
  const [open, setOpen] = useState(false);
  const isGrid = (data.layout || 'carousel') === 'grid';
  return (
    <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: 14, paddingTop: 14 }}>
      <button type="button" onClick={() => setOpen(s => !s)}
        style={{
          background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer',
          fontSize: '0.82rem', fontWeight: 600, padding: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s', display: 'inline-block' }}>›</span>
        Presentation
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', fontWeight: 400 }}>
          (layout, card size, fields shown, button style)
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 14, paddingLeft: 14, borderLeft: '2px solid var(--border-subtle)' }}>
          <Row>
            <Field label="Layout">
              <SegmentedControl value={data.layout || 'carousel'} options={GRID_LAYOUTS} onChange={v => onChange({ layout: v })} compact />
            </Field>
            {isGrid && (
              <Field label={`Columns · ${data.columns || 3}`}>
                <input type="range" min="2" max="6" step="1"
                  value={data.columns || 3}
                  onChange={e => onChange({ columns: Number(e.target.value) })}
                  style={{ width: '100%' }} />
              </Field>
            )}
          </Row>
          <Row>
            <Field label="Card size">
              <SegmentedControl value={data.cardSize || 'md'} options={CARD_SIZES} onChange={v => onChange({ cardSize: v })} compact />
            </Field>
            <Field label="Image aspect">
              <SegmentedControl value={data.cardAspect || 'square'} options={CARD_ASPECTS} onChange={v => onChange({ cardAspect: v })} compact />
            </Field>
          </Row>
          <Row>
            <Field label="Card style">
              <SegmentedControl value={data.cardStyle || 'default'} options={CARD_STYLES} onChange={v => onChange({ cardStyle: v })} compact />
            </Field>
            <Field label="Button">
              <SegmentedControl value={data.buttonStyle || 'arrow'} options={BUTTON_STYLES} onChange={v => onChange({ buttonStyle: v })} compact />
            </Field>
          </Row>
          <Field label="Fields shown">
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <CheckRow label="Category"    checked={data.showCategory    !== false} onChange={v => onChange({ showCategory: v })} />
              <CheckRow label="Description" checked={data.showDescription !== false} onChange={v => onChange({ showDescription: v })} />
              <CheckRow label="Price"       checked={data.showPrice       !== false} onChange={v => onChange({ showPrice: v })} />
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--ink)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}


/* ─── Item picker — pinned list + searchable add. Works for any list of
   items that have { _id, name, images, category } — products and group buys
   both fit the shape, so a single picker covers both sources. ─── */
function ProductPicker({ productIds, products, onChange, kindLabel = 'product', kindLabelPlural = 'products' }) {
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const byId = useMemo(() => new Map(products.map(p => [String(p._id), p])), [products]);
  const pinned = productIds.map(id => byId.get(String(id))).filter(Boolean);

  const pinnedSet = new Set(productIds.map(String));
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => !pinnedSet.has(String(p._id)))
      .filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
      .slice(0, 30);
  }, [products, search, pinnedSet]);

  const move = (i, dir) => {
    const next = [...productIds];
    const t = i + dir;
    if (t < 0 || t >= next.length) return;
    [next[i], next[t]] = [next[t], next[i]];
    onChange(next);
  };
  const remove = (i) => onChange(productIds.filter((_, j) => j !== i));
  const add = (id) => { onChange([...productIds, String(id)]); setSearch(''); };

  return (
    <div>
      {/* Pinned list */}
      {pinned.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', padding: '10px 0' }}>No {kindLabelPlural} pinned yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {pinned.map((p, i) => (
            <div key={p._id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px 6px 6px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', width: 18, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {i + 1}
              </span>
              {p.images?.[0]?.url ? (
                <img src={p.images[0].url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--bg-secondary)', flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}
              </span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={miniIconBtn(i === 0)} title="Move up">↑</button>
              <button type="button" onClick={() => move(i, +1)} disabled={i === pinned.length - 1} style={miniIconBtn(i === pinned.length - 1)} title="Move down">↓</button>
              <button type="button" onClick={() => remove(i)} style={{ ...miniIconBtn(false), color: '#c0392b' }} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add product — search input that reveals a results dropdown */}
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          placeholder={`+ Add ${kindLabel} — type name or category`}
          value={search}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
        />
        {searchOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5,
            marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', maxHeight: 280, overflowY: 'auto',
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          }}>
            {candidates.length === 0 ? (
              <p style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                {search ? 'No matches.' : `All ${kindLabelPlural} already pinned.`}
              </p>
            ) : candidates.map(p => (
              <button key={p._id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => add(p._id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', color: 'var(--ink)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {p.images?.[0]?.url ? (
                  <img src={p.images[0].url} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--bg-secondary)', flexShrink: 0 }} />
                )}
                <span style={{ flex: 1, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function miniIconBtn(disabled) {
  return {
    width: 24, height: 24, borderRadius: 4,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--ink)', fontSize: '0.78rem',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1,
    padding: 0, flexShrink: 0,
  };
}


/* ─── Mixed item picker — pins from products AND group buys in one list.
   Each pinned entry is { type: 'product' | 'group-buy', id }. The dropdown
   shows both lists side-by-side with a type badge so admin can scan quickly. */
function MixedPicker({ value, products, groupBuys, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeType, setActiveType] = useState('all'); // 'all' | 'product' | 'group-buy'

  const productById = useMemo(() => new Map(products.map(p => [String(p._id), p])), [products]);
  const gbById      = useMemo(() => new Map(groupBuys.map(g => [String(g._id), g])), [groupBuys]);

  const pinned = items.map(ref => {
    if (!ref?.id) return null;
    const data = ref.type === 'group-buy' ? gbById.get(String(ref.id)) : productById.get(String(ref.id));
    return data ? { type: ref.type, data } : null;
  }).filter(Boolean);

  const pinnedKey = (type, id) => `${type}:${id}`;
  const pinnedSet = new Set(items.map(r => pinnedKey(r.type, String(r.id))));

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (p) => !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);

    const productCandidates = activeType === 'group-buy'
      ? []
      : products.filter(p => !pinnedSet.has(pinnedKey('product', String(p._id)))).filter(matches).slice(0, 20);
    const gbCandidates = activeType === 'product'
      ? []
      : groupBuys.filter(g => !pinnedSet.has(pinnedKey('group-buy', String(g._id)))).filter(matches).slice(0, 20);

    return [
      ...productCandidates.map(p => ({ type: 'product', data: p })),
      ...gbCandidates.map(g => ({ type: 'group-buy', data: g })),
    ];
  }, [products, groupBuys, search, activeType, pinnedSet]);

  const move = (i, dir) => {
    const next = [...items];
    const t = i + dir;
    if (t < 0 || t >= next.length) return;
    [next[i], next[t]] = [next[t], next[i]];
    onChange(next);
  };
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const add = (type, id) => { onChange([...items, { type, id: String(id) }]); setSearch(''); };

  const typeBadge = (type) => (
    <span style={{
      fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 6, flexShrink: 0,
      background: type === 'group-buy' ? 'rgba(192, 80, 80, 0.12)' : 'var(--accent-light)',
      color:      type === 'group-buy' ? '#9b3a3a' : 'var(--accent)',
    }}>
      {type === 'group-buy' ? 'GB' : 'In Stock'}
    </span>
  );

  return (
    <div>
      {/* Pinned list */}
      {pinned.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', padding: '10px 0' }}>No items pinned yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {pinned.map((p, i) => (
            <div key={`${p.type}:${p.data._id}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px 6px 6px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', width: 18, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {i + 1}
              </span>
              {p.data.images?.[0]?.url ? (
                <img src={p.data.images[0].url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--bg-secondary)', flexShrink: 0 }} />
              )}
              {typeBadge(p.type)}
              <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.data.name}
              </span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={miniIconBtn(i === 0)} title="Move up">↑</button>
              <button type="button" onClick={() => move(i, +1)} disabled={i === pinned.length - 1} style={miniIconBtn(i === pinned.length - 1)} title="Move down">↓</button>
              <button type="button" onClick={() => remove(i)} style={{ ...miniIconBtn(false), color: '#c0392b' }} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Type filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {[
          { key: 'all',        label: 'Both' },
          { key: 'product',    label: 'Products only' },
          { key: 'group-buy',  label: 'Group buys only' },
        ].map(opt => (
          <button key={opt.key} type="button" onClick={() => setActiveType(opt.key)}
            style={{
              fontSize: '0.7rem', padding: '4px 10px', borderRadius: 999,
              border: `1px solid ${activeType === opt.key ? 'var(--accent)' : 'var(--border)'}`,
              background: activeType === opt.key ? 'var(--accent-light)' : 'var(--surface)',
              color: activeType === opt.key ? 'var(--accent)' : 'var(--ink-muted)',
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Search input + dropdown — same UX as ProductPicker. */}
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          placeholder="+ Add item — type name or category"
          value={search}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
        />
        {searchOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5,
            marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', maxHeight: 320, overflowY: 'auto',
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          }}>
            {candidates.length === 0 ? (
              <p style={{ padding: 12, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                {search ? 'No matches.' : 'All items already pinned.'}
              </p>
            ) : candidates.map(c => (
              <button key={`${c.type}:${c.data._id}`} type="button" onMouseDown={e => e.preventDefault()}
                onClick={() => add(c.type, c.data._id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', color: 'var(--ink)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {c.data.images?.[0]?.url ? (
                  <img src={c.data.images[0].url} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--bg-secondary)', flexShrink: 0 }} />
                )}
                {typeBadge(c.type)}
                <span style={{ flex: 1, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.data.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.data.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function GroupBuysEditor({ data, onChange }) {
  return (
    <>
      <Row>
        <Field label="Eyebrow" hint="Small label above the title (optional).">
          <input className="form-input" value={data.eyebrow || ''} onChange={e => onChange({ eyebrow: e.target.value })} />
        </Field>
        <Field label="Title">
          <input className="form-input" value={data.title || ''} onChange={e => onChange({ title: e.target.value })} />
        </Field>
      </Row>
      <Field label="Subtitle">
        <input className="form-input" value={data.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      </Field>
      <Row>
        <Field label="Mode">
          <select className="form-input" value={data.mode || 'active'} onChange={e => onChange({ mode: e.target.value })}>
            <option value="active">Active group buys</option>
            <option value="interest-check">Interest checks</option>
          </select>
        </Field>
        <Field label="Limit">
          <input className="form-input" type="number" min="1" max="20" value={data.limit ?? 4} onChange={e => onChange({ limit: Number(e.target.value) || 4 })} />
        </Field>
      </Row>
      <Field label="View-All Link">
        <input className="form-input" value={data.viewAllLink || ''} onChange={e => onChange({ viewAllLink: e.target.value })} />
      </Field>
      <BgAlignFields data={data} onChange={onChange} />
    </>
  );
}


/* Shared background-tint + alignment selector. Used by any block that benefits
   from visual rhythm. Hero owns its own background image; cat-strip is already
   minimal — neither uses this. */
function BgAlignFields({ data, onChange, showAlign = true }) {
  return (
    <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: '14px', paddingTop: '14px' }}>
      <Field label="Background" hint="Sets the full-bleed tint behind this section to add visual rhythm to the page.">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {BG_OPTIONS.map(opt => {
            const selected = (data.bg || 'default') === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => onChange({ bg: opt.value })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 12px 6px 8px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected ? 'var(--accent-light)' : 'var(--bg)',
                  cursor: 'pointer', fontSize: '0.78rem', color: 'var(--ink)',
                }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: opt.swatch, border: '1px solid var(--border)', flexShrink: 0 }} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>
      {showAlign && (
        <Field label="Header Alignment">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {ALIGN_OPTIONS.map(opt => {
              const selected = (data.align || 'left') === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => onChange({ align: opt.value })}
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    background: selected ? 'var(--accent-light)' : 'var(--bg)',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                  <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{opt.label}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </Field>
      )}
    </div>
  );
}


/* Knob option sets for the banner editor. Kept small so admins can't trap
   themselves with too many choices; the renderer accepts any string for
   `padding`/`height` so power-users can edit JSON if they want custom values. */
const BANNER_TEXT_ALIGNS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];
const BANNER_VERTICAL_ALIGNS = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
];
const BANNER_HEIGHTS = [
  { value: 'short',  label: 'Short',  desc: '280px' },
  { value: 'medium', label: 'Medium', desc: '420px' },
  { value: 'tall',   label: 'Tall',   desc: '520px' },
  { value: 'xtall',  label: 'Extra Tall', desc: '640px' },
];
const BANNER_PADDINGS = [
  { value: 'compact',  label: 'Compact' },
  { value: 'normal',   label: 'Normal' },
  { value: 'spacious', label: 'Spacious' },
];
const BANNER_TEXT_COLORS = [
  { value: 'auto',  label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark',  label: 'Dark' },
];
const BANNER_CTA_STYLES = [
  { value: 'filled',     label: 'Filled button' },
  { value: 'ghost',      label: 'Ghost button' },
  { value: 'text-arrow', label: 'Text + arrow' },
  { value: 'none',       label: 'No CTA' },
];
const BANNER_SCRIM_DIRS = [
  { value: 'flat',   label: 'Flat' },
  { value: 'bottom', label: 'Gradient from bottom' },
  { value: 'top',    label: 'Gradient from top' },
  { value: 'left',   label: 'Gradient from left' },
  { value: 'right',  label: 'Gradient from right' },
  { value: 'radial', label: 'Radial (edges darker)' },
];
const BANNER_CORNER_RADII = [
  { value: 'none', label: 'Square' },
  { value: 'sm',   label: 'Subtle' },
  { value: 'md',   label: 'Medium' },
  { value: 'lg',   label: 'Rounded' },
];

function BannerEditor({ data, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [showStyle, setShowStyle] = useState(false);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange({ image: { url, altText: data.image?.altText || '' } });
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const supportsScrim = data.layout === 'overlay' || data.layout === 'fullbleed';
  const supportsImagePosition = data.layout === 'split' || !data.layout || data.layout === 'stacked';
  const imagePositionOptions = data.layout === 'stacked'
    ? [{ value: 'top', label: 'Image top' }, { value: 'bottom', label: 'Image bottom' }]
    : [{ value: 'right', label: 'Image right' }, { value: 'left', label: 'Image left' }];

  return (
    <>
      {/* ── Structural layout (where the image sits) ── */}
      <Field label="Layout" hint="Picks the structural arrangement. Visual knobs below are independent and override the layout's defaults.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {BANNER_LAYOUTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange({ layout: opt.value })}
              style={{
                padding: '14px 10px', borderRadius: 'var(--radius-sm)',
                border: `2px solid ${(data.layout || 'overlay') === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                background: (data.layout || 'overlay') === opt.value ? 'var(--accent-light)' : 'var(--bg)',
                cursor: 'pointer', textAlign: 'center', transition: 'var(--transition)',
              }}
            >
              <LayoutPreview type={opt.value} />
              <p style={{ fontWeight: 600, fontSize: '0.78rem', marginBottom: '2px', color: 'var(--ink)' }}>{opt.label}</p>
              <p style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </Field>

      {/* ── Image ── */}
      <Field label="Banner Image">
        {data.image?.url ? (
          <img src={data.image.url} alt="Banner"
            style={{ width: 280, height: 160, objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: '10px', display: 'block' }} />
        ) : (
          <div style={{ width: 280, height: 160, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.82rem' }}>No image</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }} />
        <button className="btn-outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : (data.image?.url ? 'Replace Image' : '+ Upload Image')}
        </button>
      </Field>

      {/* ── Text content ── */}
      <Field label="Eyebrow">
        <input className="form-input" value={data.eyebrow || ''} onChange={e => onChange({ eyebrow: e.target.value })} />
      </Field>
      <Field label="Title" hint="Wrap words in *asterisks* to italicize.">
        <input className="form-input" value={data.title || ''} onChange={e => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={data.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      </Field>
      <Row>
        <Field label="CTA Label" hint="Leave blank to hide the CTA entirely.">
          <input className="form-input" value={data.ctaLabel ?? ''} onChange={e => onChange({ ctaLabel: e.target.value })} />
        </Field>
        <Field label="CTA Link">
          <input className="form-input" value={data.ctaLink || ''} onChange={e => onChange({ ctaLink: e.target.value })} />
        </Field>
      </Row>

      {/* ── Style overrides (collapsed by default to avoid clutter) ── */}
      <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: 14, paddingTop: 14 }}>
        <button type="button" onClick={() => setShowStyle(s => !s)}
          style={{
            background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: 600, padding: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <span style={{ transform: showStyle ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s', display: 'inline-block' }}>›</span>
          Style &amp; layout overrides
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', fontWeight: 400 }}>
            (height, padding, scrim, text alignment, CTA style)
          </span>
        </button>

        {showStyle && (
          <div style={{ marginTop: 14, paddingLeft: 14, borderLeft: '2px solid var(--border-subtle)' }}>
            <Row>
              <Field label="Height">
                <SegmentedControl value={data.height || ''} options={[{ value: '', label: 'Auto' }, ...BANNER_HEIGHTS]} onChange={v => onChange({ height: v })} compact />
              </Field>
              <Field label="Padding">
                <SegmentedControl value={data.padding || ''} options={[{ value: '', label: 'Auto' }, ...BANNER_PADDINGS]} onChange={v => onChange({ padding: v })} compact />
              </Field>
            </Row>
            <Row>
              <Field label="Text alignment">
                <SegmentedControl value={data.textAlign || ''} options={[{ value: '', label: 'Auto' }, ...BANNER_TEXT_ALIGNS]} onChange={v => onChange({ textAlign: v })} compact />
              </Field>
              <Field label="Vertical alignment">
                <SegmentedControl value={data.verticalAlign || ''} options={[{ value: '', label: 'Auto' }, ...BANNER_VERTICAL_ALIGNS]} onChange={v => onChange({ verticalAlign: v })} compact />
              </Field>
            </Row>
            <Row>
              <Field label="Text color">
                <SegmentedControl value={data.textColor || ''} options={[{ value: '', label: 'Auto' }, ...BANNER_TEXT_COLORS]} onChange={v => onChange({ textColor: v })} compact />
              </Field>
              <Field label="CTA style">
                <SegmentedControl value={data.ctaStyle || ''} options={[{ value: '', label: 'Auto' }, ...BANNER_CTA_STYLES]} onChange={v => onChange({ ctaStyle: v })} compact />
              </Field>
            </Row>
            <Row>
              <Field label="Corner radius">
                <SegmentedControl value={data.cornerRadius || ''} options={[{ value: '', label: 'Auto' }, ...BANNER_CORNER_RADII]} onChange={v => onChange({ cornerRadius: v })} compact />
              </Field>
              <Field label="Full-bleed" hint="Edges of the banner touch the viewport.">
                <ToggleSwitch checked={!!data.fullBleed} onChange={v => onChange({ fullBleed: v })} />
              </Field>
            </Row>

            {supportsScrim && (
              <>
                <Row>
                  <Field label={`Scrim darkness · ${Math.round((data.scrim ?? 0.55) * 100)}%`} hint="Overlay over the image so text stays readable.">
                    <input type="range" min="0" max="1" step="0.05"
                      value={data.scrim ?? 0.55}
                      onChange={e => onChange({ scrim: Number(e.target.value) })}
                      style={{ width: '100%' }} />
                  </Field>
                  <Field label="Scrim direction">
                    <SegmentedControl value={data.scrimDir || ''} options={[{ value: '', label: 'Auto' }, ...BANNER_SCRIM_DIRS]} onChange={v => onChange({ scrimDir: v })} compact />
                  </Field>
                </Row>
                <Row>
                  <Field label={`Image opacity · ${Math.round((data.imageOpacity ?? 1) * 100)}%`}>
                    <input type="range" min="0.2" max="1" step="0.05"
                      value={data.imageOpacity ?? 1}
                      onChange={e => onChange({ imageOpacity: Number(e.target.value) })}
                      style={{ width: '100%' }} />
                  </Field>
                  <Field label="Image focal point">
                    <SegmentedControl value={data.imageFocal || ''} options={[
                      { value: '', label: 'Center' },
                      { value: 'top', label: 'Top' },
                      { value: 'bottom', label: 'Bottom' },
                    ]} onChange={v => onChange({ imageFocal: v })} compact />
                  </Field>
                </Row>
              </>
            )}

            {supportsImagePosition && (
              <Field label="Image position" hint={data.layout === 'stacked' ? 'Image above or below the text.' : 'Image left or right of the text.'}>
                <SegmentedControl
                  value={data.imagePosition || (data.layout === 'stacked' ? 'top' : 'right')}
                  options={imagePositionOptions}
                  onChange={v => onChange({ imagePosition: v })}
                  compact
                />
              </Field>
            )}
          </div>
        )}
      </div>

      <BgAlignFields data={data} onChange={onChange} showAlign={false} />
    </>
  );
}


/* ─── Product Hero editor — pick 1/2/3 products, each renders as a hero tile ─── */
const HERO_LAYOUTS = [
  { value: 'single', label: 'Single',   desc: '1 tile, full-width' },
  { value: 'pair',   label: 'Pair',     desc: '2 tiles side-by-side' },
  { value: 'triple', label: 'Triple',   desc: '1 big + 2 small stacked' },
];
const HERO_HEIGHTS = [
  { value: 'medium',     label: 'Medium',     desc: '480px' },
  { value: 'tall',       label: 'Tall',       desc: '640px' },
  { value: 'xtall',      label: 'Extra Tall', desc: '760px' },
  { value: 'fullscreen', label: 'Fullscreen', desc: '88vh' },
];
const HERO_IMAGE_STYLES = [
  { value: 'overlay',        label: 'Overlay',      desc: 'Image fills tile, text on top with scrim' },
  { value: 'stacked-below',  label: 'Stacked',      desc: 'Image on top, text under (Apple-style)' },
  { value: 'stacked-above',  label: 'Text on top',  desc: 'Text on top, image under' },
];

function ProductHeroEditor({ data, onChange, products }) {
  const layout = data.layout || 'pair';
  const maxTiles = layout === 'single' ? 1 : layout === 'pair' ? 2 : 3;
  const tiles = data.tiles || [];

  // Auto-resize the tiles array when layout changes (trim or pad). Runs once
  // per layout change; never overwrites user data inside existing tiles.
  useEffect(() => {
    if (tiles.length === maxTiles) return;
    const next = tiles.slice(0, maxTiles);
    while (next.length < maxTiles) {
      next.push({ productId: '', eyebrow: '', subtitle: '', ctaLabel: 'Shop' });
    }
    onChange({ tiles: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxTiles]);

  const updateTile = (idx, patch) => {
    const next = tiles.map((t, i) => i === idx ? { ...t, ...patch } : t);
    onChange({ tiles: next });
  };

  return (
    <>
      {/* ── Optional section header above the tile row ── */}
      <Row>
        <Field label="Eyebrow (optional)">
          <input className="form-input" value={data.eyebrow || ''} onChange={e => onChange({ eyebrow: e.target.value })} />
        </Field>
        <Field label="Title (optional)" hint="Leave blank to skip the header entirely.">
          <input className="form-input" value={data.title || ''} onChange={e => onChange({ title: e.target.value })} />
        </Field>
      </Row>
      <Field label="Subtitle (optional)">
        <input className="form-input" value={data.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      </Field>

      {/* ── Layout & sizing ── */}
      <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: 14, paddingTop: 14 }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Layout
        </p>
        <Field label="Arrangement">
          <SegmentedControl value={layout} options={HERO_LAYOUTS} onChange={v => onChange({ layout: v })} compact />
        </Field>
        <Row>
          <Field label="Tile height">
            <SegmentedControl value={data.height || 'tall'} options={HERO_HEIGHTS} onChange={v => onChange({ height: v })} compact />
          </Field>
          <Field label={`Gap between tiles · ${data.gap ?? 8}px`}>
            <input type="range" min="0" max="48" step="2"
              value={data.gap ?? 8}
              onChange={e => onChange({ gap: Number(e.target.value) })}
              style={{ width: '100%' }} />
          </Field>
        </Row>
        <Row>
          <Field label="Image style">
            <SegmentedControl value={data.imageStyle || 'overlay'} options={HERO_IMAGE_STYLES} onChange={v => onChange({ imageStyle: v })} compact />
          </Field>
          <Field label="Full-bleed" hint="Tiles extend edge-to-edge with no side margin.">
            <ToggleSwitch checked={data.fullBleed !== false} onChange={v => onChange({ fullBleed: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="Text color">
            <SegmentedControl value={data.textColor || 'light'} options={[
              { value: 'light', label: 'Light' },
              { value: 'dark',  label: 'Dark' },
            ]} onChange={v => onChange({ textColor: v })} compact />
          </Field>
          <Field label="Text alignment">
            <SegmentedControl value={data.textAlign || 'center'} options={[
              { value: 'left',   label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right',  label: 'Right' },
            ]} onChange={v => onChange({ textAlign: v })} compact />
          </Field>
        </Row>
        {(data.imageStyle || 'overlay') === 'overlay' && (
          <Field label="Vertical position (overlay only)">
            <SegmentedControl value={data.verticalAlign || 'bottom'} options={[
              { value: 'top',    label: 'Top' },
              { value: 'middle', label: 'Middle' },
              { value: 'bottom', label: 'Bottom' },
            ]} onChange={v => onChange({ verticalAlign: v })} compact />
          </Field>
        )}
      </div>

      {/* ── Tiles ── */}
      <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: 16, paddingTop: 14 }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Tiles · {tiles.filter(t => t.productId).length} / {maxTiles} filled
        </p>
        {tiles.slice(0, maxTiles).map((t, i) => (
          <ProductHeroTileEditor
            key={i}
            index={i}
            tile={t}
            products={products}
            onChange={patch => updateTile(i, patch)}
            isBig={layout === 'triple' && i === 0}
          />
        ))}
      </div>

      <BgAlignFields data={data} onChange={onChange} showAlign={false} />
    </>
  );
}

function ProductHeroTileEditor({ index, tile, products, onChange, isBig }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const byId = useMemo(() => new Map(products.map(p => [String(p._id), p])), [products]);
  const product = byId.get(String(tile.productId));

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
      .slice(0, 24);
  }, [products, search]);

  const cardBg = product ? 'var(--bg)' : 'var(--bg-secondary)';

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      background: cardBg, padding: 12, marginBottom: 10,
    }}>
      {/* Header row: tile label + product chip + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--ink-muted)', fontWeight: 600, padding: '2px 8px',
          background: 'var(--surface)', borderRadius: 4, flexShrink: 0,
        }}>
          Tile {index + 1}{isBig ? ' · Big' : ''}
        </span>

        {/* Product selector — collapsed chip when picked, search dropdown when empty */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {product ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {product.images?.[0]?.url ? (
                <img src={product.images[0].url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--bg-secondary)', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: '0.88rem', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {product.name}
              </span>
            </div>
          ) : (
            <>
              <input
                className="form-input"
                placeholder="Pick a product — type name or category"
                value={search}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
                style={{ fontSize: '0.85rem' }}
              />
              {searchOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', maxHeight: 280, overflowY: 'auto',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                }}>
                  {candidates.length === 0 ? (
                    <p style={{ padding: 12, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>No matches.</p>
                  ) : candidates.map(p => (
                    <button key={p._id} type="button" onMouseDown={e => e.preventDefault()}
                      onClick={() => { onChange({ productId: String(p._id) }); setSearch(''); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', color: 'var(--ink)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {p.images?.[0]?.url ? (
                        <img src={p.images[0].url} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--bg-secondary)' }} />
                      )}
                      <span style={{ flex: 1, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {product && (
          <button type="button" onClick={() => onChange({ productId: '' })}
            style={{ fontSize: '0.72rem', padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--ink-muted)' }}>
            Change
          </button>
        )}
        <button type="button" onClick={() => setExpanded(s => !s)}
          style={{ fontSize: '0.72rem', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--ink)' }}>
          {expanded ? 'Done' : 'Customize'}
        </button>
      </div>

      {/* Expanded per-tile fields */}
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <Row>
            <Field label="Eyebrow" hint={`Default: product category (${product?.category || '—'})`}>
              <input className="form-input" value={tile.eyebrow ?? ''} onChange={e => onChange({ eyebrow: e.target.value })} />
            </Field>
            <Field label="Title override" hint={`Default: product name (${product?.name || '—'})`}>
              <input className="form-input" value={tile.titleOverride || ''} onChange={e => onChange({ titleOverride: e.target.value })} />
            </Field>
          </Row>
          <Field label="Subtitle / tagline">
            <input className="form-input" value={tile.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
          </Field>
          <Row>
            <Field label="CTA label" hint="Blank = hide CTA.">
              <input className="form-input" value={tile.ctaLabel ?? ''} placeholder="Shop" onChange={e => onChange({ ctaLabel: e.target.value })} />
            </Field>
            <Field label="CTA link" hint="Defaults to the product detail page.">
              <input className="form-input" value={tile.ctaLink || ''} placeholder={product ? `/products/${product._id}` : ''} onChange={e => onChange({ ctaLink: e.target.value })} />
            </Field>
          </Row>
          <Row>
            <Field label="Text color override">
              <SegmentedControl value={tile.textColor || ''} options={[
                { value: '',      label: 'Inherit' },
                { value: 'light', label: 'Light' },
                { value: 'dark',  label: 'Dark' },
              ]} onChange={v => onChange({ textColor: v })} compact />
            </Field>
            <Field label="Background override (CSS color)" hint="Leave blank to use default tile background.">
              <input className="form-input" value={tile.bg || ''} placeholder="#1a1a18 or var(--accent)" onChange={e => onChange({ bg: e.target.value })} />
            </Field>
          </Row>
          {/* Per-tile scrim — only meaningful in overlay mode, where text sits on the image.
              Slider range is 0 (no overlay) to 1 (solid black). Stacked layouts ignore this. */}
          <Field
            label={`Scrim darkness · ${Math.round((tile.scrim ?? 0.45) * 100)}%`}
            hint="Overlay over the image so text stays readable. Only applies to overlay layout.">
            <input type="range" min="0" max="1" step="0.05"
              value={tile.scrim ?? 0.45}
              onChange={e => onChange({ scrim: Number(e.target.value) })}
              style={{ width: '100%' }} />
          </Field>
        </div>
      )}
    </div>
  );
}


/* ─── Unified Collection editor ───────────────────────────────────────────
   One editor for all "row of items" sections. Admin picks source (products
   vs group-buys) and layout (carousel / grid / hero); the relevant fields
   reveal conditionally. Replaces ProductGridEditor + ProductHeroEditor +
   GroupBuysEditor in the new schema; the legacy editors stay defined for
   not-yet-migrated docs. */

const SOURCE_OPTIONS = [
  { value: 'products',   label: 'Products',   desc: 'In-stock catalog' },
  { value: 'group-buys', label: 'Group Buys', desc: 'Live group-buy feed' },
  { value: 'mixed',      label: 'Mixed',      desc: 'Pin any product + group buy in one row' },
];
const COLLECTION_LAYOUT_OPTIONS = [
  { value: 'carousel', label: 'Carousel', desc: 'Horizontal scroll row (manual)' },
  { value: 'grid',     label: 'Grid',     desc: 'Wraps into rows' },
  { value: 'hero',     label: 'Hero',     desc: 'Large spotlight tiles' },
  { value: 'marquee',  label: 'Marquee',  desc: 'Auto-scrolling infinite loop' },
];
const GB_MODE_OPTIONS = [
  { value: 'active',          label: 'Active' },
  { value: 'interest-check',  label: 'Interest checks' },
];

function CollectionEditor({ data, onChange, products, groupBuys = [] }) {
  const source = data.source || 'products';
  const layout = data.layout || 'carousel';
  const hasPinnedProducts = source === 'products' && layout !== 'hero'
    && Array.isArray(data.productIds) && data.productIds.length > 0;
  const hasPinnedGbs = source === 'group-buys' && layout !== 'hero'
    && Array.isArray(data.gbIds) && data.gbIds.length > 0;

  // Mixed source doesn't support hero (tile editor expects a single productId).
  // Hide the hero option when source is mixed; flip back to carousel if needed.
  const layoutOptions = source === 'mixed'
    ? COLLECTION_LAYOUT_OPTIONS.filter(o => o.value !== 'hero')
    : COLLECTION_LAYOUT_OPTIONS;
  useEffect(() => {
    if (source === 'mixed' && layout === 'hero') onChange({ layout: 'carousel' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <>
      {/* Step 1 — what does this section show? */}
      <Field label="Content source" hint="Pick what fills this section.">
        <SegmentedControl value={source} options={SOURCE_OPTIONS} onChange={v => onChange({ source: v })} />
      </Field>

      {/* Step 2 — how does it render? */}
      <Field label="Layout">
        <SegmentedControl value={layout} options={layoutOptions} onChange={v => onChange({ layout: v })} />
      </Field>

      {/* Step 3 — header (always available) */}
      <Row>
        <Field label="Eyebrow">
          <input className="form-input" value={data.eyebrow || ''} onChange={e => onChange({ eyebrow: e.target.value })} />
        </Field>
        <Field label="Title">
          <input className="form-input" value={data.title || ''} onChange={e => onChange({ title: e.target.value })} />
        </Field>
      </Row>
      <Field label="Subtitle">
        <input className="form-input" value={data.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
      </Field>

      {/* Step 4 — content selection (source-aware). Products and group-buys
          now share the same pinned-picker + auto-fill UX. */}
      {source === 'products' && layout !== 'hero' && (
        <>
          <Field
            label={hasPinnedProducts ? `Pinned products · ${data.productIds.length}` : 'Pinned products'}
            hint={hasPinnedProducts
              ? 'These exact products render in this order. The auto-fill fields below are ignored.'
              : 'Pin specific products here, or leave empty to auto-fill using the filters below.'}>
            <ProductPicker
              productIds={data.productIds || []}
              products={products}
              onChange={ids => onChange({ productIds: ids })}
            />
          </Field>

          <div style={{ opacity: hasPinnedProducts ? 0.55 : 1, pointerEvents: hasPinnedProducts ? 'none' : 'auto', borderTop: '1px dashed var(--border-subtle)', paddingTop: 12, marginTop: 12 }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Auto-fill fallback {hasPinnedProducts && '(disabled while products are pinned)'}
            </p>
            <Row>
              <Field label="Category filter">
                <select className="form-input" value={data.category || ''} onChange={e => onChange({ category: e.target.value })}>
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Sort">
                <select className="form-input" value={data.sort || 'featured'} onChange={e => onChange({ sort: e.target.value })}>
                  <option value="featured">Featured (default order)</option>
                  <option value="newest">Newest first</option>
                </select>
              </Field>
            </Row>
            <Row>
              <Field label="Limit" hint="Maximum products shown.">
                <input className="form-input" type="number" min="1" max="50" value={data.limit ?? 6} onChange={e => onChange({ limit: Number(e.target.value) || 6 })} />
              </Field>
              <Field label="View-All Link">
                <input className="form-input" value={data.viewAllLink || ''} onChange={e => onChange({ viewAllLink: e.target.value })} />
              </Field>
            </Row>
          </div>
        </>
      )}

      {source === 'products' && layout === 'hero' && (
        <CollectionHeroTilesField data={data} onChange={onChange} products={products} />
      )}

      {source === 'group-buys' && layout !== 'hero' && (
        <>
          <Field
            label={hasPinnedGbs ? `Pinned group buys · ${data.gbIds.length}` : 'Pinned group buys'}
            hint={hasPinnedGbs
              ? 'These exact group buys render in this order. The auto-fill fields below are ignored.'
              : 'Pin specific group buys here, or leave empty to auto-fill using the filter + limit below.'}>
            <ProductPicker
              productIds={data.gbIds || []}
              products={groupBuys}
              onChange={ids => onChange({ gbIds: ids })}
              kindLabel="group buy"
              kindLabelPlural="group buys"
            />
          </Field>

          <div style={{ opacity: hasPinnedGbs ? 0.55 : 1, pointerEvents: hasPinnedGbs ? 'none' : 'auto', borderTop: '1px dashed var(--border-subtle)', paddingTop: 12, marginTop: 12 }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Auto-fill fallback {hasPinnedGbs && '(disabled while group buys are pinned)'}
            </p>
            <Row>
              <Field label="Filter">
                <SegmentedControl value={data.gbMode || 'active'} options={GB_MODE_OPTIONS} onChange={v => onChange({ gbMode: v })} compact />
              </Field>
              <Field label="Limit" hint="Maximum cards shown.">
                <input className="form-input" type="number" min="1" max="20" value={data.limit ?? 4}
                  onChange={e => onChange({ limit: Number(e.target.value) || 4 })} />
              </Field>
            </Row>
            <Field label="View-All Link">
              <input className="form-input" value={data.viewAllLink || ''} onChange={e => onChange({ viewAllLink: e.target.value })} />
            </Field>
          </div>
        </>
      )}

      {source === 'group-buys' && layout === 'hero' && (
        <Field label="Filter" hint="Hero variant decides count (1 / 2 / 3). The first matching group buys fill the tiles.">
          <SegmentedControl value={data.gbMode || 'active'} options={GB_MODE_OPTIONS} onChange={v => onChange({ gbMode: v })} compact />
        </Field>
      )}

      {source === 'mixed' && (
        <Field
          label={`Pinned items · ${(data.mixedItems || []).length}`}
          hint="Pin any combination of products and group buys. They render in the order shown. Mixed sections don't have an auto-fill — only pinned items appear.">
          <MixedPicker
            value={data.mixedItems || []}
            products={products}
            groupBuys={groupBuys}
            onChange={items => onChange({ mixedItems: items })}
          />
        </Field>
      )}

      {/* Step 5 — layout-specific knobs */}
      {layout === 'grid' && (
        <>
          <Field label={`Columns · ${data.columns || 3}`}>
            <input type="range" min="2" max="6" step="1"
              value={data.columns || 3}
              onChange={e => onChange({ columns: Number(e.target.value) })}
              style={{ width: '100%' }} />
          </Field>
          <Field label="Item alignment" hint="Centered alignment only matters when a row has fewer cards than the column count.">
            <SegmentedControl
              value={data.itemAlign || 'left'}
              options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centered' }]}
              onChange={v => onChange({ itemAlign: v })}
              compact
            />
          </Field>
        </>
      )}

      {layout === 'hero' && <CollectionHeroLayoutFields data={data} onChange={onChange} />}

      {layout === 'marquee' && (
        <>
          <Field
            label={`Scroll speed · ${data.marqueeSpeed ?? 40} px/sec`}
            hint="Pixels per second. The animation duration recalculates from the row's measured width so adding more items doesn't speed it up.">
            <input type="range" min="10" max="120" step="5"
              value={data.marqueeSpeed ?? 40}
              onChange={e => onChange({ marqueeSpeed: Number(e.target.value) })}
              style={{ width: '100%' }} />
          </Field>
          <Field label={`Gap between cards · ${data.gap ?? 24}px`}>
            <input type="range" min="8" max="48" step="2"
              value={data.gap ?? 24}
              onChange={e => onChange({ gap: Number(e.target.value) })}
              style={{ width: '100%' }} />
          </Field>
        </>
      )}

      {/* Step 6 — card presentation (carousel/grid/marquee for both sources). Group-buy
          cards now read the same knobs as product cards. */}
      {layout !== 'hero' && (
        <CardPresentationFields data={data} onChange={onChange} source={source} />
      )}

      <BgAlignFields data={data} onChange={onChange} />
    </>
  );
}

/* Card-level presentation knobs (size, aspect, style, button, fields-shown).
   No layout/columns here — CollectionEditor owns those at the top level.
   `source` is forwarded so source-specific toggles (e.g. group-buy meta line)
   only appear when relevant. */
function CardPresentationFields({ data, onChange, source = 'products' }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: 14, paddingTop: 14 }}>
      <button type="button" onClick={() => setOpen(s => !s)}
        style={{
          background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer',
          fontSize: '0.82rem', fontWeight: 600, padding: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s', display: 'inline-block' }}>›</span>
        Card presentation
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', fontWeight: 400 }}>
          (size, aspect, fields, button)
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 14, paddingLeft: 14, borderLeft: '2px solid var(--border-subtle)' }}>
          <Row>
            <Field label="Card size">
              <SegmentedControl value={data.cardSize || 'md'} options={CARD_SIZES} onChange={v => onChange({ cardSize: v })} compact />
            </Field>
            <Field label="Image aspect">
              <SegmentedControl value={data.cardAspect || 'square'} options={CARD_ASPECTS} onChange={v => onChange({ cardAspect: v })} compact />
            </Field>
          </Row>
          <Row>
            <Field label="Card style">
              <SegmentedControl value={data.cardStyle || 'default'} options={CARD_STYLES} onChange={v => onChange({ cardStyle: v })} compact />
            </Field>
            <Field label="Button">
              <SegmentedControl value={data.buttonStyle || 'arrow'} options={BUTTON_STYLES} onChange={v => onChange({ buttonStyle: v })} compact />
            </Field>
          </Row>
          <Field label="Fields shown">
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <CheckRow label="Category"    checked={data.showCategory    !== false} onChange={v => onChange({ showCategory: v })} />
              <CheckRow label="Description" checked={data.showDescription !== false} onChange={v => onChange({ showDescription: v })} />
              <CheckRow label="Price"       checked={data.showPrice       !== false} onChange={v => onChange({ showPrice: v })} />
              {source === 'group-buys' && (
                <CheckRow label="Meta (joined · days left)" checked={data.showMeta !== false} onChange={v => onChange({ showMeta: v })} />
              )}
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

/* Hero-layout-specific knobs (variant, height, image style, text positioning). */
function CollectionHeroLayoutFields({ data, onChange }) {
  return (
    <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: 14, paddingTop: 14 }}>
      <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        Hero layout
      </p>
      <Field label="Arrangement">
        <SegmentedControl value={data.heroVariant || 'pair'} options={HERO_LAYOUTS} onChange={v => onChange({ heroVariant: v })} compact />
      </Field>
      <Row>
        <Field label="Tile height">
          <SegmentedControl value={data.height || 'tall'} options={HERO_HEIGHTS} onChange={v => onChange({ height: v })} compact />
        </Field>
        <Field label={`Gap · ${data.gap ?? 8}px`}>
          <input type="range" min="0" max="48" step="2"
            value={data.gap ?? 8}
            onChange={e => onChange({ gap: Number(e.target.value) })}
            style={{ width: '100%' }} />
        </Field>
      </Row>
      <Row>
        <Field label="Image style">
          <SegmentedControl value={data.imageStyle || 'overlay'} options={HERO_IMAGE_STYLES} onChange={v => onChange({ imageStyle: v })} compact />
        </Field>
        <Field label="Full-bleed" hint="Tiles extend edge-to-edge.">
          <ToggleSwitch checked={data.fullBleed !== false} onChange={v => onChange({ fullBleed: v })} />
        </Field>
      </Row>
      <Row>
        <Field label="Text color">
          <SegmentedControl value={data.textColor || 'light'} options={[
            { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
          ]} onChange={v => onChange({ textColor: v })} compact />
        </Field>
        <Field label="Text alignment">
          <SegmentedControl value={data.textAlign || 'center'} options={[
            { value: 'left',   label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right',  label: 'Right' },
          ]} onChange={v => onChange({ textAlign: v })} compact />
        </Field>
      </Row>
      {(data.imageStyle || 'overlay') === 'overlay' && (
        <Field label="Vertical position">
          <SegmentedControl value={data.verticalAlign || 'bottom'} options={[
            { value: 'top',    label: 'Top' },
            { value: 'middle', label: 'Middle' },
            { value: 'bottom', label: 'Bottom' },
          ]} onChange={v => onChange({ verticalAlign: v })} compact />
        </Field>
      )}
    </div>
  );
}

/* Tile picker for hero layout when source is `products`. For group-buys hero
   we don't pick specific GBs — they come from the live feed in order — so
   this only renders for products. */
function CollectionHeroTilesField({ data, onChange, products }) {
  const variant = data.heroVariant || 'pair';
  const maxTiles = variant === 'single' ? 1 : variant === 'pair' ? 2 : 3;
  const tiles = data.tiles || [];

  // Auto-resize tile array when variant changes.
  useEffect(() => {
    if (tiles.length === maxTiles) return;
    const next = tiles.slice(0, maxTiles);
    while (next.length < maxTiles) {
      next.push({ productId: '', eyebrow: '', subtitle: '', ctaLabel: 'Shop' });
    }
    onChange({ tiles: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxTiles]);

  const updateTile = (idx, patch) => {
    const next = tiles.map((t, i) => i === idx ? { ...t, ...patch } : t);
    onChange({ tiles: next });
  };

  return (
    <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: 14, paddingTop: 14 }}>
      <p style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        Tiles · {tiles.filter(t => t.productId).length} / {maxTiles} filled
      </p>
      {tiles.slice(0, maxTiles).map((t, i) => (
        <ProductHeroTileEditor
          key={i}
          index={i}
          tile={t}
          products={products}
          onChange={patch => updateTile(i, patch)}
          isBig={variant === 'triple' && i === 0}
        />
      ))}
    </div>
  );
}


/* Reusable segmented control — renders a row of pill buttons for picking one
   value from a small set. `compact` shrinks padding for nested forms. */
function SegmentedControl({ value, options, onChange, compact }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 3, border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg)' }}>
      {options.map(opt => {
        const active = (value || '') === opt.value;
        return (
          <button key={opt.value || '__auto'} type="button" onClick={() => onChange(opt.value)}
            title={opt.desc}
            style={{
              padding: compact ? '4px 10px' : '6px 14px',
              fontSize: compact ? '0.72rem' : '0.78rem', fontWeight: 600,
              border: 'none', borderRadius: 999,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--ink-muted)',
              cursor: 'pointer', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'var(--transition)',
            }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* Simple iOS-style toggle. */
function ToggleSwitch({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999,
        background: checked ? 'var(--accent)' : 'var(--border)',
        border: 'none', cursor: 'pointer', position: 'relative',
        padding: 0, transition: 'background 0.2s',
      }}>
      <span style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left 0.18s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}


/* ───────────────────────────────────────────────────────────────
   LIVE PREVIEW MODE
   ─────────────────────────────────────────────────────────────── */

/* Toggle button group between preview and list. */
function ModeSwitcher({ mode, setMode }) {
  const opts = [
    { value: 'preview', label: 'Live Preview' },
    { value: 'list',    label: 'List View' },
  ];
  return (
    <div style={{
      display: 'inline-flex', padding: 3,
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 999,
    }}>
      {opts.map(opt => {
        const active = mode === opt.value;
        return (
          <button key={opt.value} type="button" onClick={() => setMode(opt.value)}
            style={{
              fontSize: '0.78rem', fontWeight: 600,
              padding: '7px 16px', borderRadius: 999,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--ink-muted)',
              border: 'none', cursor: 'pointer',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'var(--transition)',
            }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* Renders the homepage exactly as a customer sees it, with edit overlays. */
function PreviewEditor({ blocks, products, groupBuys, countByCategory, handlers }) {
  return (
    <div style={{
      // Boxed preview frame — visually signals "this is the live customer view"
      // without occupying the full admin nav width.
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      overflow: 'hidden', background: 'var(--bg)',
    }}>
      {blocks.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-muted)' }}>
          <p>Empty homepage — add your first section below.</p>
        </div>
      )}

      <AddBetween onAdd={type => handlers.insertBlockAt(0, type)} />

      {blocks.map((block, idx) => (
        <Fragment key={block._id || idx}>
          <BlockEnvelope block={block} idx={idx} total={blocks.length} handlers={handlers}>
            <BlockRenderer
              block={block}
              isFirst={idx === 0}
              products={products}
              groupBuys={groupBuys}
              loading={false}
              countByCategory={countByCategory}
              adminMode
            />
          </BlockEnvelope>
          <AddBetween onAdd={type => handlers.insertBlockAt(idx + 1, type)} />
        </Fragment>
      ))}
    </div>
  );
}

/* Wraps a block with hover-only edit overlays. */
function BlockEnvelope({ block, idx, total, handlers, children }) {
  const [hover, setHover] = useState(false);
  const isDisabled = block.enabled === false;
  const meta = BLOCK_META[block.type] || { label: block.type, icon: '?' };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        opacity: isDisabled ? 0.45 : 1,
      }}
    >
      {/* The live render — pointer-events forwarded so hover works, but clicks
          on actual product cards / CTAs are intercepted by the shield below to
          prevent accidental navigation while editing. */}
      <div style={{ pointerEvents: hover ? 'none' : 'auto' }}>
        {children}
      </div>

      {/* Click shield — only active while hovered. Without it, hovering a
          product card lets the customer link fire if the admin clicks. */}
      {hover && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          // Subtle ring so the admin knows which block they're targeting.
          outline: '2px solid var(--accent)',
          outlineOffset: -2,
          // No background — we still want to see the block visually.
        }} />
      )}

      {/* Floating toolbar (top-right) */}
      {hover && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 6,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 8px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 999,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
        }}>
          <span style={{
            fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase',
            fontWeight: 600, color: 'var(--ink-muted)',
            padding: '0 6px 0 2px', borderRight: '1px solid var(--border)',
          }}>
            <span style={{ color: 'var(--accent)', marginRight: 4 }}>{meta.icon}</span>
            {meta.label}
            {isDisabled && <span style={{ marginLeft: 6, color: 'var(--ink-faint)' }}>· Hidden</span>}
          </span>
          <ToolbarBtn onClick={() => handlers.openEditor(idx)} title="Edit fields">Edit</ToolbarBtn>
          <ToolbarBtn onClick={() => handlers.moveBlock(idx, -1)} disabled={idx === 0} title="Move up">↑</ToolbarBtn>
          <ToolbarBtn onClick={() => handlers.moveBlock(idx, +1)} disabled={idx === total - 1} title="Move down">↓</ToolbarBtn>
          <ToolbarBtn onClick={() => handlers.toggleEnabled(idx)} title={isDisabled ? 'Show' : 'Hide'}>
            {isDisabled ? '○' : '●'}
          </ToolbarBtn>
          <ToolbarBtn onClick={() => handlers.duplicateBlock(idx)} title="Duplicate">⎘</ToolbarBtn>
          <ToolbarBtn onClick={() => handlers.deleteBlock(idx)} title="Delete" danger>✕</ToolbarBtn>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ children, onClick, title, disabled, danger }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{
        width: 28, height: 28, borderRadius: 999,
        border: 'none', background: 'transparent',
        color: disabled ? 'var(--ink-faint)' : (danger ? '#c0392b' : 'var(--ink)'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.82rem', fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

/* Thin insertion divider between blocks. Reveals an add-block menu on hover. */
function AddBetween({ onAdd }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'relative', height: open ? 'auto' : 12,
        minHeight: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'height 0.18s ease',
      }}
    >
      {/* Hairline guide visible only on hover */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: 2, background: open ? 'var(--accent)' : 'transparent',
        transform: 'translateY(-50%)',
        transition: 'background 0.18s ease',
      }} />
      {open && (
        <div style={{
          position: 'relative', zIndex: 1, display: 'flex', gap: 6,
          padding: '8px 10px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 999, boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          margin: '6px 0',
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', alignSelf: 'center', padding: '0 6px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            + Insert
          </span>
          {Object.entries(BLOCK_META).filter(([, m]) => !m.hidden).map(([type, m]) => (
            <button key={type} type="button" onClick={() => onAdd(type)}
              style={{
                fontSize: '0.78rem', padding: '4px 10px',
                border: '1px solid var(--border)', borderRadius: 999,
                background: 'var(--bg)', color: 'var(--ink)', cursor: 'pointer',
              }}>
              <span style={{ color: 'var(--accent)', marginRight: 5 }}>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Modal that hosts the existing per-type editor for a single block. */
function EditModal({ block, onChange, onClose, products, groupBuys = [] }) {
  const meta = BLOCK_META[block.type] || { label: block.type, icon: '?' };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 20px 100px',
      overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        width: '100%', maxWidth: 720, padding: '24px 28px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 600 }}>
              Editing — <span style={{ color: 'var(--accent)' }}>{meta.icon}</span> {meta.label}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginTop: 4 }}>
              Changes preview instantly. Hit Save Changes at the bottom of the page to publish.
            </p>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--ink-muted)', lineHeight: 1, padding: 4 }}>
            ✕
          </button>
        </div>
        <BlockEditor block={block} onChange={onChange} products={products} groupBuys={groupBuys} />
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-dark" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}


/* Small layout preview diagrams (kept from prior editor) */
function LayoutPreview({ type }) {
  const base = { width: '100%', height: 36, borderRadius: 4, overflow: 'hidden', marginBottom: 8, position: 'relative', background: 'var(--border)' };
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
