import { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import AddToOrderContext from '../context/AddToOrderContext';
import { RichText } from '../components/AdminView';
import { LandingPageRenderer } from '../components/LandingPage';
import { renderCustomPageTokens } from '../utils/customPage';
import GroupBuyCard from '../components/GroupBuyCard';
import ProductCard from '../components/ProductCard';
import { apiFetch } from '../utils/api';
import { priceDelta } from '../utils/priceFormat';
import toast from 'react-hot-toast';

const statusLabel = {
  'interest-check': 'Interest Check', 'open': 'Open', 'closing-soon': 'Closing Soon',
  'closed': 'Closed', 'production': 'In Production', 'completed': 'Completed',
};

export default function GroupBuyView() {
  const { id } = useParams();
  const { user } = useContext(UserContext);
  const { token: addToOrderToken, info: addToOrderInfo } = useContext(AddToOrderContext);
  const navigate = useNavigate();
  const [gb, setGb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImg, setMainImg] = useState(0);
  // Mixed product/GB lists for the addons + related sections, each entry is
  // { kind: 'product' | 'gb', item: ... }.
  const [pinnedAddOnList, setPinnedAddOnList] = useState(null); // null = not loaded / use gb.addOns
  const [relatedList, setRelatedList] = useState([]);

  // Selected option: { groupId, groupName, valueId, value, price }
  const [selectedOption, setSelectedOption] = useState(null);
  // Selected configs: { [configName]: optionValue }
  const [configs, setConfigs] = useState({});

  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch(`/group-buys/${id}`);
        if (cancelled) return;
        setGb(data);

        // Auto-select first available option value
        if (data.options?.length > 0) {
          const firstGroup = data.options[0];
          const firstVal = firstGroup?.values?.find(v => v.available !== false);
          if (firstVal) {
            setSelectedOption({
              groupId: firstGroup._id,
              groupName: firstGroup.name,
              valueId: firstVal._id,
              value: firstVal.value,
              price: firstVal.price,
            });
          }
        }

        // Auto-select first available config option
        const initial = {};
        (data.configurations || []).forEach(c => {
          const first = c.options?.find(o => o.available !== false);
          if (first) initial[c.name] = first.value;
        });
        setConfigs(initial);

        // Cross-sell. Skip the catalog fetch entirely when no pinning is set
        // AND no related auto-derive is needed — but the page benefits from
        // showing related GBs regardless, so always fetch and decide here.
        try {
          const [allProducts, allGbs] = await Promise.all([
            apiFetch('/products/active?includeAddOns=true').then(r => Array.isArray(r) ? r : []).catch(() => []),
            apiFetch('/group-buys/active?includeAddOns=true').then(r => Array.isArray(r) ? r : []),
          ]);
          if (cancelled) return;

          const resolvePinned = (ids) => (ids || []).map(rawId => {
            const sid = String(rawId);
            const p = allProducts.find(x => String(x._id) === sid);
            if (p) return { kind: 'product', item: p };
            const g = allGbs.find(x => String(x._id) === sid);
            if (g) return { kind: 'gb', item: g };
            return null;
          }).filter(Boolean);

          // Pinned add-ons override the server-populated gb.addOns. When no
          // pins are set we leave pinnedAddOnList=null so the JSX falls back
          // to rendering gb.addOns (preserves current behavior).
          if (Array.isArray(data.pinnedAddOnIds) && data.pinnedAddOnIds.length > 0) {
            setPinnedAddOnList(resolvePinned(data.pinnedAddOnIds));
          }

          // Related: pinned wins, otherwise same-category siblings (skip self
          // + any GB that is an add-on of something else).
          let rel;
          if (Array.isArray(data.pinnedRelatedIds) && data.pinnedRelatedIds.length > 0) {
            rel = resolvePinned(data.pinnedRelatedIds);
          } else {
            rel = allGbs
              .filter(g =>
                g.category === data.category &&
                String(g._id) !== String(data._id) &&
                !g.parentGroupBuyId
              )
              .slice(0, 4)
              .map(item => ({ kind: 'gb', item }));
          }
          setRelatedList(rel);
        } catch { /* silent */ }
      } catch {
        if (!cancelled) toast.error('Group buy not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const hasOptions = (gb?.options?.length || 0) > 0;

  // Re-validate configs when selected option changes (availability rules)
  useEffect(() => {
    if (!gb || !selectedOption?.valueId || !gb.availabilityRules?.length) return;
    setConfigs(prev => {
      const updated = { ...prev };
      for (const cfg of (gb.configurations || [])) {
        const rule = gb.availabilityRules.find(
          r => r.optionValueId === selectedOption.valueId && r.configName === cfg.name
        );
        if (rule && updated[cfg.name] && !rule.availableValues.includes(updated[cfg.name])) {
          const firstAvail = cfg.options?.find(o =>
            o.available !== false && rule.availableValues.includes(o.value)
          );
          updated[cfg.name] = firstAvail?.value || '';
        }
      }
      return updated;
    });
  }, [selectedOption?.valueId, gb]);

  // Compute total price: basePrice is the foundation; options + config
  // modifiers add on top.
  const computedPrice = useMemo(() => {
    let base = gb?.basePrice || 0;
    if (hasOptions && selectedOption) {
      base += (selectedOption.price || 0);
    }
    if (gb?.configurations?.length > 0) {
      for (const cfg of gb.configurations) {
        const selectedVal = configs[cfg.name];
        if (!selectedVal) continue;
        const opt = cfg.options?.find(o => o.value === selectedVal);
        if (opt?.priceModifier) base += Number(opt.priceModifier) || 0;
      }
    }
    return base;
  }, [gb, hasOptions, selectedOption, configs]);

  // Build effective image list — stable across selections. Every per-option
  // and per-config image is included once, alongside the gallery. Selecting
  // an option/config jumps mainImg to that image (see effect below).
  const effectiveImages = useMemo(() => {
    if (!gb) return [];
    const out = [];
    const seen = new Set();
    const push = (url, altText, id) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({ url, altText: altText || '', _id: id });
    };
    (gb.options || []).forEach((grp, gi) => {
      (grp.values || []).forEach((val, vi) => {
        if (val?.image?.url) push(val.image.url, val.image.altText || val.value, `opt-${val._id || `${gi}-${vi}`}`);
      });
    });
    (gb.configurations || []).forEach((cfg, ci) => {
      (cfg.options || []).forEach((opt, oi) => {
        if (opt?.image?.url) push(opt.image.url, opt.image.altText || opt.value, `cfg-${opt._id || `${ci}-${oi}`}`);
      });
    });
    (gb.images || []).forEach((img, i) => push(img.url, img.altText, img._id || `g-${i}`));
    return out;
  }, [gb]);

  // Sync mainImg to the selected option/config's image when selection changes.
  useEffect(() => {
    if (!gb || effectiveImages.length === 0) return;
    let targetUrl = null;
    if (selectedOption?.valueId) {
      for (const grp of (gb.options || [])) {
        const val = grp.values?.find(v => v._id === selectedOption.valueId);
        if (val?.image?.url) { targetUrl = val.image.url; break; }
      }
    }
    if (!targetUrl) {
      for (const cfg of (gb.configurations || [])) {
        const val = configs[cfg.name];
        if (!val) continue;
        const opt = cfg.options?.find(o => o.value === val);
        if (opt?.image?.url) targetUrl = opt.image.url;
      }
    }
    if (!targetUrl) return;
    const idx = effectiveImages.findIndex(im => im.url === targetUrl);
    if (idx >= 0) setMainImg(idx);
  }, [gb, selectedOption, configs, effectiveImages]);

  // Arrow-key navigation (PC). Ignore when focus is in an editable field.
  useEffect(() => {
    if (effectiveImages.length < 2) return;
    const onKey = (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setMainImg(i => Math.min(effectiveImages.length - 1, i + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setMainImg(i => Math.max(0, i - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [effectiveImages.length]);

  // Swipe-to-navigate (mobile). Threshold 40px horizontal, must be dominantly
  // horizontal. `swiped` flag prevents the lightbox-open click that fires on touchend.
  const swipeState = useRef({ x: 0, y: 0, swiped: false });
  const onCanvasTouchStart = (e) => {
    const t = e.touches[0];
    swipeState.current = { x: t.clientX, y: t.clientY, swiped: false };
  };
  const onCanvasTouchEnd = (e) => {
    if (effectiveImages.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeState.current.x;
    const dy = t.clientY - swipeState.current.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      swipeState.current.swiped = true;
      if (dx < 0) setMainImg(i => Math.min(effectiveImages.length - 1, i + 1));
      else setMainImg(i => Math.max(0, i - 1));
    }
  };

  // If a GB add-link is active and the customer wandered to a different group buy
  // (different fulfillment timeline), bounce them back to the locked GB.
  const lockedFamily = addToOrderInfo?.type === 'gb-cart' && Array.isArray(addToOrderInfo.allowedGroupBuyIds)
    ? addToOrderInfo.allowedGroupBuyIds : null;
  const isLockedToFamily = !!lockedFamily;
  const isAllowedHere = !isLockedToFamily || lockedFamily.includes(id);

  useEffect(() => {
    if (isLockedToFamily && !isAllowedHere && addToOrderInfo?.rootGroupBuyId) {
      toast.error('This add-link is locked to your original group buy.');
      navigate(`/group-buys/${addToOrderInfo.rootGroupBuyId}`, { replace: true });
    }
  }, [isLockedToFamily, isAllowedHere, addToOrderInfo, navigate]);

  const addToCart = async () => {
    if (!user) { navigate('/login'); return; }
    if (hasOptions && !selectedOption) {
      toast.error('Please select an option');
      return;
    }
    if (isLockedToFamily && !isAllowedHere) {
      toast.error('You can only add items from your original group buy or its add-ons.');
      return;
    }
    setSubmitting(true);
    try {
      const configArray = Object.entries(configs).map(([name, selected]) => ({ name, selected }));
      await apiFetch('/cart/add-group-buy-to-cart', {
        method: 'POST',
        body: JSON.stringify({
          groupBuyId: id,
          quantity,
          configurations: configArray,
          ...(selectedOption ? {
            optionGroupId: selectedOption.groupId,
            optionValueId: selectedOption.valueId,
          } : {}),
          ...(addToOrderToken ? { addToOrderToken } : {}),
        }),
      });
      toast.success('Added to cart!');
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const registerInterest = async () => {
    if (!user) { navigate('/login'); return; }
    setSubmitting(true);
    try {
      const configArray = Object.entries(configs).map(([name, selected]) => ({ name, selected }));
      await apiFetch(`/group-buys/${id}/interest`, {
        method: 'POST',
        body: JSON.stringify({
          configurations: configArray,
          selectedOption: selectedOption
            ? { groupName: selectedOption.groupName, value: selectedOption.value }
            : undefined,
          note,
        }),
      });
      toast.success('Interest registered!');
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="page-body loading-center"><div className="spinner" /></div>;
  if (!gb) return <div className="page-body loading-center"><p>Group buy not found.</p></div>;

  const isOpen = gb.status === 'open' || gb.status === 'closing-soon';
  const isIC = gb.status === 'interest-check';
  const endDate = gb.endDate ? new Date(gb.endDate) : null;
  const displayedImage = effectiveImages[mainImg]?.url || effectiveImages[0]?.url;

  const basePriceDisplay = hasOptions
    ? selectedOption
      ? `₱${computedPrice.toLocaleString()}`
      : `From ₱${((gb.basePrice || 0) + Math.min(...gb.options.flatMap(g => g.values.map(v => v.price || 0)))).toLocaleString()}`
    : `₱${computedPrice.toLocaleString()}`;

  return (
    <div className="page-body gb-page" style={{ padding: '44px var(--page-pad) 80px' }}>
      {/* Breadcrumb */}
      <div className="gb-breadcrumb" style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: '40px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link to="/group-buys" style={{ color: 'var(--ink-muted)' }}>Group Buys</Link>
        <span style={{ opacity: 0.35 }}>›</span>
        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{gb.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'start' }} className="product-layout">

        {/* ── Images (sticky on desktop — keeps gallery in view while the
                info column scrolls). Matches ProductView. ── */}
        <div
          className="product-image-col"
          style={{ position: 'sticky', top: 'calc(var(--nav-h) + 16px)', alignSelf: 'start' }}
        >
          <div
            style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: '20px', overflow: 'hidden', background: 'var(--accent-light)', marginBottom: '14px', position: 'relative', cursor: displayedImage ? 'zoom-in' : 'default', touchAction: 'pan-y' }}
            onClick={() => {
              if (swipeState.current.swiped) { swipeState.current.swiped = false; return; }
              if (displayedImage) setLightboxOpen(true);
            }}
            onTouchStart={onCanvasTouchStart}
            onTouchEnd={onCanvasTouchEnd}
          >
            {displayedImage ? (
              <>
                {/* Blurred copy of the active image — fills any aspect-ratio gap
                    with the photo's own colors instead of a flat bar. */}
                <img
                  src={displayedImage}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    filter: 'blur(40px) saturate(1.1)',
                    transform: 'scale(1.25)',
                    opacity: 0.75,
                    pointerEvents: 'none',
                  }}
                />
                <img src={displayedImage} alt={gb.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.3s ease' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', serif", fontSize: '3rem', color: 'var(--accent)' }}>{gb.name?.[0]}</div>
            )}
            {displayedImage && (
              <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.38)', color: '#fff', fontSize: '0.62rem', padding: '3px 8px', borderRadius: '10px', pointerEvents: 'none' }}>Click to expand</span>
            )}
          </div>
          {effectiveImages.length > 1 && (
            // Single-row horizontal carousel (matches ProductView). Replaces
            // the previous wrap-onto-3-rows layout that sprawled with many
            // colorway shots.
            <div style={{ position: 'relative' }}>
              <div
                className="pv-thumb-strip"
                style={{
                  display: 'flex', gap: '10px',
                  overflowX: 'auto', overflowY: 'hidden',
                  scrollSnapType: 'x mandatory',
                  paddingBottom: '4px',
                  scrollbarWidth: 'thin',
                }}>
                {effectiveImages.map((img, i) => (
                  <button key={img._id || i} onClick={() => setMainImg(i)} style={{
                    width: 72, height: 72, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                    border: i === mainImg ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer', padding: 0, background: 'none', flexShrink: 0,
                    scrollSnapAlign: 'start',
                  }}><img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></button>
                ))}
              </div>
              {effectiveImages.length > 6 && (
                <div aria-hidden="true" style={{
                  position: 'absolute', top: 0, right: 0, bottom: 4, width: 40,
                  background: 'linear-gradient(to right, transparent, var(--bg))',
                  pointerEvents: 'none',
                }} />
              )}
              <style>{`.pv-thumb-strip::-webkit-scrollbar{height:6px}.pv-thumb-strip::-webkit-scrollbar-thumb{background:var(--border);border-radius:6px}`}</style>
            </div>
          )}
        </div>

        {/* ── Details ── */}
        <div>
          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: '20px',
              background: isOpen ? 'var(--accent-light)' : isIC ? '#fef3cd' : '#f8d7da',
              color: isOpen ? 'var(--accent)' : isIC ? '#856404' : '#721c24',
            }}>{statusLabel[gb.status]}</span>
            {gb.orderCount > 0 && <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>{gb.orderCount} joined</span>}
            {gb.parent && (
              <Link to={`/group-buys/${gb.parent._id}`} style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ← Part of <strong style={{ color: 'var(--ink)' }}>{gb.parent.name}</strong>
              </Link>
            )}
          </div>

          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: '18px' }}>{gb.name}</h1>

          {/* Price */}
          <p style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '22px' }}>{basePriceDisplay}</p>

          {/* Rich text description */}
          <div style={{ fontSize: '0.95rem', color: 'var(--ink-muted)', lineHeight: 1.75, marginBottom: '28px' }}>
            <RichText content={gb.description} />
          </div>

          {endDate && isOpen && (
            <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', marginBottom: '16px' }}>
              Closes {endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {/* Auto-rule: hide MOQ progress on add-ons (parented GBs) by default
              since they piggyback on a parent's MOQ. Admin can flip
              `showMoqProgress` to true/false to override either way. */}
          {(() => {
            const isAddOn = !!(gb.parentGroupBuyId || gb.parent?._id);
            const auto = !isAddOn;
            const show = typeof gb.showMoqProgress === 'boolean' ? gb.showMoqProgress : auto;
            if (!show) return null;
            if (!(gb.moq > 0 || (gb.milestones || []).length > 0)) return null;
            return (
              <MilestoneProgress
                moq={gb.moq || 0}
                orderCount={gb.orderCount || 0}
                milestones={gb.milestones || []}
              />
            );
          })()}

          {/* ── OPTIONS (price-setting selectors) ── */}
          {hasOptions && (isOpen || isIC) && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginBottom: '24px' }}>
              {gb.options.map(grp => (
                <div key={grp._id || grp.name} style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '10px' }}>{grp.name}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(grp.values || []).map((val) => {
                      const avail = val.available !== false && val.stocks !== 0;
                      const isSelected = selectedOption?.valueId === val._id;
                      return (
                        <button
                          key={val._id}
                          disabled={!avail}
                          onClick={() => {
                            if (!avail) return;
                            setSelectedOption({
                              groupId: grp._id,
                              groupName: grp.name,
                              valueId: val._id,
                              value: val.value,
                              price: val.price,
                            });
                            setMainImg(0);
                          }}
                          className={`pill ${isSelected ? 'active' : ''}`}
                          style={!avail ? { textDecoration: 'line-through', opacity: 0.4 } : {}}
                        >
                          {val.value}
                          {priceDelta(val.price) && (
                            <span style={{ fontSize: '0.72rem', opacity: 0.7, marginLeft: '4px' }}>
                              {priceDelta(val.price)}
                            </span>
                          )}
                          {val.stocks >= 0 && val.stocks <= 10 && (
                            <span style={{ fontSize: '0.65rem', color: val.stocks === 0 ? '#dc3545' : '#856404', marginLeft: '6px' }}>
                              {val.stocks === 0 ? 'Sold Out' : `${val.stocks} left`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CONFIGS (add-on selectors) ── */}
          {gb.configurations?.length > 0 && (isOpen || isIC) && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', marginBottom: '18px' }}>Configuration</h3>
              {gb.configurations.map(cfg => (
                <div key={cfg._id || cfg.name} style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '8px' }}>{cfg.name}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(cfg.options || []).map(opt => {
                      let avail = opt.available !== false;
                      if (avail && selectedOption?.valueId && gb.availabilityRules?.length > 0) {
                        const rule = gb.availabilityRules.find(
                          r => r.optionValueId === selectedOption.valueId && r.configName === cfg.name
                        );
                        if (rule) {
                          avail = rule.availableValues.includes(opt.value);
                        }
                      }
                      return (
                        <button key={opt.value}
                          onClick={() => { if (!avail) return; setConfigs(c => ({ ...c, [cfg.name]: opt.value })); setMainImg(0); }}
                          disabled={!avail}
                          className={`pill ${configs[cfg.name] === opt.value ? 'active' : ''}`}
                          style={!avail ? { textDecoration: 'line-through', opacity: 0.4 } : {}}>
                          {opt.value}
                          {priceDelta(opt.priceModifier) && (
                            <span style={{ fontSize: '0.72rem', opacity: 0.7, marginLeft: '4px' }}>
                              {priceDelta(opt.priceModifier)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── JOIN (open GB) ── */}
          {isOpen && user && !user.isAdmin && (
            <>
              {!hasOptions && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Qty</span>
                  <button className="qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>−</button>
                  <span style={{ fontSize: '1rem', fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{quantity}</span>
                  <button className="qty-btn" onClick={() => setQuantity(q => q + 1)}>+</button>
                </div>
              )}
              <button
                onClick={addToCart}
                disabled={submitting || (hasOptions && !selectedOption)}
                className="btn-dark"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>
                  {submitting ? 'Adding to Cart…'
                    : hasOptions && !selectedOption ? 'Select an option'
                    : 'Add to Cart'}
                </span>
              </button>
            </>
          )}

          {/* ── INTEREST CHECK ── */}
          {isIC && user && !user.isAdmin && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <textarea className="form-input" placeholder="Any preferences or questions..."
                  value={note} onChange={e => setNote(e.target.value)}
                  style={{ minHeight: 56, resize: 'vertical' }} />
              </div>
              <button onClick={registerInterest} disabled={submitting} className="btn-dark" style={{ width: '100%', justifyContent: 'center' }}>
                <span>{submitting ? 'Registering…' : 'Register Interest'}</span>
              </button>
            </div>
          )}

          {(isOpen || isIC) && !user && (
            <Link to="/login" className="btn-dark" style={{ width: '100%', justifyContent: 'center' }}>
              <span>Sign In to {isIC ? 'Register Interest' : 'Join'}</span>
            </Link>
          )}

          {!isOpen && !isIC && (
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
              This group buy is no longer accepting orders.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .product-layout { grid-template-columns: 1fr !important; gap: 32px !important; }
          .product-image-col { position: static !important; }
        }
        @media (max-width: 640px) {
          /* Tighten page chrome on phones — the desktop 44/80px padding
             eats too much vertical space and pushes the buy section below
             the fold. */
          .gb-page { padding: 24px var(--page-pad) 56px !important; }
          .gb-breadcrumb { margin-bottom: 20px !important; font-size: 0.78rem !important; }
          .product-layout { gap: 24px !important; }
          /* Make the cross-sell card grids actually fit instead of forcing
             280px columns that overflow on narrow phones. */
          .gb-related-grid, .gb-addons-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .gb-related-section, .gb-addons-section { margin-top: 40px !important; }
        }
      `}</style>

      {/* Marketing/landing-page content renders below the grid as a full-page
          sibling. Previously this was moved INSIDE the right column to give
          sticky-image scroll headroom, but landing-page blocks with
          fullBleed=true use negative page-pad margins that broke out of the
          column on mobile. Keeping it full-width restores correct rendering;
          customPageHtml wins over the block-based landingPage when both set. */}
      {gb.customPageHtml && gb.customPageHtml.trim()
        ? <div dangerouslySetInnerHTML={{ __html: renderCustomPageTokens(gb.customPageHtml, gb) }} />
        : Array.isArray(gb.landingPage) && gb.landingPage.length > 0 && (
          <LandingPageRenderer blocks={gb.landingPage} />
        )
      }

      {(() => {
        // Pinned list (when set) replaces the server-populated gb.addOns. The
        // legacy gb.addOns is GroupBuy-only, so wrap each in the same { kind,
        // item } shape so the renderer below stays uniform.
        const list = pinnedAddOnList != null
          ? pinnedAddOnList
          : (gb.addOns || []).map(item => ({ kind: 'gb', item }));
        if (list.length === 0) return null;
        return (
          <div className="gb-addons-section" style={{ marginTop: '64px' }}>
            <h2 className="section-title" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(1.5rem, 2.4vw, 1.9rem)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Add-ons</h2>
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.92rem', marginBottom: '28px' }}>
              Optional extras for this group buy. Only available alongside {gb.name}.
            </p>
            <div className="gb-addons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {list.map(({ kind, item }) => kind === 'product'
                ? <ProductCard key={`p-${item._id}`} product={item} />
                : <GroupBuyCard key={`gb-${item._id}`} gb={item} />
              )}
            </div>
          </div>
        );
      })()}

      {relatedList.length > 0 && (
        <div className="gb-related-section" style={{ marginTop: '64px' }}>
          <h2 className="section-title" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(1.5rem, 2.4vw, 1.9rem)', letterSpacing: '-0.02em', marginBottom: '8px' }}>You might also like</h2>
          <div className="gb-related-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {relatedList.map(({ kind, item }) => kind === 'product'
              ? <ProductCard key={`p-${item._id}`} product={item} />
              : <GroupBuyCard key={`gb-${item._id}`} gb={item} />
            )}
          </div>
        </div>
      )}

      {lightboxOpen && displayedImage && (
        <div onClick={() => setLightboxOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <button onClick={() => setLightboxOpen(false)}
            style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          {effectiveImages.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setMainImg(prev => Math.max(0, prev - 1)); }}
                style={{ position: 'absolute', left: 20, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: '1.6rem', cursor: 'pointer', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setMainImg(prev => Math.min(effectiveImages.length - 1, prev + 1)); }}
                style={{ position: 'absolute', right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: '1.6rem', cursor: 'pointer', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </>
          )}
          <img src={displayedImage} alt={gb?.name} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }} />
          {effectiveImages.length > 1 && (
            <div style={{ position: 'absolute', bottom: 20, display: 'flex', gap: '8px' }}>
              {effectiveImages.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setMainImg(i); }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: i === mainImg ? '#fff' : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Progress bar + clickable milestone markers. Bar auto-scales to
      max(moq, ...milestoneCounts). Hovering a marker highlights it +
      previews the prize inline; clicking opens a full-detail modal. ── */
function MilestoneProgress({ moq, orderCount, milestones }) {
  const [openIdx, setOpenIdx] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const sorted = useMemo(
    () => (milestones || [])
      .filter(m => Number(m.count) > 0)
      .map(m => ({ ...m, count: Number(m.count) }))
      .sort((a, b) => a.count - b.count),
    [milestones]
  );
  const maxMilestone = sorted.length > 0 ? sorted[sorted.length - 1].count : 0;
  const barMax = Math.max(moq || 0, maxMilestone, 1);
  const pct = Math.min(100, (orderCount / barMax) * 100);
  const moqReached = moq > 0 && orderCount >= moq;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          {moq > 0 ? 'MOQ Progress' : 'Progress'}
        </span>
        <span style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
          <strong style={{ color: 'var(--ink)' }}>{orderCount}</strong>
          {moq > 0 && (
            <> / {moq} {moqReached ? '— reached!' : `(${moq - orderCount} to go)`}</>
          )}
          {moq === 0 && sorted.length > 0 && <> orders</>}
        </span>
      </div>

      {/* Bar + markers. Vertical padding makes room for the markers (16px tall)
          centered on the 8px bar — kept tight so the section doesn't dominate.
          `overflow: visible` lets the hover overlay float above the bar without
          getting clipped. */}
      <div style={{ position: 'relative', padding: '10px 0 2px' }}>
        <div style={{ position: 'relative', height: 8, background: 'var(--accent-light)', borderRadius: 999 }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: `${pct}%`,
            background: moqReached
              ? 'linear-gradient(90deg, #2ecc71, #27ae60)'
              : 'var(--accent)',
            borderRadius: 999,
            transition: 'width 0.5s ease',
          }} />
          {/* MOQ tick (vertical line; label sits in the count strip below) */}
          {moq > 0 && moq < barMax && (
            <div style={{
              position: 'absolute', top: -3, bottom: -3,
              left: `${(moq / barMax) * 100}%`, width: 2,
              background: moqReached ? '#27ae60' : 'rgba(0,0,0,0.32)',
              transform: 'translateX(-50%)', zIndex: 1, pointerEvents: 'none',
            }} />
          )}
          {/* Milestone markers */}
          {sorted.map((m, idx) => {
            const reached = orderCount >= m.count;
            const left = Math.min(100, (m.count / barMax) * 100);
            const isHover = hoverIdx === idx;
            return (
              <button
                key={m._id || idx}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                onFocus={() => setHoverIdx(idx)}
                onBlur={() => setHoverIdx(null)}
                onClick={() => setOpenIdx(idx)}
                title={`${m.title} — at ${m.count} orders`}
                aria-label={`${m.title}, unlocks at ${m.count} orders${reached ? ' (unlocked)' : ''}`}
                style={{
                  position: 'absolute', top: '50%', left: `${left}%`,
                  transform: `translate(-50%, -50%) scale(${isHover ? 1.25 : 1})`,
                  width: 18, height: 18, borderRadius: '50%',
                  background: reached ? '#f5c518' : 'var(--surface)',
                  border: `2px solid ${reached ? '#c89c08' : 'var(--accent)'}`,
                  cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', lineHeight: 1,
                  boxShadow: isHover ? '0 4px 12px rgba(0,0,0,0.22)' : '0 1px 3px rgba(0,0,0,0.12)',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  zIndex: isHover ? 4 : 3,
                }}
              >
                <span aria-hidden="true" style={{ filter: reached ? 'none' : 'grayscale(0.4)' }}>🎁</span>
                {/* Floating tooltip — absolutely positioned, doesn't push
                    anything below. pointer-events:none so the cursor can
                    glide across markers without dropping the hover. */}
                {isHover && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--surface)', color: 'var(--ink)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    minWidth: 180, maxWidth: 240,
                    boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
                    pointerEvents: 'none',
                    zIndex: 10, textAlign: 'left',
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {m.image?.url && (
                        <img src={m.image.url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--ink-muted)', lineHeight: 1.2, marginTop: 2 }}>
                          {reached ? `✓ Unlocked at ${m.count}` : `At ${m.count} (${m.count - orderCount} more)`}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--ink-faint)', marginTop: 6 }}>Click for details</div>
                    {/* Down-pointing notch under the tooltip */}
                    <div aria-hidden="true" style={{
                      position: 'absolute', top: '100%', left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0, height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid var(--border)',
                    }} />
                    <div aria-hidden="true" style={{
                      position: 'absolute', top: 'calc(100% - 1px)', left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0, height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: '5px solid var(--surface)',
                    }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Count labels beneath markers (includes MOQ tick label) */}
        {(sorted.length > 0 || (moq > 0 && moq < barMax)) && (
          <div style={{ position: 'relative', height: 14, marginTop: 4 }}>
            {moq > 0 && moq < barMax && (
              <div style={{
                position: 'absolute', top: 0, left: `${(moq / barMax) * 100}%`,
                transform: 'translateX(-50%)',
                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
                color: moqReached ? '#27ae60' : 'var(--ink-muted)',
                whiteSpace: 'nowrap',
              }}>MOQ</div>
            )}
            {sorted.map((m, idx) => {
              const left = Math.min(100, (m.count / barMax) * 100);
              const reached = orderCount >= m.count;
              return (
                <div key={m._id || idx} style={{
                  position: 'absolute', top: 0, left: `${left}%`,
                  transform: 'translateX(-50%)',
                  fontSize: '0.62rem', fontWeight: 600,
                  color: reached ? 'var(--ink)' : 'var(--ink-muted)',
                  whiteSpace: 'nowrap',
                }}>{m.count}</div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover preview now lives in a floating tooltip above the marker
          (rendered inside the marker button). No inline space reserved here
          — the bar stays the same height whether hovered or not. */}

      {openIdx !== null && sorted[openIdx] && (
        <MilestoneModal
          milestone={sorted[openIdx]}
          reached={orderCount >= sorted[openIdx].count}
          orderCount={orderCount}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </div>
  );
}

// Click modal — mirrors the product-page layout (image, title, rich-text
// description, landing-page blocks) minus add-to-cart since this is a reward
// preview, not a sellable item. Stays an overlay (fixed, full-screen scrim).
function MilestoneModal({ milestone, reached, orderCount, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while the overlay is open so the page underneath
    // doesn't drift while the customer scrolls the milestone content.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const customHtml = (milestone.customPageHtml || '').trim();
  const hasBlocks = Array.isArray(milestone.landingPage) && milestone.landingPage.length > 0;
  // customPageHtml wins over landingPage when both exist — same precedence
  // as Product / GB pages so the milestone feels like a mini-product page.

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', overflowY: 'auto', cursor: 'zoom-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)',
        maxWidth: 920, width: '100%', overflow: 'hidden', cursor: 'default',
        boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        position: 'relative',
      }}>
        {/* Sticky close button — stays reachable even after scrolling
            through a long landing page. */}
        <button onClick={onClose} aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 5,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            border: 'none', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>

        {milestone.image?.url && (
          <img src={milestone.image.url} alt={milestone.image?.altText || milestone.title}
            style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: '28px 32px 32px' }}>
          <div style={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: reached ? '#c89c08' : 'var(--ink-faint)', marginBottom: 6,
          }}>
            {reached ? '✓ Unlocked' : `Unlocks at ${milestone.count} orders`}
          </div>
          <h2 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 'clamp(1.6rem, 2.6vw, 2.2rem)', margin: '0 0 14px',
            lineHeight: 1.1, letterSpacing: '-0.02em',
          }}>
            {milestone.title}
          </h2>

          {!reached && (
            <p style={{ fontSize: '0.86rem', color: 'var(--ink-faint)', margin: '0 0 18px' }}>
              {milestone.count - orderCount} more order{milestone.count - orderCount === 1 ? '' : 's'} to unlock.
            </p>
          )}

          {milestone.description && (
            <div style={{ fontSize: '0.96rem', color: 'var(--ink-muted)', lineHeight: 1.7, marginBottom: (customHtml || hasBlocks) ? 28 : 0 }}>
              <RichText content={milestone.description} />
            </div>
          )}
        </div>

        {/* Marketing content — custom HTML wins over block-based landing
            page when both exist. Same precedence as the GB / product page. */}
        {customHtml
          ? <div dangerouslySetInnerHTML={{ __html: renderCustomPageTokens(customHtml, { name: milestone.title, description: milestone.description, images: milestone.image?.url ? [milestone.image] : [] }) }} />
          : hasBlocks && (
            <div style={{ paddingBottom: 24 }}>
              <LandingPageRenderer blocks={milestone.landingPage} />
            </div>
          )
        }
      </div>
    </div>
  );
}
