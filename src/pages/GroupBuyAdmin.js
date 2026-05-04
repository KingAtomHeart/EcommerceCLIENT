import { useState, useEffect, useContext, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { apiFetch } from '../utils/api';
import { statusPaletteKey, StatusBadge } from '../utils/statusColors';
import toast from 'react-hot-toast';
import { RichText } from '../components/AdminView';

async function uploadOptionImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const data = await apiFetch('/upload/single', { method: 'POST', body: fd });
  return data.url;
}

const STATUSES = ['interest-check', 'open', 'closing-soon', 'closed', 'production', 'completed'];
const SL = { 'interest-check': 'Interest Check', 'open': 'Open', 'closing-soon': 'Closing Soon', 'closed': 'Closed', 'production': 'In Production', 'completed': 'Completed' };

export default function GroupBuyAdmin({
  embedded = false,
  searchQuery: searchQueryProp,
  sortBy: sortByProp,
  showArchived: showArchivedProp,
  showCreate: showCreateProp,
  setShowCreate: setShowCreateProp,
}) {
  const { user } = useContext(UserContext);
  const [gbs, setGbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateLocal, setShowCreateLocal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [showArchivedLocal, setShowArchivedLocal] = useState(false);
  const [searchQueryLocal, setSearchQueryLocal] = useState('');
  const [sortByLocal, setSortByLocal] = useState('newest');

  // Use props when embedded, internal state when standalone
  const searchQuery = embedded ? (searchQueryProp ?? '') : searchQueryLocal;
  const setSearchQuery = embedded ? (() => {}) : setSearchQueryLocal;
  const sortBy = embedded ? (sortByProp ?? 'newest') : sortByLocal;
  const setSortBy = embedded ? (() => {}) : setSortByLocal;
  const showArchived = embedded ? !!showArchivedProp : showArchivedLocal;
  const setShowArchived = embedded ? (() => {}) : setShowArchivedLocal;
  const showCreate = embedded ? !!showCreateProp : showCreateLocal;
  const setShowCreate = embedded ? (setShowCreateProp || (() => {})) : setShowCreateLocal;

  const fetchGbs = () => { setLoading(true); apiFetch('/group-buys/all').then(d => setGbs(Array.isArray(d) ? d : [])).catch(() => setGbs([])).finally(() => setLoading(false)); };
  useEffect(() => { fetchGbs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!embedded && !user?.isAdmin) return <Navigate to="/products" />;

  const updateGbLocal = (id, patch) => setGbs(prev => prev.map(g => g._id === id ? { ...g, ...patch } : g));

  const filtered = (() => {
    // Hide add-ons from the main list — they're managed inside the parent's "Add-ons" panel
    let list = (showArchived ? gbs : gbs.filter(g => g.isActive)).filter(g => !g.parentGroupBuyId);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(g =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.category || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sortBy) {
      case 'oldest': sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)); break;
      case 'name-asc': sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'name-desc': sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
      case 'orders-desc': sorted.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0)); break;
      case 'price-asc': sorted.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0)); break;
      case 'price-desc': sorted.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0)); break;
      case 'status': sorted.sort((a, b) => (a.status || '').localeCompare(b.status || '')); break;
      case 'newest':
      default: sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return sorted;
  })();

  const inner = (
    <>
      {!embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.4rem', letterSpacing: '-0.025em', marginBottom: '8px' }}>Group Buys</h1>
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>Manage group buys, interest checks, and orders.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-muted)', minWidth: 220 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search group buys..."
                style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', color: 'var(--ink)', minWidth: 0 }}
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: '1rem', lineHeight: 1, padding: '0 2px' }}>×</button>}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', color: 'var(--ink-muted)', cursor: 'pointer' }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="orders-desc">Most orders</option>
              <option value="price-desc">Price: high to low</option>
              <option value="price-asc">Price: low to high</option>
              <option value="status">By status</option>
            </select>
            <Pill onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Hide' : 'Show'} Archived</Pill>
            <button className="btn-dark" onClick={() => setShowCreate(true)} style={{ padding: '10px 24px' }}><span>+ New Group Buy</span></button>
          </div>
        </div>
      )}

      {showCreate && <CreateGBModal gbs={gbs} onClose={() => setShowCreate(false)} onCreated={() => { fetchGbs(); setShowCreate(false); }} />}

      {loading ? <div className="loading-center"><div className="spinner" /></div> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-muted)', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {searchQuery ? `No group buys matching "${searchQuery}".` : `No group buys${!showArchived ? ' (try showing archived)' : ''}.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map(gb => (
            <GBCard key={gb._id} gb={gb} gbs={gbs} fetchGbs={fetchGbs}
              updateGbLocal={updateGbLocal}
              isExpanded={expandedId === gb._id} panel={expandedId === gb._id ? expandedPanel : null}
              onTogglePanel={(p) => {
                if (p === null || (expandedId === gb._id && expandedPanel === p)) { setExpandedId(null); setExpandedPanel(null); }
                else { setExpandedId(gb._id); setExpandedPanel(p); }
              }}
            />
          ))}
        </div>
      )}
    </>
  );

  if (embedded) return inner;
  return (
    <div className="page-body" style={{ padding: '56px var(--page-pad) 80px' }}>
      {inner}
    </div>
  );
}

function Pill({ children, onClick, active }) {
  return <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: active ? 'var(--accent)' : 'none', color: active ? '#fff' : 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: 'var(--transition)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{children}</button>;
}

function Caret({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PanelHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      {onClose && (
        <button onClick={onClose} aria-label="Close" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.72rem', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
          ✕ Close
        </button>
      )}
      <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{title}</span>
    </div>
  );
}

function GBCard({ gb, gbs, fetchGbs, updateGbLocal, isExpanded, panel, onTogglePanel }) {
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [editMenuPos, setEditMenuPos] = useState({ top: 0, left: 0 });
  const [hoveredMenuKey, setHoveredMenuKey] = useState(null);
  const editMenuRef = useRef(null);
  const editBtnRef = useRef(null);
  const togglePanel = (p) => { setEditMenuOpen(false); onTogglePanel(p); };
  const closePanel = () => onTogglePanel(null);
  const toggleEditMenu = () => {
    if (!editMenuOpen && editBtnRef.current) {
      const r = editBtnRef.current.getBoundingClientRect();
      setEditMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setEditMenuOpen(o => !o);
  };
  useEffect(() => {
    if (!editMenuOpen) return;
    const onDocClick = (e) => {
      if (editMenuRef.current && !editMenuRef.current.contains(e.target) &&
          editBtnRef.current && !editBtnRef.current.contains(e.target)) setEditMenuOpen(false);
    };
    const onScroll = () => setEditMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [editMenuOpen]);
  const updateStatus = async (s) => {
    const prev = gb.status;
    updateGbLocal(gb._id, { status: s });
    try { await apiFetch(`/group-buys/${gb._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) }); toast.success(`Status → ${SL[s]}`); }
    catch (err) { updateGbLocal(gb._id, { status: prev }); toast.error(err.message); }
  };
  const toggleActive = async () => {
    const action = gb.isActive ? 'archive' : 'activate';
    const prev = gb.isActive;
    updateGbLocal(gb._id, { isActive: !prev });
    try { await apiFetch(`/group-buys/${gb._id}/${action}`, { method: 'PATCH' }); toast.success(prev ? 'Archived' : 'Activated'); }
    catch (err) { updateGbLocal(gb._id, { isActive: prev }); toast.error(err.message); }
  };
  const exportCSV = async (type) => {
    try {
      const token = localStorage.getItem('token');
      const API = process.env.REACT_APP_API_BASE_URL;
      const url = type === 'interest' ? `/group-buys/${gb._id}/interest/export-csv`
        : type === 'addons' ? `/group-buys/${gb._id}/export-csv?scope=addons`
        : `/group-buys/${gb._id}/export-csv`;
      const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Export failed'); }
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = u; a.download = `${gb.name.replace(/[^a-zA-Z0-9]/g, '_')}_${type}.csv`; a.click();
      URL.revokeObjectURL(u); toast.success('CSV downloaded');
    } catch (err) { toast.error(err.message); }
  };

  const icCount = gb.interestChecks?.length || 0;
  const hasOptions = (gb.options?.length || 0) > 0;
  const displayPrice = hasOptions
    ? `From ₱${Math.min(...gb.options.flatMap(g => g.values.map(v => v.price))).toLocaleString()}`
    : `₱${gb.basePrice?.toLocaleString()}`;
  const parentGb = gb.parentGroupBuyId ? (gbs || []).find(g => g._id === (gb.parentGroupBuyId?._id || gb.parentGroupBuyId)) : null;

  const isOpen = !!panel;
  return (
    <div style={{
      background: 'var(--surface)',
      border: isOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      boxShadow: isOpen ? '0 8px 24px rgba(0,0,0,0.12), 0 0 0 3px var(--accent-light)' : 'var(--shadow-card)',
      opacity: gb.isActive ? 1 : 0.6,
      transition: 'box-shadow 0.2s, border-color 0.2s, opacity 0.2s'
    }}>
      <div className="admin-product-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', flexWrap: 'wrap' }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0 }}>
          {gb.images?.[0]?.url ? <img src={gb.images[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', serif", color: 'var(--accent)' }}>{gb.name[0]}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.08rem', margin: 0 }}>{gb.name}</p>
            {parentGb && (
              <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '10px', background: 'rgba(120,80,200,0.1)', color: 'rgb(120,80,200)', whiteSpace: 'nowrap' }}>
                Add-on of {parentGb.name}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', color: 'var(--ink-muted)', flexWrap: 'wrap' }}>
            <span>{displayPrice}</span><span>{gb.uniqueOrderCount ?? gb.orderCount ?? 0} orders</span>
            {icCount > 0 && <span>{icCount} interested</span>}
            {!gb.isActive && <span style={{ color: '#c0392b' }}>Archived</span>}
          </div>
        </div>
        <select value={gb.status} onChange={e => updateStatus(e.target.value)}
          className={`status-select status-${statusPaletteKey(gb.status)}`}>
          {STATUSES.map(s => <option key={s} value={s}>{SL[s]}</option>)}
        </select>
        <div className="admin-product-actions" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <div ref={editBtnRef} style={{ display: 'inline-block' }}>
            <Pill onClick={toggleEditMenu} active={editMenuOpen || ['details','images','options','configs'].includes(panel)}>
              Edit <Caret open={editMenuOpen} />
            </Pill>
          </div>
          {editMenuOpen && (
            <div ref={editMenuRef} style={{ position: 'fixed', top: editMenuPos.top, left: editMenuPos.left, zIndex: 1000, background: 'var(--surface)', border: '1px solid var(--ink-faint)', borderRadius: 'var(--radius-sm)', boxShadow: '0 14px 36px rgba(0,0,0,0.22), 0 3px 8px rgba(0,0,0,0.10)', minWidth: 160, overflow: 'hidden', padding: '4px' }}>
              <p style={{ margin: 0, padding: '4px 10px 6px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>Edit</p>
              {[
                { key: 'details', label: 'Details' },
                { key: 'images', label: 'Images' },
                { key: 'options', label: 'Options' },
                { key: 'configs', label: 'Configs' },
              ].map(item => {
                const isActive = panel === item.key;
                const isHovered = hoveredMenuKey === item.key;
                const bg = isActive ? 'var(--accent)' : (isHovered ? 'var(--accent-light)' : 'transparent');
                const color = isActive ? '#fff' : (isHovered ? 'var(--accent)' : 'var(--ink)');
                return (
                  <button key={item.key} onClick={() => { togglePanel(item.key); }}
                    onMouseEnter={() => setHoveredMenuKey(item.key)}
                    onMouseLeave={() => setHoveredMenuKey(null)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: bg, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif", color, fontWeight: 500, borderRadius: '6px', transition: 'background 0.12s, color 0.12s' }}>
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
          {!parentGb && (
            <Pill onClick={() => togglePanel('orders')} active={panel === 'orders'}>
              Orders <Caret open={panel === 'orders'} />
            </Pill>
          )}
          {!parentGb && (
            <Pill onClick={() => togglePanel('addons')} active={panel === 'addons'}>
              Add-ons <Caret open={panel === 'addons'} />
            </Pill>
          )}
          {!parentGb && <Pill onClick={() => exportCSV('orders')}>CSV</Pill>}
          {!parentGb && (gb.addOns?.length > 0) && <Pill onClick={() => exportCSV('addons')}>Add-ons CSV</Pill>}
          {gb.status === 'interest-check' && <Pill onClick={() => togglePanel('interest')} active={panel === 'interest'}>IC ({icCount})</Pill>}
          <Pill onClick={toggleActive}>{gb.isActive ? 'Archive' : 'Activate'}</Pill>
        </div>
      </div>
      {panel === 'details' && <EditGBCard gb={gb} gbs={gbs} fetchGbs={fetchGbs} onClose={closePanel} inline />}
      {panel === 'images' && <ImagePanel gbId={gb._id} images={gb.images || []} fetchGbs={fetchGbs} onClose={closePanel} />}
      {panel === 'options' && <GBOptionsManager gb={gb} fetchGbs={fetchGbs} onClose={closePanel} />}
      {panel === 'configs' && <GBConfigManager gb={gb} fetchGbs={fetchGbs} onClose={closePanel} />}
      {panel === 'interest' && <InterestPanel gb={gb} exportCSV={() => exportCSV('interest')} />}
      {panel === 'orders' && <OrdersPanel groupBuyId={gb._id} />}
      {panel === 'addons' && <AddonsPanel parentGb={gb} gbs={gbs} fetchGbs={fetchGbs} />}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   EDIT GROUP BUY
═══════════════════════════════════════════════ */
function EditGBCard({ gb, gbs, fetchGbs, onClose, inline }) {
  const [form, setForm] = useState({
    name: gb.name,
    description: gb.description || '',
    basePrice: gb.basePrice,
    moq: gb.moq || 0,
    maxOrders: gb.maxOrders || 0,
    category: gb.category || '',
    startDate: gb.startDate ? gb.startDate.slice(0, 10) : '',
    endDate: gb.endDate ? gb.endDate.slice(0, 10) : '',
    parentGroupBuyId: gb.parentGroupBuyId?._id || gb.parentGroupBuyId || '',
  });
  const eligibleParents = (gbs || []).filter(g => g._id !== gb._id && !g.parentGroupBuyId);
  const [saving, setSaving] = useState(false);
  const [descPreview, setDescPreview] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/group-buys/${gb._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, basePrice: Number(form.basePrice), moq: Number(form.moq), maxOrders: Number(form.maxOrders), parentGroupBuyId: form.parentGroupBuyId || null })
      });
      toast.success('Updated'); onClose(); fetchGbs();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const wrapperStyle = inline
    ? { padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)' }
    : { background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: 'var(--radius)', padding: '24px' };

  return (
    <div style={wrapperStyle}>
      <PanelHeader title={inline ? 'Edit Details' : `Edit: ${gb.name}`} onClose={onClose} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={set('name')} /></div>
        <div className="form-group"><label className="form-label">Base Price (₱) — used if no options</label><input type="number" className="form-input" value={form.basePrice} onChange={set('basePrice')} /></div>
      </div>
      {eligibleParents.length > 0 && (
        <div className="form-group">
          <label className="form-label">Parent Group Buy (make this an add-on)</label>
          <select className="form-input" value={form.parentGroupBuyId} onChange={set('parentGroupBuyId')}>
            <option value="">— None (standalone) —</option>
            {eligibleParents.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Rich text description */}
      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="form-label" style={{ margin: 0 }}>Description</label>
          <button type="button" onClick={() => setDescPreview(p => !p)} style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            {descPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {descPreview ? (
          <div style={{ minHeight: 60, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.88rem', lineHeight: 1.7 }}>
            {form.description ? <RichText content={form.description} /> : <span style={{ color: 'var(--ink-faint)' }}>No description yet.</span>}
          </div>
        ) : (
          <>
            <textarea className="form-input" value={form.description} onChange={set('description')}
              style={{ minHeight: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }} />
            <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: '3px' }}>
              Markdown: **bold** · *italic* · # Heading · - bullet · blank line = new paragraph
            </p>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
        <div className="form-group"><label className="form-label">MOQ</label><input type="number" className="form-input" value={form.moq} onChange={set('moq')} /></div>
        <div className="form-group"><label className="form-label">Max</label><input type="number" className="form-input" value={form.maxOrders} onChange={set('maxOrders')} /></div>
        <div className="form-group"><label className="form-label">Start</label><input type="date" className="form-input" value={form.startDate} onChange={set('startDate')} /></div>
        <div className="form-group"><label className="form-label">End</label><input type="date" className="form-input" value={form.endDate} onChange={set('endDate')} /></div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn-dark" disabled={saving} onClick={save} style={{ padding: '9px 22px' }}><span>{saving ? 'Saving...' : 'Save'}</span></button>
        <button className="btn-outline" onClick={onClose} style={{ padding: '9px 22px' }}>Cancel</button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   IMAGE PANEL
═══════════════════════════════════════════════ */
function ImagePanel({ gbId, images, fetchGbs, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [dragSrcIdx, setDragSrcIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const upload = async (e) => {
    const files = e.target.files; if (!files?.length) return;
    const fd = new FormData(); for (let i = 0; i < files.length; i++) fd.append('images', files[i]);
    setUploading(true);
    try { await apiFetch(`/group-buys/${gbId}/images`, { method: 'POST', body: fd }); toast.success('Uploaded'); fetchGbs(); }
    catch (err) { toast.error(err.message); } finally { setUploading(false); e.target.value = ''; }
  };

  const handleAddUrl = async () => {
    const url = urlInput.trim(); if (!url) return;
    setAddingUrl(true);
    try {
      await apiFetch(`/group-buys/${gbId}/images/add-url`, { method: 'POST', body: JSON.stringify({ url }) });
      toast.success('Image added'); setUrlInput(''); fetchGbs();
    } catch (err) { toast.error(err.message); } finally { setAddingUrl(false); }
  };

  const del = async (imgId) => {
    if (!window.confirm('Delete this image?')) return;
    try { await apiFetch(`/group-buys/${gbId}/images/${imgId}`, { method: 'DELETE' }); toast.success('Deleted'); fetchGbs(); }
    catch (err) { toast.error(err.message); }
  };

  const handleDrop = async (dropIdx) => {
    if (dragSrcIdx === null || dragSrcIdx === dropIdx) { setDragOverIdx(null); setDragSrcIdx(null); return; }
    const imgs = [...images];
    const [moved] = imgs.splice(dragSrcIdx, 1);
    imgs.splice(dropIdx, 0, moved);
    setDragOverIdx(null); setDragSrcIdx(null);
    try {
      await apiFetch(`/group-buys/${gbId}/images/reorder`, {
        method: 'PATCH', body: JSON.stringify({ imageIds: imgs.map(i => i._id) }),
      });
      fetchGbs();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' }}>
      <PanelHeader title="Images" onClose={onClose} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <label style={{ padding: '4px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', fontSize: '0.72rem', cursor: 'pointer', color: 'var(--accent)', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
          {uploading ? 'Uploading...' : '+ Upload'}<input type="file" multiple accept="image/*" onChange={upload} style={{ display: 'none' }} disabled={uploading} />
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
        {images.map((img, idx) => (
          <div key={img._id} draggable
            onDragStart={() => setDragSrcIdx(idx)}
            onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragOverIdx(null); setDragSrcIdx(null); }}
            style={{ position: 'relative', width: 72, height: 72, borderRadius: '8px', overflow: 'hidden',
              border: dragOverIdx === idx ? '2px dashed var(--accent)' : '1px solid var(--border)',
              cursor: 'grab', opacity: dragSrcIdx === idx ? 0.4 : 1, transition: 'border 0.15s' }}>
            <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            <button onClick={() => del(img._id)} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem' }}>✕</button>
            {idx === 0 && <span style={{ position: 'absolute', bottom: 3, left: 3, fontSize: '0.5rem', fontWeight: 700, background: 'var(--accent)', color: '#fff', padding: '1px 4px', borderRadius: '4px' }}>MAIN</span>}
          </div>
        ))}
        {images.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>No images.</p>}
      </div>
      <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: '6px' }}>Drag thumbnails to reorder. First image is the main/cover image.</p>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   GB OPTIONS MANAGER
═══════════════════════════════════════════════ */
function GBOptionsManager({ gb, fetchGbs, onClose }) {
  const [groups, setGroups] = useState(
    (gb.options || []).map(g => ({ ...g, values: (g.values || []).map(v => ({ ...v })) }))
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({});
  const [newGroup, setNewGroup] = useState({ name: '' });
  const [newValues, setNewValues] = useState({});

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
      ...grp, values: [...grp.values, {
        value: nv.value.trim(), price: Number(nv.price) || 0, available: true,
        image: { url: nv.imageUrl?.trim() || '', altText: nv.value.trim() }
      }]
    }));
    setNewValues(v => ({ ...v, [gi]: { value: '', price: '', imageUrl: '' } }));
  };
  const removeValue = (gi, vi) => setGroups(g => g.map((grp, i) => i !== gi ? grp : { ...grp, values: grp.values.filter((_, j) => j !== vi) }));
  const toggleAvailable = (gi, vi) => setGroups(g => g.map((grp, i) => i !== gi ? grp : { ...grp, values: grp.values.map((v, j) => j !== vi ? v : { ...v, available: !v.available }) }));
  const updateValueField = (gi, vi, field, val) => setGroups(g => g.map((grp, i) => i !== gi ? grp : {
    ...grp, values: grp.values.map((v, j) => j !== vi ? v : field === 'imageUrl'
      ? { ...v, image: { ...v.image, url: val } }
      : { ...v, [field]: field === 'price' ? Number(val) || 0 : val }
    )
  }));

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/group-buys/${gb._id}`, { method: 'PATCH', body: JSON.stringify({ options: groups }) });
      toast.success('Options saved'); fetchGbs();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  return (
    <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)' }}>
      <PanelHeader title="Options — price-setting selectors (e.g., Kit: Base Kit / Novelties)" onClose={onClose} />

      {groups.map((grp, gi) => (
        <div key={gi} style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{grp.name}</span>
            <button onClick={() => removeGroup(gi)} style={{ fontSize: '0.68rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove Group</button>
          </div>
          {grp.values.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr 56px 24px', gap: '4px', marginBottom: '4px' }}>
              {['Value', 'Price ₱', 'Image URL (opt.)', 'Avail.', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.61rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</span>
              ))}
            </div>
          )}
          {grp.values.map((val, vi) => (
            <div key={vi} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr 56px 24px', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
              <input className="form-input" style={inputSm} value={val.value} onChange={e => updateValueField(gi, vi, 'value', e.target.value)} />
              <input type="number" className="form-input" style={inputSm} value={val.price} onChange={e => updateValueField(gi, vi, 'price', e.target.value)} />
              <div style={{ display: 'flex', gap: '3px' }}>
                <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0 }} placeholder="https://..." value={val.image?.url || ''} onChange={e => updateValueField(gi, vi, 'imageUrl', e.target.value)} />
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
              <button onClick={() => toggleAvailable(gi, vi)} style={{ fontSize: '0.62rem', padding: '3px 6px', borderRadius: '10px', border: '1px solid', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: val.available ? 'var(--accent-light)' : 'transparent', color: val.available ? 'var(--accent)' : 'var(--ink-faint)', borderColor: val.available ? 'var(--accent)' : 'var(--border)' }}>{val.available ? 'On' : 'Off'}</button>
              <button onClick={() => removeValue(gi, vi)} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr auto', gap: '4px', alignItems: 'center', marginTop: '6px' }}>
            <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="Value (e.g. Base Kit)" value={newValues[gi]?.value || ''} onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), value: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="₱" value={newValues[gi]?.price || ''} onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), price: e.target.value } }))} />
            <div style={{ display: 'flex', gap: '3px' }}>
              <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed', flex: 1, minWidth: 0 }} placeholder="Image URL (opt.)" value={newValues[gi]?.imageUrl || ''} onChange={e => setNewValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: e.target.value } }))} />
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
            <button onClick={() => addValue(gi)} style={{ padding: '5px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.7rem', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px' }}>
        <input className="form-input" style={{ fontSize: '0.78rem', padding: '6px 8px' }} placeholder="New group name (e.g. Kit)"
          value={newGroup.name} onChange={e => setNewGroup({ name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && addGroup()} />
        <button onClick={addGroup} style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>+ Add Group</button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={save} disabled={saving} className="btn-dark" style={{ padding: '7px 18px', fontSize: '0.8rem' }}>
          <span>{saving ? 'Saving...' : 'Save Options'}</span>
        </button>
        {onClose && (
          <button onClick={onClose} className="btn-outline" style={{ padding: '7px 18px', fontSize: '0.8rem' }}>Cancel</button>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   GB CONFIG MANAGER
═══════════════════════════════════════════════ */
function GBConfigManager({ gb, fetchGbs, onClose }) {
  const [configs, setConfigs] = useState(
    (gb.configurations || []).map(c => ({
      ...c, options: (c.options || []).map(o => ({ ...o, image: o.image || { url: '', altText: '' } }))
    }))
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({});
  const [newCfgName, setNewCfgName] = useState('');
  const [newOptInputs, setNewOptInputs] = useState({});

  const toggleAvail = (ci, oi) => setConfigs(p => p.map((c, i) => i !== ci ? c : { ...c, options: c.options.map((o, j) => j !== oi ? o : { ...o, available: !o.available }) }));
  const removeConfig = (ci) => setConfigs(p => p.filter((_, i) => i !== ci));
  const removeOpt = (ci, oi) => setConfigs(p => p.map((c, i) => i !== ci ? c : { ...c, options: c.options.filter((_, j) => j !== oi) }));
  const updateOptField = (ci, oi, field, val) => setConfigs(p => p.map((c, i) => i !== ci ? c : {
    ...c, options: c.options.map((o, j) => j !== oi ? o : field === 'imageUrl'
      ? { ...o, image: { ...o.image, url: val } }
      : { ...o, [field]: field === 'priceModifier' ? Number(val) || 0 : val }
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
      ...c, options: [...c.options, { value: inp.value.trim(), available: true, priceModifier: Number(inp.priceModifier) || 0, image: { url: inp.imageUrl?.trim() || '', altText: inp.value.trim() } }]
    }));
    setNewOptInputs(v => ({ ...v, [ci]: { value: '', priceModifier: 0, imageUrl: '' } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/group-buys/${gb._id}`, { method: 'PATCH', body: JSON.stringify({ configurations: configs }) });
      toast.success('Saved'); fetchGbs();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const inputSm = { fontSize: '0.72rem', padding: '5px 7px' };

  return (
    <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)' }}>
      <PanelHeader title="Configs — add-on selectors that affect the final price" onClose={onClose} />

      {configs.map((cfg, ci) => (
        <div key={ci} style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cfg.name}</span>
            <button onClick={() => removeConfig(ci)} style={{ fontSize: '0.7rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
          </div>
          {cfg.options.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 1fr 44px 22px', gap: '4px', marginBottom: '4px' }}>
              {['Value', '+₱', 'Image URL (opt.)', 'Avail.', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.61rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</span>
              ))}
            </div>
          )}
          {cfg.options.map((opt, oi) => (
            <div key={oi} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 1fr 44px 22px', gap: '4px', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 500, padding: '4px 2px', textDecoration: opt.available ? 'none' : 'line-through', opacity: opt.available ? 1 : 0.45 }}>{opt.value}</span>
              <input type="number" className="form-input" style={inputSm} value={opt.priceModifier} onChange={e => updateOptField(ci, oi, 'priceModifier', e.target.value)} />
              <div style={{ display: 'flex', gap: '3px' }}>
                <input className="form-input" style={{ ...inputSm, flex: 1, minWidth: 0 }} placeholder="https://..." value={opt.image?.url || ''} onChange={e => updateOptField(ci, oi, 'imageUrl', e.target.value)} />
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
              <button onClick={() => toggleAvail(ci, oi)} style={{ fontSize: '0.6rem', padding: '2px 5px', borderRadius: '10px', border: '1px solid', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: opt.available ? 'var(--accent-light)' : 'transparent', color: opt.available ? 'var(--accent)' : 'var(--ink-faint)', borderColor: opt.available ? 'var(--accent)' : 'var(--border)' }}>{opt.available ? 'On' : 'Off'}</button>
              <button onClick={() => removeOpt(ci, oi)} style={{ fontSize: '0.65rem', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 1fr auto', gap: '4px', alignItems: 'center', marginTop: '6px' }}>
            <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="Option value" value={newOptInputs[ci]?.value || ''} onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), value: e.target.value } }))} />
            <input type="number" className="form-input" style={{ ...inputSm, borderStyle: 'dashed' }} placeholder="+₱" value={newOptInputs[ci]?.priceModifier || ''} onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), priceModifier: e.target.value } }))} />
            <div style={{ display: 'flex', gap: '3px' }}>
              <input className="form-input" style={{ ...inputSm, borderStyle: 'dashed', flex: 1, minWidth: 0 }} placeholder="Image URL (opt.)" value={newOptInputs[ci]?.imageUrl || ''} onChange={e => setNewOptInputs(v => ({ ...v, [ci]: { ...(v[ci] || {}), imageUrl: e.target.value } }))} />
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
            <button onClick={() => addOpt(ci)} style={{ padding: '5px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.7rem', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px' }}>
        <input className="form-input" style={{ fontSize: '0.78rem', padding: '6px 8px' }} placeholder="Config group name (e.g. Layout)"
          value={newCfgName} onChange={e => setNewCfgName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addConfig()} />
        <button onClick={addConfig} style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>+ Add Config</button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={save} disabled={saving} className="btn-dark" style={{ padding: '7px 18px', fontSize: '0.8rem' }}>
          <span>{saving ? 'Saving...' : 'Save Configs'}</span>
        </button>
        {onClose && (
          <button onClick={onClose} className="btn-outline" style={{ padding: '7px 18px', fontSize: '0.8rem' }}>Cancel</button>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   INTEREST PANEL
═══════════════════════════════════════════════ */
function InterestPanel({ gb, exportCSV }) {
  const ics = gb.interestChecks || [];
  const configNames = (gb.configurations || []).map(c => c.name);
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Interest Registrations ({ics.length})</p>
        {ics.length > 0 && <Pill onClick={exportCSV}>Export CSV</Pill>}
      </div>
      {ics.length === 0 ? <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>No interest registrations yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Name', 'Email', 'Date', ...configNames, 'Option', 'Note'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{h}</th>)}</tr></thead>
            <tbody>{ics.map((ic, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 500 }}>{ic.name}</td>
                <td style={{ padding: '8px 10px', color: 'var(--ink-muted)' }}>{ic.email}</td>
                <td style={{ padding: '8px 10px' }}>{new Date(ic.registeredAt).toLocaleDateString()}</td>
                {configNames.map(cn => <td key={cn} style={{ padding: '8px 10px' }}>{ic.configurations?.find(c => c.name === cn)?.selected || '—'}</td>)}
                <td style={{ padding: '8px 10px' }}>{ic.selectedOption?.value ? `${ic.selectedOption.groupName}: ${ic.selectedOption.value}` : '—'}</td>
                <td style={{ padding: '8px 10px', color: 'var(--ink-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ic.note || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   ADD-ONS PANEL — shows child add-on GBs as full GBCards inside parent
═══════════════════════════════════════════════ */
function AddonsPanel({ parentGb, gbs, fetchGbs }) {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedSubPanel, setExpandedSubPanel] = useState(null);
  const updateGbLocal = () => fetchGbs();
  const addons = (gbs || []).filter(g => (g.parentGroupBuyId === parentGb._id) || (g.parentGroupBuyId?._id === parentGb._id));

  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Add-ons of {parentGb.name}</p>
        <button onClick={() => setShowCreate(true)} className="btn-dark" style={{ padding: '6px 14px', fontSize: '0.78rem' }}><span>+ New Add-on</span></button>
      </div>
      {showCreate && (
        <CreateGBModal gbs={gbs} forcedParentId={parentGb._id} onClose={() => setShowCreate(false)} onCreated={() => { fetchGbs(); setShowCreate(false); }} />
      )}
      {addons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--ink-muted)', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.84rem' }}>
          No add-ons yet. Create one to offer optional extras for this group buy.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {addons.map(ao => (
            <GBCard key={ao._id} gb={ao} gbs={gbs} fetchGbs={fetchGbs} updateGbLocal={updateGbLocal}
              isExpanded={expandedId === ao._id} panel={expandedId === ao._id ? expandedSubPanel : null}
              onTogglePanel={(p) => {
                if (expandedId === ao._id && expandedSubPanel === p) { setExpandedId(null); setExpandedSubPanel(null); }
                else { setExpandedId(ao._id); setExpandedSubPanel(p); }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════
   ORDERS PANEL
═══════════════════════════════════════════════ */
function OrdersPanel({ groupBuyId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchOrders = () => {
    setLoading(true);
    apiFetch(`/group-buys/${groupBuyId}/orders`).then(d => setOrders(d.orders || [])).catch(() => setOrders([])).finally(() => setLoading(false));
  };
  useEffect(() => { fetchOrders(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [groupBuyId]);
  const updateOrderLocal = (id, patch) => setOrders(prev => prev.map(o => o._id === id ? { ...o, ...patch } : o));
  if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!orders.length) return <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', color: 'var(--ink-muted)', fontSize: '0.82rem' }}>No orders.</div>;

  // Group by cartCheckoutId; solo orders (no cartCheckoutId) become single-item groups
  const groups = [];
  const groupMap = new Map();
  for (const o of orders) {
    if (!o.cartCheckoutId) { groups.push({ key: o._id, items: [o] }); continue; }
    if (!groupMap.has(o.cartCheckoutId)) {
      const g = { key: o.cartCheckoutId, items: [] };
      groupMap.set(o.cartCheckoutId, g);
      groups.push(g);
    }
    groupMap.get(o.cartCheckoutId).items.push(o);
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {groups.map(g => <UnifiedGBOrderCard key={g.key} items={g.items} updateOrderLocal={updateOrderLocal} parentGbId={groupBuyId} fetchOrders={fetchOrders} />)}
    </div>
  );
}

function UnifiedGBOrderCard({ items, updateOrderLocal, parentGbId, fetchOrders }) {
  const [expanded, setExpanded] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const statuses = ['Confirmed', 'In Production', 'Shipped', 'Delivered', 'Cancelled'];

  // Sort items: parent first, then add-ons
  const sorted = [...items].sort((a, b) => {
    const aIsAddon = !!a.groupBuyId?.parentGroupBuyId;
    const bIsAddon = !!b.groupBuyId?.parentGroupBuyId;
    return Number(aIsAddon) - Number(bIsAddon);
  });
  const primary = sorted[0];
  const u = primary.userId;
  const customerName = typeof u === 'object' ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '—';
  const email = typeof u === 'object' ? u.email : '';
  const phone = typeof u === 'object' ? u.mobileNo : '';
  const ship = primary.shippingAddress || {};
  const cartCode = primary.cartOrderCode || primary.orderCode;
  const activeItems = sorted.filter(i => i.status !== 'Cancelled');
  const cancelledItems = sorted.filter(i => i.status === 'Cancelled');
  const activeTotal = activeItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const cancelledTotal = cancelledItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const originalTotal = sorted.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const primaryName = primary.groupBuyId?.name || 'Group Buy';
  const addonCount = sorted.filter(i => i.groupBuyId?.parentGroupBuyId).length;
  // Header summary status: most common active status, or "Cancelled" if all cancelled
  const headerStatus = activeItems.length === 0 ? 'Cancelled' : (() => {
    const counts = {};
    activeItems.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  })();

  const updateItemStatus = async (orderId, newStatus) => {
    const item = sorted.find(i => i._id === orderId);
    if (!item) return;
    const prev = item.status;
    setUpdatingId(orderId);
    updateOrderLocal(orderId, { status: newStatus });
    try {
      await apiFetch(`/group-buys/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      toast.success(newStatus === 'Cancelled' ? 'Item cancelled — stock restored' : `Status → ${newStatus}`);
    }
    catch (err) { updateOrderLocal(orderId, { status: prev }); toast.error(err.message); }
    finally { setUpdatingId(null); }
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <button type="button" onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto auto 1fr 1fr 1fr auto auto', gap: '16px', alignItems: 'center', padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--ink)' }}
        className="gb-order-header">
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--ink-muted)' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {primary.groupBuyId?.images?.[0]?.url
            ? <img src={primary.groupBuyId.images[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.4rem', color: 'var(--accent)' }}>{primaryName?.[0]}</span>}
        </div>
        <div>
          <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Order</p>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '0.95rem', marginTop: 2 }}>{cartCode}</p>
          <p style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginTop: 2 }}>
            {primaryName}{addonCount > 0 && <span style={{ color: 'rgb(120,80,200)' }}> + {addonCount} add-on{addonCount > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Customer</p>
          <p style={{ fontSize: '0.86rem', fontWeight: 500, marginTop: 2 }}>{customerName || '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Date</p>
          <p style={{ fontSize: '0.86rem', marginTop: 2 }}>{new Date(primary.createdAt).toLocaleDateString()}</p>
        </div>
        <StatusBadge status={headerStatus} />
        <span style={{ fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
          ₱{activeTotal.toLocaleString()}
          {cancelledTotal > 0 && <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400, color: 'var(--ink-faint)', textAlign: 'right' }}>−₱{cancelledTotal.toLocaleString()} cancelled</span>}
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '18px 22px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            <DetailItem label="Email" value={email || '—'} />
            <DetailItem label="Phone" value={phone || ship.phone || '—'} />
            <DetailItem label="Cart Order Code" value={cartCode} />
            <DetailItem label="Placed" value={new Date(primary.createdAt).toLocaleString()} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Items ({sorted.length})</p>
            {parentGbId && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={async () => {
                  try {
                    const res = await apiFetch('/orders/admin/add-link', { method: 'POST', body: JSON.stringify({ type: 'gb-cart', cartOrderCode: cartCode, cartCheckoutId: primary.cartCheckoutId }) });
                    try { await navigator.clipboard.writeText(res.url); toast.success('Add-link copied to clipboard'); }
                    catch { window.prompt('Copy the add-to-order link:', res.url); }
                  } catch (err) { toast.error(err.message); }
                }}
                  style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Send Add-Link to Customer
                </button>
                <button type="button" onClick={() => setShowAddItem(true)}
                  style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--accent)', background: 'var(--accent-light)', color: 'var(--accent)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  + Add Item Directly
                </button>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '18px' }}>
            {sorted.map((item, idx) => {
              const isAddon = !!item.groupBuyId?.parentGroupBuyId;
              const itemConfigs = item.configurations || [];
              const itemKits = item.kits || [];
              const isCancelled = item.status === 'Cancelled';
              const thumbUrl = !isAddon ? item.groupBuyId?.images?.[0]?.url : null;
              return (
                <div key={item._id} style={{ padding: '14px 16px', borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none', opacity: isCancelled ? 0.55 : 1, background: isCancelled ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.02) 8px, rgba(0,0,0,0.02) 16px)' : 'transparent' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: !isAddon ? 'auto 1fr auto auto' : '1fr auto auto', gap: '12px', alignItems: 'center' }}>
                    {!isAddon && (
                      <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--accent-light)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {thumbUrl
                          ? <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: 'var(--accent)' }}>{item.groupBuyId?.name?.[0]}</span>}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: 3 }}>
                        {isAddon && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '8px', background: 'rgba(120,80,200,0.12)', color: 'rgb(120,80,200)' }}>Add-on</span>
                        )}
                        {item.addedAfterPurchase && (
                          <span className="status-badge status-green" style={{ fontSize: '0.6rem', padding: '2px 7px' }}>Added</span>
                        )}
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, textDecoration: isCancelled ? 'line-through' : 'none' }}>{item.groupBuyId?.name || 'Group Buy'}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>× {item.quantity}</span>
                      </div>
                      {item.selectedOption?.value && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                          {item.selectedOption.groupName}: {item.selectedOption.value}
                          {item.selectedOption.price ? ` — ₱${item.selectedOption.price.toLocaleString()}` : ''}
                        </p>
                      )}
                      {itemConfigs.length > 0 && (
                        <p style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginTop: 2 }}>
                          {itemConfigs.map(c => `${c.name}: ${c.selected}`).join(' · ')}
                        </p>
                      )}
                      {itemKits.length > 0 && (
                        <p style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginTop: 2 }}>
                          Kits: {itemKits.map(k => `${k.name} × ${k.quantity}`).join(' · ')}
                        </p>
                      )}
                      <p style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', marginTop: 4 }}>{item.orderCode}</p>
                    </div>
                    <select value={item.status} onChange={e => updateItemStatus(item._id, e.target.value)}
                      disabled={updatingId === item._id}
                      className={`status-select status-${statusPaletteKey(item.status)}`}
                      style={{ fontSize: '0.74rem' }}>
                      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', textDecoration: isCancelled ? 'line-through' : 'none' }}>₱{item.totalPrice?.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cancelledTotal > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
                    <span>Original total</span>
                    <span style={{ textDecoration: 'line-through' }}>₱{originalTotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
                    <span>Cancelled</span>
                    <span>−₱{cancelledTotal.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.95rem', borderTop: cancelledTotal > 0 ? '1px solid var(--border-subtle)' : 'none', paddingTop: cancelledTotal > 0 ? 6 : 0 }}>
                <span>Subtotal</span>
                <span>₱{activeTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {showAddItem && parentGbId && (
            <AddItemToOrder
              parentGbId={parentGbId}
              cartOrderCode={cartCode}
              cartCheckoutId={primary.cartCheckoutId}
              shippingAddress={ship}
              userId={typeof u === 'object' ? u._id : u}
              onClose={() => setShowAddItem(false)}
              onAdded={() => { setShowAddItem(false); fetchOrders?.(); }}
            />
          )}

          <div style={{ marginBottom: '14px' }}>
            <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>Shipping Address</p>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
              {ship.fullName || ship.street || ship.city ? (
                <>
                  <p style={{ fontSize: '0.88rem', fontWeight: 500 }}>{ship.fullName || '—'}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>{ship.phone || '—'}</p>
                  <p style={{ fontSize: '0.84rem', marginTop: 6, lineHeight: 1.5 }}>
                    {ship.street || '—'}<br />
                    {[ship.city, ship.province, ship.zipCode].filter(Boolean).join(', ') || '—'}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>No address recorded</p>
              )}
            </div>
          </div>

          {sorted.some(i => i.notes?.trim()) && (
            <div>
              <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>Notes</p>
              {sorted.filter(i => i.notes?.trim()).map(i => (
                <div key={i._id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.84rem', color: 'var(--ink-muted)', marginBottom: 6 }}>
                  <strong style={{ color: 'var(--ink)' }}>{i.groupBuyId?.name}:</strong> {i.notes}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <style>{`
        .gb-order-header:hover { background: var(--bg-secondary) !important; }
        @media (max-width: 820px) {
          .gb-order-header { grid-template-columns: auto 1fr !important; row-gap: 8px !important; }
        }
      `}</style>
    </div>
  );
}

function AddItemToOrder({ parentGbId, cartOrderCode, cartCheckoutId, shippingAddress, userId, onClose, onAdded }) {
  const [familyGbs, setFamilyGbs] = useState([]); // parent + addons
  const [loading, setLoading] = useState(true);
  const [selectedGbId, setSelectedGbId] = useState('');
  const [selectedOption, setSelectedOption] = useState(null); // {groupId, valueId, groupName, value, price}
  const [configs, setConfigs] = useState({}); // {configName: value}
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch(`/group-buys/${parentGbId}`),
      apiFetch(`/group-buys/active?includeAddOns=true`).catch(() => []),
    ]).then(([parent, all]) => {
      const family = [parent, ...(Array.isArray(all) ? all : []).filter(g => g.parentGroupBuyId === parentGbId || g.parentGroupBuyId?._id === parentGbId)];
      // de-dupe
      const seen = new Set();
      const unique = family.filter(g => { if (seen.has(g._id)) return false; seen.add(g._id); return true; });
      setFamilyGbs(unique);
      if (unique[0]) setSelectedGbId(unique[0]._id);
    }).finally(() => setLoading(false));
  }, [parentGbId]);

  const selectedGb = familyGbs.find(g => g._id === selectedGbId);

  // Reset option/configs when GB changes
  useEffect(() => {
    if (!selectedGb) return;
    if (selectedGb.options?.length > 0) {
      const grp = selectedGb.options[0];
      const val = grp.values?.find(v => v.available !== false);
      if (val) setSelectedOption({ groupId: grp._id, groupName: grp.name, valueId: val._id, value: val.value, price: val.price });
      else setSelectedOption(null);
    } else { setSelectedOption(null); }
    const initial = {};
    (selectedGb.configurations || []).forEach(c => {
      const first = c.options?.find(o => o.available !== false);
      if (first) initial[c.name] = first.value;
    });
    setConfigs(initial);
  }, [selectedGbId, selectedGb]);

  const submit = async () => {
    if (!selectedGb || submitting) return;
    if ((selectedGb.options?.length > 0) && !selectedOption) { toast.error('Pick an option'); return; }
    setSubmitting(true);
    try {
      const configurations = Object.entries(configs).map(([name, selected]) => ({ name, selected }));
      await apiFetch('/group-buys/orders/add-to-cart-order', {
        method: 'POST',
        body: JSON.stringify({
          groupBuyId: selectedGbId,
          userId,
          cartOrderCode, cartCheckoutId,
          shippingAddress,
          quantity: Math.max(1, Number(quantity) || 1),
          configurations,
          ...(selectedOption ? { optionGroupId: selectedOption.groupId, optionValueId: selectedOption.valueId } : {})
        })
      });
      toast.success('Item added to order');
      onAdded?.();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ padding: 16, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <div style={{ background: 'var(--surface)', border: '2px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: 18, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: '0.84rem', fontWeight: 600 }}>Add Item to {cartOrderCode}</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>

      <div className="form-group">
        <label className="form-label">Group Buy</label>
        <select className="form-input" value={selectedGbId} onChange={e => setSelectedGbId(e.target.value)}>
          {familyGbs.map(g => <option key={g._id} value={g._id}>{g.parentGroupBuyId ? '↳ ' : ''}{g.name}</option>)}
        </select>
      </div>

      {selectedGb?.options?.length > 0 && (
        <div className="form-group">
          <label className="form-label">Option</label>
          <select className="form-input" value={selectedOption?.valueId || ''} onChange={e => {
            for (const grp of (selectedGb.options || [])) {
              const val = grp.values?.find(v => v._id === e.target.value);
              if (val) { setSelectedOption({ groupId: grp._id, groupName: grp.name, valueId: val._id, value: val.value, price: val.price }); break; }
            }
          }}>
            {(selectedGb.options || []).flatMap(grp => (grp.values || []).filter(v => v.available !== false).map(v => (
              <option key={v._id} value={v._id}>{grp.name}: {v.value} — ₱{v.price?.toLocaleString()}</option>
            )))}
          </select>
        </div>
      )}

      {(selectedGb?.configurations || []).map(cfg => (
        <div key={cfg.name} className="form-group">
          <label className="form-label">{cfg.name}</label>
          <select className="form-input" value={configs[cfg.name] || ''} onChange={e => setConfigs(c => ({ ...c, [cfg.name]: e.target.value }))}>
            {(cfg.options || []).filter(o => o.available !== false).map(o => (
              <option key={o.value} value={o.value}>{o.value}{o.priceModifier > 0 ? ` (+₱${o.priceModifier})` : ''}</option>
            ))}
          </select>
        </div>
      ))}

      <div className="form-group">
        <label className="form-label">Quantity</label>
        <input type="number" min="1" className="form-input" value={quantity} onChange={e => setQuantity(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={submitting} className="btn-dark" style={{ padding: '8px 18px', fontSize: '0.82rem' }}>
          <span>{submitting ? 'Adding…' : 'Add to Order'}</span>
        </button>
        <button onClick={onClose} className="btn-outline" style={{ padding: '8px 18px', fontSize: '0.82rem' }}>Cancel</button>
      </div>
    </div>
  );
}

function DetailItem({ label, value, mono }) {
  return (
    <div>
      <p style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '0.84rem', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value || '—'}</p>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   CREATE GROUP BUY MODAL
═══════════════════════════════════════════════ */
function CreateGBModal({ gbs, forcedParentId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', basePrice: '', moq: '', maxOrders: '', category: 'keyboards', startDate: '', endDate: '', status: 'interest-check', parentGroupBuyId: forcedParentId || '' });
  const eligibleParents = (gbs || []).filter(g => g.isActive && !g.parentGroupBuyId);
  const forcedParent = forcedParentId ? eligibleParents.find(g => g._id === forcedParentId) : null;
  const [optionGroups, setOptionGroups] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [newOptGroup, setNewOptGroup] = useState({ name: '' });
  const [newOptValues, setNewOptValues] = useState({});
  const [newCfgGroup, setNewCfgGroup] = useState({ name: '' });
  const [newCfgOpts, setNewCfgOpts] = useState({});
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [urlInputCreate, setUrlInputCreate] = useState('');
  const [urlPreviews, setUrlPreviews] = useState([]);
  const [sub, setSub] = useState(false);
  const [descPreview, setDescPreview] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

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
      ...grp, values: [...grp.values, { value: nv.value.trim(), price: Number(nv.price) || 0, available: true, image: { url: nv.imageUrl?.trim() || '', altText: nv.value.trim() } }]
    }));
    setNewOptValues(v => ({ ...v, [gi]: { value: '', price: '', imageUrl: '' } }));
  };

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
      ...cfg, options: [...cfg.options, { value: inp.value.trim(), available: true, priceModifier: Number(inp.priceModifier) || 0, image: { url: inp.imageUrl?.trim() || '', altText: inp.value.trim() } }]
    }));
    setNewCfgOpts(v => ({ ...v, [ci]: { value: '', priceModifier: 0, imageUrl: '' } }));
  };

  const submit = async (e) => {
    e.preventDefault(); setSub(true);
    try {
      const created = await apiFetch('/group-buys/create', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, description: form.description,
          basePrice: Number(form.basePrice) || 0,
          moq: Number(form.moq) || 0, maxOrders: Number(form.maxOrders) || 0,
          category: form.category, status: form.status,
          startDate: form.startDate || null, endDate: form.endDate || null,
          options: optionGroups, configurations: configs,
          parentGroupBuyId: form.parentGroupBuyId || null,
        })
      });
      if (images.length > 0) {
        const fd = new FormData();
        images.forEach(f => fd.append('images', f));
        await apiFetch(`/group-buys/${created._id}/images`, { method: 'POST', body: fd });
      }
      for (const up of urlPreviews) {
        await apiFetch(`/group-buys/${created._id}/images/add-url`, {
          method: 'POST', body: JSON.stringify({ url: up.url }),
        });
      }
      toast.success('Created'); onCreated();
    } catch (err) { toast.error(err.message); } finally { setSub(false); }
  };

  const inputSm = { fontSize: '0.78rem', padding: '7px 9px' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-body" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">New Group Buy</h2>
        <p className="modal-subtitle">Create a new group buy or interest check.</p>

        <form onSubmit={submit}>
          <div className="form-group"><label className="form-label">Name</label><input className="form-input" required value={form.name} onChange={set('name')} placeholder="e.g. GMK Rorschach" /></div>

          {/* Rich text description */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Description</label>
              <button type="button" onClick={() => setDescPreview(p => !p)} style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {descPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {descPreview ? (
              <div style={{ minHeight: 72, padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.9rem', lineHeight: 1.75 }}>
                {form.description ? <RichText content={form.description} /> : <span style={{ color: 'var(--ink-faint)' }}>No description yet.</span>}
              </div>
            ) : (
              <>
                <textarea className="form-input" value={form.description} onChange={set('description')}
                  style={{ minHeight: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  placeholder="Describe the group buy...&#10;&#10;Use **bold**, *italic*, # Heading, or - bullet points for formatting." />
                <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: '3px' }}>
                  Markdown: **bold** · *italic* · # Heading · - bullet · blank line = new paragraph
                </p>
              </>
            )}
          </div>

          <div className="modal-row-3">
            <div className="form-group"><label className="form-label">Base Price (₱)</label><input type="number" className="form-input" required min="0" value={form.basePrice} onChange={set('basePrice')} placeholder="Used if no options" /></div>
            <div className="form-group"><label className="form-label">MOQ</label><input type="number" className="form-input" value={form.moq} onChange={set('moq')} placeholder="0" /></div>
            <div className="form-group"><label className="form-label">Max Orders</label><input type="number" className="form-input" value={form.maxOrders} onChange={set('maxOrders')} placeholder="0 = unlimited" /></div>
          </div>
          <div className="modal-row-4">
            <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={form.category} onChange={set('category')} /></div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={set('status')}>
                <option value="interest-check">Interest Check</option>
                <option value="open">Open</option>
                <option value="closing-soon">Closing Soon</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-input" value={form.startDate} onChange={set('startDate')} /></div>
            <div className="form-group"><label className="form-label">End Date</label><input type="date" className="form-input" value={form.endDate} onChange={set('endDate')} /></div>
          </div>

          {forcedParent ? (
            <div className="form-group">
              <label className="form-label">Parent Group Buy</label>
              <input className="form-input" value={forcedParent.name} disabled />
              <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: 4 }}>This add-on will be tied to {forcedParent.name}.</p>
            </div>
          ) : eligibleParents.length > 0 && (
            <div className="form-group">
              <label className="form-label">Parent Group Buy (make this an add-on)</label>
              <select className="form-input" value={form.parentGroupBuyId} onChange={set('parentGroupBuyId')}>
                <option value="">— None (standalone) —</option>
                {eligibleParents.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          )}

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

          {/* Add Options */}
          <div className="modal-section">
            <p className="modal-section-title">Add Options</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Options set the base price (e.g., Kit → Base Kit ₱7,300 / Novelties ₱2,000).
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
                  <input className="form-input" style={inputSm} placeholder="Value (e.g. Base Kit)" value={newOptValues[gi]?.value || ''} onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), value: e.target.value } }))} />
                  <input type="number" className="form-input" style={inputSm} placeholder="₱" value={newOptValues[gi]?.price || ''} onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), price: e.target.value } }))} />
                  <input className="form-input" style={inputSm} placeholder="Image URL (optional)" value={newOptValues[gi]?.imageUrl || ''} onChange={e => setNewOptValues(v => ({ ...v, [gi]: { ...(v[gi] || {}), imageUrl: e.target.value } }))} />
                  <button type="button" onClick={() => addOptValue(gi)} className="config-add-btn">+</button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="form-input" style={inputSm} placeholder="Option group name (e.g. Kit)" value={newOptGroup.name} onChange={e => setNewOptGroup({ name: e.target.value })} />
              <button type="button" onClick={addOptGroup} className="config-add-btn">+ Add Group</button>
            </div>
          </div>

          {/* Add Configs */}
          <div className="modal-section">
            <p className="modal-section-title">Add Configs</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '12px' }}>
              Configs add to the base/option price (e.g., Plate → Brass +₱200). Add unlimited groups.
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
                  <input className="form-input" style={inputSm} placeholder="Option value" value={newCfgOpts[ci]?.value || ''} onChange={e => setNewCfgOpts(v => ({ ...v, [ci]: { ...(v[ci] || {}), value: e.target.value } }))} />
                  <input type="number" className="form-input" style={inputSm} placeholder="+₱" value={newCfgOpts[ci]?.priceModifier || ''} onChange={e => setNewCfgOpts(v => ({ ...v, [ci]: { ...(v[ci] || {}), priceModifier: e.target.value } }))} />
                  <input className="form-input" style={inputSm} placeholder="Image URL (optional)" value={newCfgOpts[ci]?.imageUrl || ''} onChange={e => setNewCfgOpts(v => ({ ...v, [ci]: { ...(v[ci] || {}), imageUrl: e.target.value } }))} />
                  <button type="button" onClick={() => addCfgOpt(ci)} className="config-add-btn">+</button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="form-input" style={inputSm} placeholder="Config group name (e.g. Layout)" value={newCfgGroup.name} onChange={e => setNewCfgGroup({ name: e.target.value })} />
              <button type="button" onClick={addCfgGroup} className="config-add-btn">+ Add Config</button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-dark" disabled={sub} style={{ flex: 1, justifyContent: 'center' }}><span>{sub ? 'Creating...' : 'Create Group Buy'}</span></button>
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
