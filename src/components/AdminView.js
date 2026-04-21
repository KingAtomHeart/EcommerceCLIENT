import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';
import AdminHomepageEditor from './AdminHomepageEditor';

async function uploadOptionImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const data = await apiFetch('/upload/single', { method: 'POST', body: fd });
  return data.url;
}

export default function AdminView({ products, fetchData, loading }) {
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState('products');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(true);
  const [viewMode, setViewMode] = useState('grid');

  const fetchOrders = () => {
    setOrdersLoading(true);
    apiFetch('/orders/all-orders')
      .then(data => setOrders(data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => { if (tab === 'orders') fetchOrders(); }, [tab]);

  const activeCount = products.filter(p => p.isActive).length;
  const archivedCount = products.filter(p => !p.isActive).length;
  const filtered = showArchived ? products : products.filter(p => p.isActive);

  if (loading && tab === 'products') return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.4rem', letterSpacing: '-0.025em', marginBottom: '8px' }}>Dashboard</h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>Manage your products, images, and orders.</p>
      </div>

      <div className="admin-stats">
        <div className="admin-stat"><span className="admin-stat-n">{products.length}</span><span className="admin-stat-l">Total Products</span></div>
        <div className="admin-stat"><span className="admin-stat-n">{activeCount}</span><span className="admin-stat-l">Active</span></div>
        <div className="admin-stat"><span className="admin-stat-n">{archivedCount}</span><span className="admin-stat-l">Archived</span></div>
        <div className="admin-stat"><span className="admin-stat-n">{orders.length || '—'}</span><span className="admin-stat-l">Orders</span></div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>Products</button>
          <button className={`admin-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>Orders</button>
          <button className={`admin-tab ${tab === 'homepage' ? 'active' : ''}`} onClick={() => setTab('homepage')}>Homepage</button>
        </div>
        {tab === 'products' && (
          <div className="admin-actions">
            <button className="admin-toggle" onClick={() => setShowArchived(!showArchived)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                {showArchived ? (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>) : (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>)}
              </svg>
              <span>{showArchived ? 'Hide' : 'Show'} Archived</span>
            </button>
            <button className="admin-toggle" onClick={() => setViewMode(v => v === 'grid' ? 'table' : 'grid')}>
              {viewMode === 'grid' ? (
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              ) : (
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              )}
              <span>{viewMode === 'grid' ? 'List' : 'Grid'}</span>
            </button>
            <button className="btn-dark" onClick={() => setShowCreate(true)} style={{ padding: '10px 24px' }}><span>+ New Product</span></button>
          </div>
        )}
      </div>

      {showCreate && <CreateProductModal onClose={() => setShowCreate(false)} onCreated={() => { fetchData(); setShowCreate(false); }} />}

      {tab === 'products' && (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', marginBottom: '20px' }}>
            Showing {filtered.length} of {products.length} product{products.length !== 1 ? 's' : ''}
            {!showArchived && archivedCount > 0 && ` (${archivedCount} archived hidden)`}
          </p>
          {viewMode === 'grid' ? (
            <div className="admin-grid">
              {filtered.map(p => <ProductCard key={p._id} product={p} fetchData={fetchData} />)}
              {filtered.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--ink-muted)' }}>No products to show.</p>}
            </div>
          ) : (
            <ProductsTable products={filtered} fetchData={fetchData} />
          )}
        </>
      )}

      {tab === 'orders' && <OrdersPanel orders={orders} loading={ordersLoading} fetchOrders={fetchOrders} />}

      {tab === 'homepage' && <AdminHomepageEditor />}

      <style>{`
        .admin-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 28px; }
        .admin-stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 20px; text-align: center; }
        .admin-stat-n { display: block; font-family: 'DM Serif Display', serif; font-size: 1.6rem; margin-bottom: 4px; }
        .admin-stat-l { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
        .admin-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 0; }
        .admin-tabs { display: flex; gap: 0; }
        .admin-tab { padding: 12px 24px; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 400; color: var(--ink-muted); background: none; border: none; cursor: pointer; border-bottom: 2px solid transparent; transition: all var(--transition); margin-bottom: -1px; }
        .admin-tab:hover { color: var(--ink); }
        .admin-tab.active { color: var(--ink); font-weight: 500; border-bottom-color: var(--accent); }
        .admin-actions { display: flex; align-items: center; gap: 8px; padding-bottom: 12px; flex-wrap: wrap; }
        .admin-toggle { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); font-family: 'DM Sans', sans-serif; font-size: 0.78rem; color: var(--ink-muted); cursor: pointer; transition: all var(--transition); }
        .admin-toggle:hover { border-color: var(--ink-muted); color: var(--ink); }
        .admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
        .admin-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: box-shadow var(--transition); }
        .admin-card:hover { box-shadow: var(--shadow-md); }
        .admin-card.expanded { grid-column: 1 / -1; display: flex; flex-direction: row; align-items: stretch; }
        .admin-card-sidebar { width: 260px; flex-shrink: 0; border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column; }
        .admin-card-panel { flex: 1; min-width: 0; padding: 16px 20px; overflow: auto; }
        .admin-card-img { aspect-ratio: 16/10; background: var(--accent-light); position: relative; overflow: hidden; }
        .admin-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .admin-card-body { padding: 18px 20px; }
        .admin-card-name { font-family: 'DM Serif Display', serif; font-size: 1.05rem; margin-bottom: 4px; }
        .admin-card-meta { font-size: 0.78rem; color: var(--ink-muted); margin-bottom: 12px; }
        .admin-card-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .admin-card-price { font-size: 1rem; font-weight: 600; }
        .admin-card-stock { font-size: 0.78rem; color: var(--ink-muted); }
        .admin-card-actions { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 20px; border-top: 1px solid var(--border-subtle); }
        .admin-card-btn { padding: 6px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: none; font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all var(--transition); color: var(--ink-muted); }
        .admin-card-btn:hover { border-color: var(--ink-muted); color: var(--ink); background: var(--bg-secondary); }
        .admin-card-btn.danger { color: #c0392b; border-color: rgba(192,57,43,0.2); }
        .admin-card-btn.danger:hover { background: rgba(192,57,43,0.06); border-color: #c0392b; }
        .admin-card-btn.success { color: var(--accent); border-color: rgba(46,93,75,0.2); }
        .admin-card-btn.success:hover { background: var(--accent-light); border-color: var(--accent); }
        .admin-badge { display: inline-block; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; position: absolute; top: 10px; right: 10px; }
        .admin-badge.active { background: var(--accent-light); color: var(--accent); }
        .admin-badge.archived { background: #f8d7da; color: #721c24; }
        .admin-card.is-archived { opacity: 0.65; }
        .admin-card.is-archived:hover { opacity: 1; }
        .opt-val-row { display: grid; grid-template-columns: 1fr 70px 1fr auto; gap: 5px; align-items: center; margin-bottom: 5px; }
        .opt-val-row-compact { display: grid; grid-template-columns: 1fr 60px 1fr 26px; gap: 4px; align-items: center; margin-bottom: 4px; }
        .cfg-opt-row { display: grid; grid-template-columns: 1fr 60px 1fr 26px; gap: 4px; align-items: center; margin-bottom: 4px; }
        @media (max-width: 768px) {
          .admin-stats { grid-template-columns: repeat(2, 1fr); }
          .admin-grid { grid-template-columns: 1fr; }
          .admin-toolbar { flex-direction: column; align-items: stretch; }
          .admin-actions { justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PRODUCT CARD (Admin Grid View)
═══════════════════════════════════════════════ */
function ProductCard({ product, fetchData }) {
  const [showImages, setShowImages] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showConfigs, setShowConfigs] = useState(false);
  const [editing, setEditing] = useState(false);
  const imgUrl = product.images?.[0]?.url;
  const hasOptions = (product.options?.length || 0) > 0;

  const toggleActive = async () => {
    const action = product.isActive ? 'archive' : 'activate';
    try {
      await apiFetch(`/products/${product._id}/${action}`, { method: 'PATCH' });
      toast.success(product.isActive ? 'Product archived' : 'Product activated');
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const closeAll = () => { setShowImages(false); setShowOptions(false); setShowConfigs(false); };

  if (editing) return <EditProductCard product={product} fetchData={fetchData} onClose={() => setEditing(false)} />;

  const expanded = showImages || showOptions || showConfigs;

  return (
    <div className={`admin-card ${!product.isActive ? 'is-archived' : ''} ${expanded ? 'expanded' : ''}`}>
      <div className={expanded ? 'admin-card-sidebar' : ''}>
        <div className="admin-card-img">
          {imgUrl ? <img src={imgUrl} alt={product.name} /> : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: 'var(--accent)' }}>{product.name?.[0]}</div>
          )}
          <span className={`admin-badge ${product.isActive ? 'active' : 'archived'}`}>{product.isActive ? 'Active' : 'Archived'}</span>
        </div>
        <div className="admin-card-body">
          <p className="admin-card-name">{product.name}</p>
          <p className="admin-card-meta">{product.category || 'Uncategorized'}</p>
          <div className="admin-card-row">
            <span className="admin-card-price">
              {hasOptions
                ? `From ₱${Math.min(...product.options.flatMap(g => g.values.map(v => v.price))).toLocaleString()}`
                : `₱${product.price?.toLocaleString()}`}
            </span>
            <span className="admin-card-stock">{hasOptions
              ? product.options.flatMap(g => g.values).map(v => {
                  const s = v.stocks ?? -1;
                  return s === -1 ? `${v.value}: ∞` : `${v.value}: ${s}`;
                }).join(', ')
              : (product.stocks > 0 ? `${product.stocks} in stock` : 'Out of stock')}</span>
          </div>
        </div>
        <div className="admin-card-actions">
          <button className="admin-card-btn" onClick={() => setEditing(true)}>Edit</button>
          <button className="admin-card-btn" onClick={() => { closeAll(); setShowImages(!showImages); }}>
            Images ({product.images?.length || 0})
          </button>
          <button className="admin-card-btn" onClick={() => { closeAll(); setShowOptions(!showOptions); }}>
            Options ({product.options?.length || 0})
          </button>
          <button className="admin-card-btn" onClick={() => { closeAll(); setShowConfigs(!showConfigs); }}>
            Configs ({product.configurations?.length || 0})
          </button>
          {product.isActive ? (
            <button className="admin-card-btn danger" onClick={toggleActive}>Archive</button>
          ) : (
            <button className="admin-card-btn success" onClick={toggleActive}>Activate</button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="admin-card-panel">
          {showImages && <ImageManager product={product} fetchData={fetchData} />}
          {showOptions && <OptionsManager product={product} fetchData={fetchData} />}
          {showConfigs && <ProductConfigManager product={product} fetchData={fetchData} />}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   EDIT PRODUCT
═══════════════════════════════════════════════ */
function EditProductCard({ product, fetchData, onClose }) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description,
    price: product.price,
    stocks: product.stocks,
    category: product.category
  });
  const [specs, setSpecs] = useState((product.specifications || []).map(s => ({ label: s.label, value: s.value })));
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/products/${product._id}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, specifications: specs.filter(s => s.label.trim() && s.value.trim()) })
      });
      toast.success('Product updated'); onClose(); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="admin-card" style={{ border: '2px solid var(--accent)' }}>
      <div style={{ padding: '20px' }}>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.05rem', marginBottom: '16px' }}>Edit Product</p>
        <div className="form-group"><label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        {/* Rich text description */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>Description</label>
            <button type="button" onClick={() => setShowPreview(p => !p)} style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {showPreview ? (
            <div style={{ minHeight: 80, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.88rem', lineHeight: 1.7 }}>
              <RichText content={form.description} />
            </div>
          ) : (
            <>
              <textarea className="form-input" style={{ minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: '4px' }}>
                Markdown: **bold** · *italic* · # Heading · - bullet · blank line = new paragraph
              </p>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group"><label className="form-label">Price (₱) — used when no options set</label>
            <input type="number" className="form-input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <div className="form-group"><label className="form-label">Stock</label>
            <input type="number" className="form-input" value={form.stocks} onChange={e => setForm(f => ({ ...f, stocks: e.target.value }))} />
          </div>
        </div>
        <div className="form-group"><label className="form-label">Category</label>
          <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
        </div>

        {/* Specifications editor */}
        <div className="form-group">
          <label className="form-label">Specifications <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(optional)</span></label>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginBottom: '8px', marginTop: '2px' }}>
            Custom rows shown on the product page (e.g. Layout → 65%, Weight → 1.2kg).
          </p>
          {specs.map((spec, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', marginBottom: '6px' }}>
              <input className="form-input" style={{ fontSize: '0.78rem', padding: '7px 9px' }} placeholder="Label"
                value={spec.label}
                onChange={e => setSpecs(s => s.map((r, j) => j !== i ? r : { ...r, label: e.target.value }))} />
              <input className="form-input" style={{ fontSize: '0.78rem', padding: '7px 9px' }} placeholder="Value"
                value={spec.value}
                onChange={e => setSpecs(s => s.map((r, j) => j !== i ? r : { ...r, value: e.target.value }))} />
              <button type="button" onClick={() => setSpecs(s => s.filter((_, j) => j !== i))}
                style={{ padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}>✕</button>
            </div>
          ))}
          <button type="button"
            onClick={() => setSpecs(s => [...s, { label: '', value: '' }])}
            style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            + Add Specification
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button className="btn-dark" disabled={saving} onClick={save} style={{ padding: '10px 24px' }}><span>{saving ? 'Saving...' : 'Save'}</span></button>
          <button className="btn-outline" onClick={onClose} style={{ padding: '10px 24px' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   IMAGE MANAGER
═══════════════════════════════════════════════ */
function ImageManager({ product, fetchData }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragSrcIdx, setDragSrcIdx] = useState(null);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append('images', files[i]);
    setUploading(true);
    try {
      await apiFetch(`/products/${product._id}/images`, { method: 'POST', body: formData });
      toast.success('Images uploaded'); fetchData();
    } catch (err) { toast.error(err.message); } finally { setUploading(false); e.target.value = ''; }
  };

  const handleAddUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setAddingUrl(true);
    try {
      await apiFetch(`/products/${product._id}/images/add-url`, {
        method: 'POST', body: JSON.stringify({ url }),
      });
      toast.success('Image added'); setUrlInput(''); fetchData();
    } catch (err) { toast.error(err.message); } finally { setAddingUrl(false); }
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      await apiFetch(`/products/${product._id}/images/${imageId}`, { method: 'DELETE' });
      toast.success('Image deleted'); fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const handleDrop = async (dropIdx) => {
    if (dragSrcIdx === null || dragSrcIdx === dropIdx) { setDragOverIdx(null); setDragSrcIdx(null); return; }
    const imgs = [...(product.images || [])];
    const [moved] = imgs.splice(dragSrcIdx, 1);
    imgs.splice(dropIdx, 0, moved);
    setDragOverIdx(null); setDragSrcIdx(null);
    try {
      await apiFetch(`/products/${product._id}/images/reorder`, {
        method: 'PATCH', body: JSON.stringify({ imageIds: imgs.map(i => i._id) }),
      });
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Images</span>
        <label className="admin-card-btn" style={{ cursor: 'pointer', opacity: uploading ? 0.5 : 1 }}>
          {uploading ? 'Uploading...' : '+ Upload'}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input className="form-input" style={{ fontSize: '0.75rem', padding: '5px 8px', flex: 1 }}
          placeholder="Or paste image URL..." value={urlInput}
          onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddUrl()} />
        <button onClick={handleAddUrl} disabled={addingUrl || !urlInput.trim()}
          style={{ padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', opacity: (!urlInput.trim() || addingUrl) ? 0.5 : 1 }}>
          {addingUrl ? 'Adding...' : 'Add URL'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(product.images || []).map((img, idx) => (
          <div key={img._id} draggable
            onDragStart={() => setDragSrcIdx(idx)}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragOverIdx(null); setDragSrcIdx(null); }}
            style={{ position: 'relative', width: 72, height: 72, borderRadius: '8px', overflow: 'hidden',
              border: dragOverIdx === idx ? '2px dashed var(--accent)' : '1px solid var(--border)',
              cursor: 'grab', transition: 'border 0.15s', opacity: dragSrcIdx === idx ? 0.4 : 1 }}>
            <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            <button onClick={() => handleDelete(img._id)} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>✕</button>
            {idx === 0 && <span style={{ position: 'absolute', bottom: 3, left: 3, fontSize: '0.5rem', fontWeight: 700, background: 'var(--accent)', color: '#fff', padding: '1px 4px', borderRadius: '4px' }}>MAIN</span>}
          </div>
        ))}
        {(!product.images || product.images.length === 0) && <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', padding: '8px 0' }}>No images yet.</p>}
      </div>
      <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: '6px' }}>Drag thumbnails to reorder. First image is the main/cover image.</p>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   OPTIONS MANAGER
   Creates/manages option groups (e.g., Kit: Base Kit ₱7300, Novelties ₱2000)
   Each option value can have an image URL that replaces the product image when selected.
═══════════════════════════════════════════════ */
function OptionsManager({ product, fetchData }) {
  const [groups, setGroups] = useState(
    (product.options || []).map(g => ({
      ...g,
      values: (g.values || []).map(v => ({ ...v }))
    }))
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({});
  const [newGroup, setNewGroup] = useState({ name: '' });
  const [newValues, setNewValues] = useState({}); // keyed by group index

  const addGroup = () => {
    if (!newGroup.name.trim()) return;
    const idx = groups.length;
    setGroups(g => [...g, { name: newGroup.name.trim(), values: [] }]);
    setNewValues(v => ({ ...v, [idx]: { value: '', price: '', imageUrl: '' } }));
    setNewGroup({ name: '' });
  };

  const removeGroup = (gi) => setGroups(g => g.filter((_, i) => i !== gi));

  const addValue = (gi) => {
    const nv = newValues[gi];
    if (!nv?.value?.trim() || nv.price === '') return;
    setGroups(g => g.map((grp, i) => i !== gi ? grp : {
      ...grp,
      values: [...grp.values, {
        value: nv.value.trim(),
        price: Number(nv.price) || 0,
        stocks: nv.stocks !== '' && nv.stocks !== undefined ? Number(nv.stocks) : -1,
        available: true,
        image: { url: nv.imageUrl?.trim() || '', altText: nv.value.trim() }
      }]
    }));
    setNewValues(v => ({ ...v, [gi]: { value: '', price: '', stocks: '', imageUrl: '' } }));
  };

  const removeValue = (gi, vi) => setGroups(g => g.map((grp, i) => i !== gi ? grp : {
    ...grp, values: grp.values.filter((_, j) => j !== vi)
  }));

  const toggleAvailable = (gi, vi) => setGroups(g => g.map((grp, i) => i !== gi ? grp : {
    ...grp, values: grp.values.map((v, j) => j !== vi ? v : { ...v, available: !v.available })
  }));

  const updateValueField = (gi, vi, field, val) => setGroups(g => g.map((grp, i) => i !== gi ? grp : {
    ...grp, values: grp.values.map((v, j) => j !== vi ? v : field === 'imageUrl'
      ? { ...v, image: { ...v.image, url: val } }
      : { ...v, [field]: (field === 'price' || field === 'stocks') ? (val === '' || val === '-1' ? -1 : Number(val) || 0) : val }
    )
  }));

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/products/${product._id}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ options: groups })
      });
      toast.success('Options saved'); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  return (
    <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '10px' }}>
        Options — price-setting selectors (e.g., Kit: Base Kit / Novelties)
      </p>

      {groups.map((grp, gi) => (
        <div key={gi} style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{grp.name}</span>
            <button onClick={() => removeGroup(gi)} style={{ fontSize: '0.68rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove Group</button>
          </div>

          {/* Column headers */}
          {grp.values.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 1fr 56px 24px', gap: '4px', marginBottom: '4px' }}>
              {['Value', 'Price ₱', 'Stock', 'Image URL (optional)', 'Avail.', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</span>
              ))}
            </div>
          )}

          {grp.values.map((val, vi) => (
            <div key={vi} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 1fr 56px 24px', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
              <input className="form-input" style={inputSm} value={val.value}
                onChange={e => updateValueField(gi, vi, 'value', e.target.value)} />
              <input type="number" className="form-input" style={inputSm} value={val.price}
                onChange={e => updateValueField(gi, vi, 'price', e.target.value)} />
              <input type="number" className="form-input" style={inputSm} value={val.stocks === -1 || val.stocks === undefined ? '' : val.stocks}
                placeholder="∞" title="-1 or empty = unlimited"
                onChange={e => updateValueField(gi, vi, 'stocks', e.target.value)} />
              <div style={{ display: 'flex', gap: '3px' }}>
                <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0 }} placeholder="https://..." value={val.image?.url || ''}
                  onChange={e => updateValueField(gi, vi, 'imageUrl', e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', flexShrink: 0, opacity: uploadingImg[`${gi}-${vi}`] ? 0.5 : 1 }} title="Upload image">
                  {uploadingImg[`${gi}-${vi}`] ? '…' : '↑'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploadingImg(p => ({ ...p, [`${gi}-${vi}`]: true }));
                    try { updateValueField(gi, vi, 'imageUrl', await uploadOptionImage(file)); }
                    catch { toast.error('Upload failed'); }
                    finally { setUploadingImg(p => ({ ...p, [`${gi}-${vi}`]: false })); e.target.value = ''; }
                  }} />
                </label>
              </div>
              <button onClick={() => toggleAvailable(gi, vi)} style={{
                fontSize: '0.62rem', padding: '3px 6px', borderRadius: '10px', border: '1px solid',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: val.available ? 'var(--accent-light)' : 'transparent',
                color: val.available ? 'var(--accent)' : 'var(--ink-faint)', borderColor: val.available ? 'var(--accent)' : 'var(--border)',
              }}>{val.available ? 'On' : 'Off'}</button>
              <button onClick={() => removeValue(gi, vi)} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
          ))}

          {/* Add new value row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 1fr auto', gap: '4px', alignItems: 'center', marginTop: '6px' }}>
            <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="Value (e.g. Base Kit)"
              value={newValues[gi]?.value || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), value: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="₱"
              value={newValues[gi]?.price || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), price: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="∞"
              title="Stock (-1 or empty = unlimited)"
              value={newValues[gi]?.stocks || ''}
              onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), stocks: e.target.value } }))} />
            <div style={{ display: 'flex', gap: '3px' }}>
              <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed', flex: 1, minWidth: 0 }} placeholder="Image URL (opt.)"
                value={newValues[gi]?.imageUrl || ''}
                onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: e.target.value } }))} />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', flexShrink: 0, opacity: uploadingImg[`${gi}-new`] ? 0.5 : 1 }} title="Upload image">
                {uploadingImg[`${gi}-new`] ? '…' : '↑'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploadingImg(p => ({ ...p, [`${gi}-new`]: true }));
                  try { const url = await uploadOptionImage(file); setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: url } })); }
                  catch { toast.error('Upload failed'); }
                  finally { setUploadingImg(p => ({ ...p, [`${gi}-new`]: false })); e.target.value = ''; }
                }} />
              </label>
            </div>
            <button onClick={() => addValue(gi)} className="admin-card-btn success" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </div>
      ))}

      {/* Add new group */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
        <input className="form-input" style={{ fontSize: '0.75rem', padding: '6px 8px' }} placeholder="New group name (e.g. Kit)"
          value={newGroup.name} onChange={e => setNewGroup({ name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && addGroup()} />
        <button onClick={addGroup} className="admin-card-btn success" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>+ Add Group</button>
      </div>

      <button onClick={save} disabled={saving} className="btn-dark" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>
        <span>{saving ? 'Saving...' : 'Save Options'}</span>
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PRODUCT CONFIG MANAGER
   Config groups add to the base/option price. Each option can have an image.
═══════════════════════════════════════════════ */
function ProductConfigManager({ product, fetchData }) {
  const [useVariants, setUseVariants] = useState(!!product.useVariants);
  const [togglingVariants, setTogglingVariants] = useState(false);

  const handleVariantToggle = async (val) => {
    if (val && product.variants?.length > 0) {
      setUseVariants(true); return;
    }
    if (!val && product.useVariants) {
      if (!window.confirm('Switch back to classic mode? Your variants will be preserved but hidden until you switch back.')) return;
      setTogglingVariants(true);
      try {
        await apiFetch(`/products/${product._id}/update`, { method: 'PATCH', body: JSON.stringify({ useVariants: false }) });
        toast.success('Switched to classic mode'); fetchData(); setUseVariants(false);
      } catch (err) { toast.error(err.message); } finally { setTogglingVariants(false); }
      return;
    }
    setUseVariants(val);
  };

  const [configs, setConfigs] = useState(
    (product.configurations || []).map(c => ({
      ...c,
      options: (c.options || []).map(o => ({ ...o, image: o.image || { url: '', altText: '' } }))
    }))
  );
  const [rules, setRules] = useState(
    (product.configAvailabilityRules || []).map(r => ({
      _id: r._id,
      conditions: Array.isArray(r.conditions) && r.conditions.length
        ? r.conditions.map(c => ({ configName: c.configName, selectedValue: c.selectedValue }))
        : [{ configName: r.configName || '', selectedValue: r.selectedValue || '' }],
      targetConfigName: r.targetConfigName || '',
      availableValues: r.availableValues || []
    }))
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({});
  const [newCfgName, setNewCfgName] = useState('');
  const [newOptInputs, setNewOptInputs] = useState({}); // keyed by config index

  const toggleAvail = (ci, oi) => setConfigs(p => p.map((c, i) => i !== ci ? c : {
    ...c, options: c.options.map((o, j) => j !== oi ? o : { ...o, available: !o.available })
  }));

  const removeConfig = (ci) => setConfigs(p => p.filter((_, i) => i !== ci));

  const removeOpt = (ci, oi) => setConfigs(p => p.map((c, i) => i !== ci ? c : {
    ...c, options: c.options.filter((_, j) => j !== oi)
  }));

  const updateOptField = (ci, oi, field, val) => setConfigs(p => p.map((c, i) => i !== ci ? c : {
    ...c, options: c.options.map((o, j) => j !== oi ? o : field === 'imageUrl'
      ? { ...o, image: { ...o.image, url: val } }
      : { ...o, [field]: (field === 'priceModifier' || field === 'stocks') ? (val === '' || val === '-1' ? -1 : Number(val) || 0) : val }
    )
  }));

  const addConfig = () => {
    if (!newCfgName.trim()) return;
    const ci = configs.length;
    setConfigs(p => [...p, { name: newCfgName.trim(), options: [] }]);
    setNewOptInputs(v => ({ ...v, [ci]: { value: '', priceModifier: 0, imageUrl: '' } }));
    setNewCfgName('');
  };

  const addOpt = (ci) => {
    const inp = newOptInputs[ci];
    if (!inp?.value?.trim()) return;
    setConfigs(p => p.map((c, i) => i !== ci ? c : {
      ...c, options: [...c.options, {
        value: inp.value.trim(),
        available: true,
        stocks: inp.stocks !== '' && inp.stocks !== undefined ? Number(inp.stocks) : -1,
        priceModifier: Number(inp.priceModifier) || 0,
        image: { url: inp.imageUrl?.trim() || '', altText: inp.value.trim() }
      }]
    }));
    setNewOptInputs(v => ({ ...v, [ci]: { value: '', priceModifier: 0, stocks: '', imageUrl: '' } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/products/${product._id}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ configurations: configs, configAvailabilityRules: rules })
      });
      toast.success('Configurations saved'); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  return (
    <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
      {/* Variant system toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', padding: '8px 12px', background: useVariants ? 'var(--accent-light)' : 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: `1px solid ${useVariants ? 'var(--accent)' : 'var(--border)'}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: useVariants ? 'var(--accent)' : 'var(--ink)' }}>
          <input type="checkbox" checked={useVariants} disabled={togglingVariants}
            onChange={e => handleVariantToggle(e.target.checked)}
            style={{ width: 14, height: 14, cursor: 'pointer' }} />
          Use variant system (new)
        </label>
        <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
          {useVariants ? 'Each valid combination is one SKU with its own stock.' : 'Classic mode: options + configurations + rules.'}
        </span>
      </div>

      {useVariants ? (
        <VariantEditor product={product} fetchData={fetchData} />
      ) : (
      <>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '10px' }}>
        Configs — add-on selectors that affect the final price
      </p>

      {configs.map((cfg, ci) => (
        <div key={ci} style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{cfg.name}</span>
            <button onClick={() => removeConfig(ci)} style={{ fontSize: '0.68rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
          </div>

          {cfg.options.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 45px 1fr 44px 22px', gap: '4px', marginBottom: '4px' }}>
              {['Value', '+₱', 'Stock', 'Image URL (opt.)', 'Avail.', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.61rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</span>
              ))}
            </div>
          )}

          {cfg.options.map((opt, oi) => (
            <div key={oi} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 45px 1fr 44px 22px', gap: '4px', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 500, padding: '4px 2px',
                textDecoration: opt.available ? 'none' : 'line-through', opacity: opt.available ? 1 : 0.45 }}>{opt.value}</span>
              <input type="number" className="form-input" style={inputSm} value={opt.priceModifier}
                onChange={e => updateOptField(ci, oi, 'priceModifier', e.target.value)} />
              <input type="number" className="form-input" style={inputSm}
                value={opt.stocks === -1 || opt.stocks === undefined ? '' : opt.stocks}
                placeholder="∞" title="-1 or empty = unlimited"
                onChange={e => updateOptField(ci, oi, 'stocks', e.target.value)} />
              <div style={{ display: 'flex', gap: '3px' }}>
                <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0 }} placeholder="https://..." value={opt.image?.url || ''}
                  onChange={e => updateOptField(ci, oi, 'imageUrl', e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', flexShrink: 0, opacity: uploadingImg[`${ci}-${oi}`] ? 0.5 : 1 }} title="Upload image">
                  {uploadingImg[`${ci}-${oi}`] ? '…' : '↑'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploadingImg(p => ({ ...p, [`${ci}-${oi}`]: true }));
                    try { updateOptField(ci, oi, 'imageUrl', await uploadOptionImage(file)); }
                    catch { toast.error('Upload failed'); }
                    finally { setUploadingImg(p => ({ ...p, [`${ci}-${oi}`]: false })); e.target.value = ''; }
                  }} />
                </label>
              </div>
              <button onClick={() => toggleAvail(ci, oi)} style={{
                fontSize: '0.6rem', padding: '2px 5px', borderRadius: '10px', border: '1px solid',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                background: opt.available ? 'var(--accent-light)' : 'transparent',
                color: opt.available ? 'var(--accent)' : 'var(--ink-faint)',
                borderColor: opt.available ? 'var(--accent)' : 'var(--border)',
              }}>{opt.available ? 'On' : 'Off'}</button>
              <button onClick={() => removeOpt(ci, oi)} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ))}

          {/* Add new option row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 1fr auto', gap: '4px', alignItems: 'center', marginTop: '6px' }}>
            <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="Option value"
              value={newOptInputs[ci]?.value || ''}
              onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), value: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="+₱"
              value={newOptInputs[ci]?.priceModifier || ''}
              onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), priceModifier: e.target.value } }))} />
            <div style={{ display: 'flex', gap: '3px' }}>
              <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed', flex: 1, minWidth: 0 }} placeholder="Image URL (opt.)"
                value={newOptInputs[ci]?.imageUrl || ''}
                onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), imageUrl: e.target.value } }))} />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', flexShrink: 0, opacity: uploadingImg[`${ci}-new`] ? 0.5 : 1 }} title="Upload image">
                {uploadingImg[`${ci}-new`] ? '…' : '↑'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploadingImg(p => ({ ...p, [`${ci}-new`]: true }));
                  try { const url = await uploadOptionImage(file); setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), imageUrl: url } })); }
                  catch { toast.error('Upload failed'); }
                  finally { setUploadingImg(p => ({ ...p, [`${ci}-new`]: false })); e.target.value = ''; }
                }} />
              </label>
            </div>
            <button onClick={() => addOpt(ci)} className="admin-card-btn success" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </div>
      ))}

      {/* Add new config group */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
        <input className="form-input" style={{ fontSize: '0.75rem', padding: '6px 8px' }} placeholder="Config group name (e.g. Layout)"
          value={newCfgName} onChange={e => setNewCfgName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addConfig()} />
        <button onClick={addConfig} className="admin-card-btn success" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>+ Add Config</button>
      </div>

      {/* ── Availability Rules ── */}
      {configs.length >= 2 && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '8px' }}>
            Availability Rules — restrict which options appear based on a combination of selections
          </p>
          <p style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginBottom: '10px' }}>
            Example: When Color = "Beige/Mint" AND Layout = "WK" → Grade allows: B-Stock
          </p>

          {rules.map((rule, ri) => {
            const conditionConfigNames = (rule.conditions || []).map(c => c.configName).filter(Boolean);
            const targetOptions = configs.filter(c => !conditionConfigNames.includes(c.name));
            return (
              <div key={ri} style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                {/* Conditions */}
                {(rule.conditions || []).map((cond, ci) => (
                  <div key={ci} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500, minWidth: 30 }}>{ci === 0 ? 'When' : 'AND'}</span>
                    <select className="form-input" style={{ ...inputSm, width: 'auto' }} value={cond.configName}
                      onChange={e => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                        ...rr, conditions: rr.conditions.map((cc, j) => j !== ci ? cc : { configName: e.target.value, selectedValue: '' })
                      }))}>
                      <option value="">Select config...</option>
                      {configs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <span>=</span>
                    <select className="form-input" style={{ ...inputSm, width: 'auto' }} value={cond.selectedValue}
                      onChange={e => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                        ...rr, conditions: rr.conditions.map((cc, j) => j !== ci ? cc : { ...cc, selectedValue: e.target.value })
                      }))}>
                      <option value="">Select value...</option>
                      {(configs.find(c => c.name === cond.configName)?.options || []).map(o => (
                        <option key={o.value} value={o.value}>{o.value}</option>
                      ))}
                    </select>
                    {(rule.conditions || []).length > 1 && (
                      <button onClick={() => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                        ...rr, conditions: rr.conditions.filter((_, j) => j !== ci)
                      }))} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                ))}

                {/* Add AND condition */}
                <button onClick={() => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                  ...rr, conditions: [...(rr.conditions || []), { configName: '', selectedValue: '' }]
                }))} style={{ fontSize: '0.64rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginBottom: '6px' }}>
                  + AND condition
                </button>

                {/* Target + allowed values */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                  <span style={{ fontWeight: 500 }}>→</span>
                  <select className="form-input" style={{ ...inputSm, width: 'auto' }} value={rule.targetConfigName}
                    onChange={e => setRules(r => r.map((rr, i) => i !== ri ? rr : { ...rr, targetConfigName: e.target.value, availableValues: [] }))}>
                    <option value="">Target config...</option>
                    {targetOptions.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <span style={{ fontWeight: 500 }}>allows:</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {(configs.find(c => c.name === rule.targetConfigName)?.options || []).map(o => {
                      const checked = (rule.availableValues || []).includes(o.value);
                      return (
                        <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', cursor: 'pointer',
                          padding: '2px 6px', borderRadius: '8px', border: '1px solid',
                          borderColor: checked ? 'var(--accent)' : 'var(--border)',
                          background: checked ? 'var(--accent-light)' : 'transparent',
                          color: checked ? 'var(--accent)' : 'var(--ink-muted)' }}>
                          <input type="checkbox" checked={checked} style={{ display: 'none' }}
                            onChange={() => setRules(r => r.map((rr, i) => i !== ri ? rr : {
                              ...rr, availableValues: checked
                                ? rr.availableValues.filter(v => v !== o.value)
                                : [...(rr.availableValues || []), o.value]
                            }))} />
                          {o.value}
                        </label>
                      );
                    })}
                  </div>
                  {rule.conditions?.every(c => !c.configName || !c.selectedValue) && (
                    <span style={{ fontSize: '0.64rem', color: '#c0392b', marginLeft: 4 }}>⚠ incomplete conditions</span>
                  )}
                </div>

                {/* Remove rule */}
                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                  <button onClick={() => setRules(r => r.filter((_, i) => i !== ri))}
                    style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove rule</button>
                </div>
              </div>
            );
          })}

          <button onClick={() => setRules(r => [...r, { conditions: [{ configName: '', selectedValue: '' }], targetConfigName: '', availableValues: [] }])}
            className="admin-card-btn success" style={{ fontSize: '0.68rem', marginTop: '4px' }}>
            + Add Rule
          </button>
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-dark" style={{ padding: '7px 16px', fontSize: '0.78rem', marginTop: '12px' }}>
        <span>{saving ? 'Saving...' : 'Save Configs'}</span>
      </button>
      </>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   VARIANT EDITOR
═══════════════════════════════════════════════ */
function VariantEditor({ product, fetchData }) {
  const [dims, setDims] = useState((product.variantDimensions || []).map(d => ({ name: d.name, values: [...(d.values || [])] })));
  const [variants, setVariants] = useState((product.variants || []).map(v => ({ _id: v._id, attributes: { ...(v.attributes || {}) }, stock: v.stock ?? -1, price: v.price ?? '', sku: v.sku || '', available: v.available !== false })));
  const [vImages, setVImages] = useState((product.variantImages || []).map(i => ({ _id: i._id, url: i.url, publicId: i.publicId || '', appliesTo: { ...(i.appliesTo || {}) } })));
  const [saving, setSaving] = useState(false);
  const [newDimName, setNewDimName] = useState('');
  const [newDimValues, setNewDimValues] = useState({});
  const [converting, setConverting] = useState(false);
  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  const generateCombos = () => {
    if (!dims.length || dims.some(d => !d.values.length)) return;
    const existing = variants.map(v => JSON.stringify(v.attributes));
    const combos = dims.reduce((acc, d) => acc.flatMap(a => d.values.map(v => ({ ...a, [d.name]: v }))), [{}]);
    const newOnes = combos.filter(c => !existing.includes(JSON.stringify(c)));
    setVariants(v => [...v, ...newOnes.map(attrs => ({ attributes: attrs, stock: -1, price: '', sku: '', available: true }))]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        useVariants: true,
        variantDimensions: dims,
        variants: variants.map(v => ({ ...v, stock: Number(v.stock), price: v.price === '' || v.price == null ? null : Number(v.price) })),
        variantImages: vImages
      };
      await apiFetch(`/products/${product._id}/update`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast.success('Variants saved'); fetchData();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleImportJson = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await apiFetch(`/products/${product._id}/variants/import`, { method: 'POST', body: JSON.stringify(data) });
      toast.success('Variants imported'); fetchData();
    } catch (err) { toast.error(err.message || 'Import failed'); }
    e.target.value = '';
  };

  const handleConvert = async () => {
    if (!window.confirm('Convert legacy configurations to variants? This will set useVariants=true for this product.')) return;
    setConverting(true);
    try {
      const res = await apiFetch(`/products/${product._id}/variants/convert-from-legacy`, { method: 'POST' });
      toast.success(res.message); fetchData();
    } catch (err) { toast.error(err.message); } finally { setConverting(false); }
  };

  const handleUploadVImage = async (file, appliesTo) => {
    const fd = new FormData();
    fd.append('images', file);
    fd.append('appliesTo', JSON.stringify(appliesTo));
    try {
      const res = await apiFetch(`/products/${product._id}/variants/image`, { method: 'POST', body: fd });
      toast.success('Image uploaded'); fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteVImage = async (imgId) => {
    if (imgId) {
      try { await apiFetch(`/products/${product._id}/variants/image/${imgId}`, { method: 'DELETE' }); }
      catch (err) { toast.error(err.message); return; }
    }
    setVImages(v => v.filter(i => i._id?.toString() !== imgId?.toString()));
    if (imgId) fetchData();
  };

  const sampleJson = JSON.stringify({
    dimensions: dims.length ? dims : [{ name: 'Color', values: ['A', 'B'] }, { name: 'Grade', values: ['A-Stock', 'B-Stock'] }],
    variants: [{ attributes: { Color: 'A', Grade: 'A-Stock' }, stock: 1, price: null, sku: '' }],
    images: [{ url: 'https://...', appliesTo: { Color: 'A' } }],
    replace: true
  }, null, 2);

  return (
    <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '10px' }}>
        Variant System — each row is one sellable SKU with its own stock
      </p>

      {product.configurations?.length > 0 && !product.useVariants && (
        <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--ink-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>This product has legacy configurations. You can auto-convert them to variants.</span>
          <button onClick={handleConvert} disabled={converting} className="admin-card-btn" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap', marginLeft: '12px' }}>
            {converting ? 'Converting...' : 'Convert from Legacy'}
          </button>
        </div>
      )}

      {/* ── Dimensions ── */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>Dimensions</p>
        {dims.map((d, di) => (
          <div key={di} style={{ marginBottom: '8px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
              <input className="form-input" style={{ ...inputSm, fontWeight: 600, width: 120 }} value={d.name}
                onChange={e => setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, name: e.target.value }))} />
              <button onClick={() => setDims(p => p.filter((_, i) => i !== di))} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
              {d.values.map((v, vi) => (
                <span key={vi} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 8px', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 500 }}>
                  {v}
                  <button onClick={() => setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: dd.values.filter((_, j) => j !== vi) }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.7rem', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
                </span>
              ))}
              <input className="form-input" style={{ ...inputSm, width: 100, borderStyle: 'dashed' }} placeholder="+ value"
                value={newDimValues[di] || ''}
                onChange={e => setNewDimValues(p => ({ ...p, [di]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newDimValues[di]?.trim()) {
                    setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: [...dd.values, newDimValues[di].trim()] }));
                    setNewDimValues(p => ({ ...p, [di]: '' }));
                    e.preventDefault();
                  }
                }} />
              {newDimValues[di]?.trim() && (
                <button onClick={() => {
                  setDims(p => p.map((dd, i) => i !== di ? dd : { ...dd, values: [...dd.values, newDimValues[di].trim()] }));
                  setNewDimValues(p => ({ ...p, [di]: '' }));
                }} className="admin-card-btn success" style={{ fontSize: '0.65rem' }}>+</button>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input className="form-input" style={{ ...inputSm, width: 160, borderStyle: 'dashed' }} placeholder="Dimension name (e.g. Color)"
            value={newDimName} onChange={e => setNewDimName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newDimName.trim()) { setDims(p => [...p, { name: newDimName.trim(), values: [] }]); setNewDimName(''); e.preventDefault(); } }} />
          <button onClick={() => { if (!newDimName.trim()) return; setDims(p => [...p, { name: newDimName.trim(), values: [] }]); setNewDimName(''); }}
            className="admin-card-btn success" style={{ fontSize: '0.68rem' }}>+ Add Dimension</button>
          {dims.length > 0 && (
            <button onClick={generateCombos} className="admin-card-btn" style={{ fontSize: '0.68rem' }}>Generate All Combinations</button>
          )}
        </div>
      </div>

      {/* ── Variants table ── */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>
          Variants ({variants.length})
        </p>
        {variants.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {dims.map(d => <th key={d.name} style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{d.name}</th>)}
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Stock</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Price (₱)</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>SKU</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Avail</th>
                  <th style={{ padding: '4px 6px' }}></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, vi) => (
                  <tr key={vi} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: v.available ? 1 : 0.5 }}>
                    {dims.map(d => (
                      <td key={d.name} style={{ padding: '3px 4px' }}>
                        <select className="form-input" style={{ ...inputSm, width: 'auto', minWidth: 80 }}
                          value={v.attributes[d.name] || ''}
                          onChange={e => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, attributes: { ...vv.attributes, [d.name]: e.target.value } }))}>
                          <option value="">—</option>
                          {d.values.map(val => <option key={val} value={val}>{val}</option>)}
                        </select>
                      </td>
                    ))}
                    <td style={{ padding: '3px 4px' }}>
                      <input type="number" className="form-input" style={{ ...inputSm, width: 55 }} value={v.stock === -1 ? '' : v.stock} placeholder="∞"
                        onChange={e => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, stock: e.target.value === '' ? -1 : Number(e.target.value) }))} />
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <input type="number" className="form-input" style={{ ...inputSm, width: 70 }} value={v.price ?? ''} placeholder="Base"
                        onChange={e => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, price: e.target.value === '' ? '' : Number(e.target.value) }))} />
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <input className="form-input" style={{ ...inputSm, width: 80 }} value={v.sku}
                        onChange={e => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, sku: e.target.value }))} />
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <button onClick={() => setVariants(p => p.map((vv, i) => i !== vi ? vv : { ...vv, available: !vv.available }))}
                        style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px', border: '1px solid', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                          background: v.available ? 'var(--accent-light)' : 'transparent',
                          color: v.available ? 'var(--accent)' : 'var(--ink-faint)',
                          borderColor: v.available ? 'var(--accent)' : 'var(--border)' }}>
                        {v.available ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td style={{ padding: '3px 4px' }}>
                      <button onClick={() => setVariants(p => p.filter((_, i) => i !== vi))}
                        style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button onClick={() => setVariants(p => [...p, { attributes: Object.fromEntries(dims.map(d => [d.name, d.values[0] || ''])), stock: -1, price: '', sku: '', available: true }])}
          className="admin-card-btn success" style={{ fontSize: '0.68rem', marginTop: '6px' }}>+ Add Variant</button>
      </div>

      {/* ── Variant Images ── */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>
          Variant Images — attach images to specific dimension combinations
        </p>
        <p style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', marginBottom: '8px' }}>
          Set "Any" for dimensions that should match all values. Most-specific image wins on the product page.
        </p>
        {vImages.map((img, ii) => (
          <div key={ii} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            {img.url && <img src={img.url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <input className="form-input" style={{ ...inputSm, width: '100%', marginBottom: '4px' }} placeholder="Image URL" value={img.url}
                onChange={e => setVImages(p => p.map((vv, i) => i !== ii ? vv : { ...vv, url: e.target.value }))} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {dims.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem' }}>
                    <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>{d.name}:</span>
                    <select className="form-input" style={{ ...inputSm, width: 'auto' }}
                      value={img.appliesTo?.[d.name] || ''}
                      onChange={e => setVImages(p => p.map((vv, i) => {
                        if (i !== ii) return vv;
                        const at = { ...vv.appliesTo };
                        if (e.target.value) at[d.name] = e.target.value; else delete at[d.name];
                        return { ...vv, appliesTo: at };
                      }))}>
                      <option value="">Any</option>
                      {d.values.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => handleDeleteVImage(img._id)}
              style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', paddingTop: '4px' }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={() => setVImages(p => [...p, { url: '', publicId: '', appliesTo: {} }])}
            className="admin-card-btn" style={{ fontSize: '0.68rem' }}>+ Add Image (URL)</button>
          <label className="admin-card-btn" style={{ fontSize: '0.68rem', cursor: 'pointer' }}>
            ↑ Upload Image
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              await handleUploadVImage(file, {});
              e.target.value = '';
            }} />
          </label>
        </div>
      </div>

      {/* ── JSON Import ── */}
      <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '6px' }}>JSON Import</p>
        <label className="admin-card-btn" style={{ fontSize: '0.68rem', cursor: 'pointer', display: 'inline-block' }}>
          Choose JSON File
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportJson} />
        </label>
        <details style={{ marginTop: '8px' }}>
          <summary style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', cursor: 'pointer' }}>Show sample JSON format</summary>
          <pre style={{ fontSize: '0.65rem', background: 'var(--surface)', padding: '8px', borderRadius: 'var(--radius-sm)', overflow: 'auto', maxHeight: 200, marginTop: '6px', border: '1px solid var(--border-subtle)' }}>{sampleJson}</pre>
        </details>
      </div>

      <button onClick={save} disabled={saving} className="btn-dark" style={{ padding: '7px 16px', fontSize: '0.78rem' }}>
        <span>{saving ? 'Saving...' : 'Save Variants'}</span>
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   PRODUCTS TABLE (List View)
═══════════════════════════════════════════════ */
function ProductsTable({ products, fetchData }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['', 'Name', 'Category', 'Price', 'Stock', 'Status', ''].map(h => (
              <th key={h || Math.random()} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map(p => <TableRow key={p._id} product={p} fetchData={fetchData} />)}
          {products.length === 0 && <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-muted)' }}>No products.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({ product, fetchData }) {
  const imgUrl = product.images?.[0]?.url;
  const hasOptions = (product.options?.length || 0) > 0;
  const toggleActive = async () => {
    const action = product.isActive ? 'archive' : 'activate';
    try { await apiFetch(`/products/${product._id}/${action}`, { method: 'PATCH' }); toast.success(product.isActive ? 'Archived' : 'Activated'); fetchData(); }
    catch (err) { toast.error(err.message); }
  };
  const displayPrice = hasOptions
    ? `From ₱${Math.min(...product.options.flatMap(g => g.values.map(v => v.price))).toLocaleString()}`
    : `₱${product.price?.toLocaleString()}`;
  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)', opacity: product.isActive ? 1 : 0.5 }}>
      <td style={{ padding: '10px 14px', width: 48 }}><div style={{ width: 40, height: 40, borderRadius: '8px', overflow: 'hidden', background: 'var(--accent-light)' }}>{imgUrl ? <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div></td>
      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{product.name}</td>
      <td style={{ padding: '10px 14px', color: 'var(--ink-muted)' }}>{product.category}</td>
      <td style={{ padding: '10px 14px' }}>{displayPrice}</td>
      <td style={{ padding: '10px 14px' }}>{product.stocks}</td>
      <td style={{ padding: '10px 14px' }}><span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px', background: product.isActive ? 'var(--accent-light)' : '#f8d7da', color: product.isActive ? 'var(--accent)' : '#721c24' }}>{product.isActive ? 'Active' : 'Archived'}</span></td>
      <td style={{ padding: '10px 14px' }}><button className="admin-card-btn" onClick={toggleActive} style={{ fontSize: '0.72rem' }}>{product.isActive ? 'Archive' : 'Activate'}</button></td>
    </tr>
  );
}


/* ═══════════════════════════════════════════════
   ORDERS PANEL
═══════════════════════════════════════════════ */
function OrdersPanel({ orders, loading, fetchOrders }) {
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div className="spinner" /></div>;
  if (orders.length === 0) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-muted)' }}>No orders yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {orders.map(order => <OrderRow key={order._id} order={order} fetchOrders={fetchOrders} />)}
    </div>
  );
}

function OrderRow({ order, fetchOrders }) {
  const [updating, setUpdating] = useState(false);
  const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try { await apiFetch(`/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }); toast.success(`Status updated to ${newStatus}`); fetchOrders(); }
    catch (err) { toast.error(err.message); } finally { setUpdating(false); }
  };
  const customer = order.userId;
  const name = typeof customer === 'object' ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Unknown';
  const email = typeof customer === 'object' ? customer.email : '';
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '22px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div><p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '2px' }}>Order</p><p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.95rem' }}>{order._id.slice(-8).toUpperCase()}</p></div>
          <div><p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '2px' }}>Customer</p><p style={{ fontSize: '0.88rem', fontWeight: 500 }}>{name}</p>{email && <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{email}</p>}</div>
          <div><p style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '2px' }}>Date</p><p style={{ fontSize: '0.88rem' }}>{new Date(order.createdAt).toLocaleDateString()}</p></div>
        </div>
        <select value={order.status} onChange={e => updateStatus(e.target.value)} disabled={updating} className="form-input" style={{ fontSize: '0.8rem', padding: '6px 10px', width: 'auto', borderRadius: 'var(--radius-pill)', cursor: 'pointer' }}>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
        {order.productsOrdered.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.84rem' }}>
            <span>{item.productName} <span style={{ color: 'var(--ink-muted)' }}>x{item.quantity}</span></span>
            <span style={{ fontWeight: 600 }}>₱{item.subtotal?.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
        <span>Total</span><span>₱{order.totalPrice?.toLocaleString()}</span>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   CREATE PRODUCT MODAL
═══════════════════════════════════════════════ */
function CreateProductModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', stocks: '0', category: '' });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [urlInputCreate, setUrlInputCreate] = useState('');
  const [urlPreviews, setUrlPreviews] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [descPreview, setDescPreview] = useState(false);

  // Option group builder state
  const [newOptGroup, setNewOptGroup] = useState({ name: '' });
  const [newOptValues, setNewOptValues] = useState({});
  const [newCfgGroup, setNewCfgGroup] = useState({ name: '' });
  const [newCfgOpts, setNewCfgOpts] = useState({});

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.dataset.enterAction) {
      e.preventDefault();
      const formElements = Array.from(e.currentTarget.querySelectorAll('input, textarea, select'));
      const idx = formElements.indexOf(e.target);
      if (idx > -1 && idx < formElements.length - 1) {
        formElements[idx + 1].focus();
      }
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...files.map(f => ({ name: f.name, url: URL.createObjectURL(f) }))]);
    e.target.value = '';
  };
  const removeImagePreview = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };
  const addUrlPreview = () => {
    const url = urlInputCreate.trim(); if (!url) return;
    setUrlPreviews(prev => [...prev, { url }]); setUrlInputCreate('');
  };
  const removeUrlPreview = (idx) => setUrlPreviews(prev => prev.filter((_, i) => i !== idx));

  // Option group helpers
  const addOptGroup = () => {
    if (!newOptGroup.name.trim()) return;
    const idx = optionGroups.length;
    setOptionGroups(g => [...g, { name: newOptGroup.name.trim(), values: [] }]);
    setNewOptValues(v => ({ ...v, [idx]: { value: '', price: '', imageUrl: '' } }));
    setNewOptGroup({ name: '' });
  };
  const addOptValue = (gi) => {
    const nv = newOptValues[gi];
    if (!nv?.value?.trim() || nv.price === '') return;
    setOptionGroups(g => g.map((grp, i) => i !== gi ? grp : {
      ...grp, values: [...grp.values, {
        value: nv.value.trim(), price: Number(nv.price) || 0, available: true,
        image: { url: nv.imageUrl?.trim() || '', altText: nv.value.trim() }
      }]
    }));
    setNewOptValues(v => ({ ...v, [gi]: { value: '', price: '', imageUrl: '' } }));
  };

  // Config group helpers
  const addCfgGroup = () => {
    if (!newCfgGroup.name.trim()) return;
    const idx = configs.length;
    setConfigs(c => [...c, { name: newCfgGroup.name.trim(), options: [] }]);
    setNewCfgOpts(v => ({ ...v, [idx]: { value: '', priceModifier: 0, imageUrl: '' } }));
    setNewCfgGroup({ name: '' });
  };
  const addCfgOpt = (ci) => {
    const inp = newCfgOpts[ci];
    if (!inp?.value?.trim()) return;
    setConfigs(c => c.map((cfg, i) => i !== ci ? cfg : {
      ...cfg, options: [...cfg.options, {
        value: inp.value.trim(), available: true,
        priceModifier: Number(inp.priceModifier) || 0,
        image: { url: inp.imageUrl?.trim() || '', altText: inp.value.trim() }
      }]
    }));
    setNewCfgOpts(v => ({ ...v, [ci]: { value: '', priceModifier: 0, imageUrl: '' } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const product = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: Number(form.price) || 0,
          stocks: Number(form.stocks),
          category: form.category,
        })
      });

      if (images.length > 0) {
        const fd = new FormData();
        images.forEach(f => fd.append('images', f));
        await apiFetch(`/products/${product._id}/images`, { method: 'POST', body: fd });
      }

      for (const up of urlPreviews) {
        await apiFetch(`/products/${product._id}/images/add-url`, {
          method: 'POST', body: JSON.stringify({ url: up.url }),
        });
      }

      const filteredSpecs = specs.filter(s => s.label.trim() && s.value.trim());
      if (optionGroups.length > 0 || configs.length > 0 || filteredSpecs.length > 0) {
        await apiFetch(`/products/${product._id}/update`, {
          method: 'PATCH',
          body: JSON.stringify({
            options: optionGroups,
            configurations: configs,
            specifications: filteredSpecs,
          })
        });
      }

      toast.success('Product created');
      onCreated();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const inputSm = { fontSize: '0.78rem', padding: '7px 9px' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-body" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">New Product</h2>
        <p className="modal-subtitle">Add a new in-stock product to your catalog.</p>

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
          {/* Basic Info */}
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" required value={form.name} onChange={set('name')} placeholder="e.g. GMK Olivia" />
          </div>

          {/* Rich text description */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Description</label>
              <button type="button" onClick={() => setDescPreview(p => !p)} style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {descPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {descPreview ? (
              <div style={{ minHeight: 80, padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.9rem', lineHeight: 1.75 }}>
                {form.description ? <RichText content={form.description} /> : <span style={{ color: 'var(--ink-faint)' }}>No description yet.</span>}
              </div>
            ) : (
              <>
                <textarea className="form-input" required value={form.description} onChange={set('description')}
                  style={{ minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  placeholder="Describe the product...&#10;&#10;Tip: Use **bold**, *italic*, # Heading, or - bullet points for rich formatting." />
                <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: '4px' }}>
                  Markdown: **bold** · *italic* · # Heading · - bullet · blank line = new paragraph
                </p>
              </>
            )}
          </div>

          <div className="modal-row-3">
            <div className="form-group">
              <label className="form-label">Price (₱)</label>
              <input type="number" className="form-input" min="0" value={form.price} onChange={set('price')} placeholder="Used if no options" />
            </div>
            <div className="form-group"><label className="form-label">Stock</label><input type="number" className="form-input" min="0" value={form.stocks} onChange={set('stocks')} /></div>
            <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={form.category} onChange={set('category')} placeholder="keyboards" /></div>
          </div>

          {/* Images */}
          <div className="modal-section">
            <p className="modal-section-title">Images</p>
            <div className="img-upload-zone">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p>Click or drag to upload images (max 10MB each)</p>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
            </div>
            {imagePreviews.length > 0 && (
              <div className="img-preview-row">
                {imagePreviews.map((p, i) => (
                  <div key={i} className="img-preview-thumb" style={{ position: 'relative' }}>
                    <img src={p.url} alt={p.name} />
                    <button type="button" onClick={() => removeImagePreview(i)} style={{
                      position: 'absolute', top: 3, right: 3, width: 18, height: 18,
                      borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', lineHeight: 1
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <input className="form-input" style={{ fontSize: '0.78rem', padding: '6px 9px', flex: 1 }}
                placeholder="Or paste image URL..." value={urlInputCreate}
                onChange={e => setUrlInputCreate(e.target.value)}
                data-enter-action="custom"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrlPreview(); } }} />
              <button type="button" onClick={addUrlPreview} disabled={!urlInputCreate.trim()}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif", opacity: !urlInputCreate.trim() ? 0.5 : 1 }}>
                + Add URL
              </button>
            </div>
            {urlPreviews.length > 0 && (
              <div className="img-preview-row" style={{ marginTop: '8px' }}>
                {urlPreviews.map((p, i) => (
                  <div key={i} className="img-preview-thumb" style={{ position: 'relative' }}>
                    <img src={p.url} alt="" />
                    <button type="button" onClick={() => removeUrlPreview(i)} style={{
                      position: 'absolute', top: 3, right: 3, width: 18, height: 18,
                      borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem'
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Specifications */}
          <div className="modal-section">
            <p className="modal-section-title">Specifications</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Optional. Add custom spec rows shown on the product page (e.g. Layout → 65%, Weight → 1.2kg).
            </p>
            {specs.map((spec, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', marginBottom: '6px' }}>
                <input className="form-input" style={inputSm} placeholder="Label (e.g. Layout)"
                  value={spec.label}
                  onChange={e => setSpecs(s => s.map((r, j) => j !== i ? r : { ...r, label: e.target.value }))} />
                <input className="form-input" style={inputSm} placeholder="Value (e.g. 65%, hotswap)"
                  value={spec.value}
                  onChange={e => setSpecs(s => s.map((r, j) => j !== i ? r : { ...r, value: e.target.value }))} />
                <button type="button" onClick={() => setSpecs(s => s.filter((_, j) => j !== i))}
                  style={{ padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}>✕</button>
              </div>
            ))}
            <button type="button"
              onClick={() => setSpecs(s => [...s, { label: '', value: '' }])}
              style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', padding: '5px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              + Add Specification
            </button>
          </div>

          {/* Add Options */}
          <div className="modal-section">
            <p className="modal-section-title">Add Options</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Options set the base price (e.g., Kit → Base Kit ₱7,300 / Novelties ₱2,000). Leave empty to use the price above.
            </p>

            {optionGroups.map((grp, gi) => (
              <div key={gi} style={{ marginBottom: '10px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{grp.name}</span>
                  <button type="button" onClick={() => setOptionGroups(g => g.filter((_, i) => i !== gi))} style={{ fontSize: '0.7rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                </div>
                {grp.values.map((v, vi) => (
                  <div key={vi} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.78rem' }}>
                    <span style={{ flex: 1 }}>{v.value}</span>
                    <span style={{ color: 'var(--ink-muted)' }}>₱{v.price.toLocaleString()}</span>
                    {v.image?.url && <span style={{ color: 'var(--accent)', fontSize: '0.68rem' }}>📷</span>}
                    <button type="button" onClick={() => setOptionGroups(g => g.map((gg, i) => i !== gi ? gg : { ...gg, values: gg.values.filter((_, j) => j !== vi) }))} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr auto', gap: '5px', marginTop: '6px' }}>
                  <input className="form-input" style={inputSm} placeholder="Value (e.g. Base Kit)"
                    value={newOptValues[gi]?.value || ''}
                    onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), value: e.target.value } }))} />
                  <input type="number" className="form-input" style={inputSm} placeholder="₱"
                    value={newOptValues[gi]?.price || ''}
                    onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), price: e.target.value } }))} />
                  <input className="form-input" style={inputSm} placeholder="Image URL (optional)"
                    value={newOptValues[gi]?.imageUrl || ''}
                    onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: e.target.value } }))} />
                  <button type="button" onClick={() => addOptValue(gi)} className="config-add-btn">+</button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="form-input" style={inputSm} placeholder="Option group name (e.g. Kit)"
                value={newOptGroup.name} onChange={e => setNewOptGroup({ name: e.target.value })}
                data-enter-action="custom"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOptGroup(); } }} />
              <button type="button" onClick={addOptGroup} className="config-add-btn">+ Add Group</button>
            </div>
          </div>

          {/* Add Configs */}
          <div className="modal-section">
            <p className="modal-section-title">Add Configs</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Configs add to the base price (e.g., Plate Material → Brass +₱200). Add unlimited groups.
            </p>

            {configs.map((cfg, ci) => (
              <div key={ci} style={{ marginBottom: '10px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cfg.name}</span>
                  <button type="button" onClick={() => setConfigs(c => c.filter((_, i) => i !== ci))} style={{ fontSize: '0.7rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                </div>
                {cfg.options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.78rem' }}>
                    <span style={{ flex: 1 }}>{opt.value}</span>
                    {opt.priceModifier > 0 && <span style={{ color: 'var(--ink-muted)' }}>+₱{opt.priceModifier}</span>}
                    {opt.image?.url && <span style={{ color: 'var(--accent)', fontSize: '0.68rem' }}>📷</span>}
                    <button type="button" onClick={() => setConfigs(c => c.map((cc, i) => i !== ci ? cc : { ...cc, options: cc.options.filter((_, j) => j !== oi) }))} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr auto', gap: '5px', marginTop: '6px' }}>
                  <input className="form-input" style={inputSm} placeholder="Option value"
                    value={newCfgOpts[ci]?.value || ''}
                    onChange={e => setNewCfgOpts(v => ({ ...v, [ci]: { ...(v[ci] || {}), value: e.target.value } }))} />
                  <input type="number" className="form-input" style={inputSm} placeholder="+₱"
                    value={newCfgOpts[ci]?.priceModifier || ''}
                    onChange={e => setNewCfgOpts(v => ({ ...v, [ci]: { ...(v[ci] || {}), priceModifier: e.target.value } }))} />
                  <input className="form-input" style={inputSm} placeholder="Image URL (optional)"
                    value={newCfgOpts[ci]?.imageUrl || ''}
                    onChange={e => setNewCfgOpts(v => ({ ...v, [ci]: { ...(v[ci] || {}), imageUrl: e.target.value } }))} />
                  <button type="button" onClick={() => addCfgOpt(ci)} className="config-add-btn">+</button>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="form-input" style={inputSm} placeholder="Config group name (e.g. Layout)"
                value={newCfgGroup.name} onChange={e => setNewCfgGroup({ name: e.target.value })} />
              <button type="button" onClick={addCfgGroup} className="config-add-btn">+ Add Config</button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-dark" disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
              <span>{submitting ? 'Creating...' : 'Create Product'}</span>
            </button>
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   RICH TEXT RENDERER
   Renders markdown-like syntax to styled JSX.
   Supported: # heading, **bold**, *italic*, - bullet, blank lines
═══════════════════════════════════════════════ */
export function RichText({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let bulletBuffer = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={key++} style={{ margin: '0 0 12px 0', paddingLeft: '20px', lineHeight: 1.75 }}>
        {bulletBuffer.map((b, i) => <li key={i}>{parseInline(b)}</li>)}
      </ul>
    );
    bulletBuffer = [];
  };

  const parseInline = (text) => {
    const parts = [];
    let remaining = text;
    let idx = 0;
    // Bold: **text**
    remaining = remaining.replace(/\*\*(.+?)\*\*/g, (_, m) => `\x00b${m}\x00`);
    // Italic: *text*
    remaining = remaining.replace(/\*(.+?)\*/g, (_, m) => `\x00i${m}\x00`);

    const chunks = remaining.split('\x00');
    return chunks.map((chunk, ci) => {
      if (chunk.startsWith('b')) return <strong key={ci}>{chunk.slice(1)}</strong>;
      if (chunk.startsWith('i')) return <em key={ci}>{chunk.slice(1)}</em>;
      return chunk;
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushBullets();
      elements.push(<div key={key++} style={{ height: '0.75em' }} />);
      continue;
    }

    // Heading: # or ## or ###
    const headMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headMatch) {
      flushBullets();
      const level = headMatch[1].length;
      const sizes = ['1.1rem', '1rem', '0.95rem'];
      elements.push(
        <p key={key++} style={{ fontWeight: 700, fontSize: sizes[level - 1], margin: '12px 0 4px', color: 'var(--ink)' }}>
          {parseInline(headMatch[2])}
        </p>
      );
      continue;
    }

    // Bullet: - or *
    if (/^[-*]\s+/.test(trimmed)) {
      bulletBuffer.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    flushBullets();
    elements.push(
      <p key={key++} style={{ margin: '0 0 6px', lineHeight: 1.75 }}>
        {parseInline(trimmed)}
      </p>
    );
  }

  flushBullets();
  return <div>{elements}</div>;
}
