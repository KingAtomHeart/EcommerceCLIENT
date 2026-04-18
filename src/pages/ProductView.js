import { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import UserContext from '../context/UserContext';
import ProductCard from '../components/ProductCard';
import { RichText } from '../components/AdminView';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

const categoryLabel = (slug) => ({
  keyboards: 'Keyboards', keycaps: 'Keycaps', switches: 'Switches',
  'desk-accessories': 'Desk Accessories', 'tools-accessories': 'Tools & Acc.'
}[slug] || slug || 'Products');

export default function ProductView() {
  const { productId } = useParams();
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [mainImg, setMainImg] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Selected option: { groupId, groupName, valueId, value, price }
  const [selectedOption, setSelectedOption] = useState(null);
  // Selected configs: { [configName]: optionValue }
  const [selectedConfigs, setSelectedConfigs] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setMainImg(0); setQuantity(1); setSelectedOption(null); setSelectedConfigs({});

    const loadProduct = async () => {
      try {
        const data = await apiFetch(`/products/${productId}`);
        if (cancelled) return;
        setProduct(data);

        // Auto-select first available option value (if options exist)
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
        setSelectedConfigs(initial);

        try {
          const all = await apiFetch('/products/active');
          if (!cancelled && Array.isArray(all)) {
            setRelated(all.filter(p => p.category === data.category && p._id !== data._id).slice(0, 4));
          }
        } catch {}
      } catch { if (!cancelled) toast.error('Product not found'); }
      finally { if (!cancelled) setLoading(false); }
    };
    loadProduct();
    return () => { cancelled = true; };
  }, [productId]);

  const hasOptions = (product?.options?.length || 0) > 0;

  // Clear invalid config selections when another config changes (due to availability rules)
  useEffect(() => {
    if (!product?.configAvailabilityRules?.length) return;
    setSelectedConfigs(prev => {
      const next = { ...prev };
      let changed = false;
      for (const cfg of (product.configurations || [])) {
        const allowedValues = new Set();
        let hasRule = false;
        for (const rule of product.configAvailabilityRules) {
          if (rule.targetConfigName === cfg.name && prev[rule.configName] === rule.selectedValue) {
            hasRule = true;
            (rule.availableValues || []).forEach(v => allowedValues.add(v));
          }
        }
        if (hasRule && prev[cfg.name] && !allowedValues.has(prev[cfg.name])) {
          // Current selection is blocked by a rule — pick first allowed
          const firstAllowed = cfg.options?.find(o => o.available !== false && (o.stocks ?? -1) !== 0 && allowedValues.has(o.value));
          next[cfg.name] = firstAllowed?.value || '';
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedConfigs, product]);


  // Build effective image list: option/config image prepended, gallery images follow
  const effectiveImages = useMemo(() => {
    if (!product) return [];
    let overrideUrl = null;
    // 1. Config options (last config with image wins)
    for (const cfg of (product.configurations || [])) {
      const val = selectedConfigs[cfg.name];
      if (!val) continue;
      const opt = cfg.options?.find(o => o.value === val);
      if (opt?.image?.url) overrideUrl = opt.image.url;
    }
    // 2. Selected option value (overrides config)
    if (selectedOption?.valueId && hasOptions) {
      for (const grp of (product.options || [])) {
        const val = grp.values?.find(v => v._id === selectedOption.valueId);
        if (val?.image?.url) { overrideUrl = val.image.url; break; }
      }
    }
    const gallery = product.images || [];
    if (!overrideUrl) return gallery;
    // Deduplicate if override URL already in gallery
    const withoutDupe = gallery.filter(img => img.url !== overrideUrl);
    return [{ url: overrideUrl, altText: '', _id: 'override' }, ...withoutDupe];
  }, [product, selectedConfigs, selectedOption, hasOptions]);

  const displayedImage = effectiveImages[mainImg]?.url || effectiveImages[0]?.url;

  const addToCart = async () => {
    if (!user) { navigate('/login'); return; }

    // Validate option selection
    if (hasOptions && !selectedOption) {
      toast.error('Please select an option');
      return;
    }
    // Validate config selections
    for (const cfg of (product.configurations || [])) {
      if (!selectedConfigs[cfg.name]) {
        toast.error(`Please select a ${cfg.name}`);
        return;
      }
    }

    setAddingToCart(true);
    try {
      const configs = Object.entries(selectedConfigs).map(([name, selected]) => ({ name, selected }));
      const body = {
        productId,
        quantity,
        configurations: configs,
        ...(selectedOption ? {
          optionGroupId: selectedOption.groupId,
          optionValueId: selectedOption.valueId,
        } : {}),
      };
      await apiFetch('/cart/add-to-cart', { method: 'POST', body: JSON.stringify(body) });
      toast.success(`${product.name} added to cart`);
    } catch (err) { toast.error(err.message); }
    finally { setAddingToCart(false); }
  };

  if (loading) return <div className="page-body loading-center"><div className="spinner" /></div>;
  if (!product) return <div className="page-body loading-center"><p>Product not found.</p></div>;

  // Determine stock status: option stock + config stock + config availability rules
  const computeStockStatus = () => {
    let soldOut = false;
    let max = 99;
    let reason = ''; // DEBUG

    // Option-level stock
    if (hasOptions && selectedOption) {
      const selGroup = product.options.find(g => g._id === selectedOption.groupId);
      const selVal = selGroup?.values?.find(v => v._id === selectedOption.valueId);
      const optStocks = selVal?.stocks ?? -1;
      if (optStocks === 0) { soldOut = true; reason = `option "${selVal?.value}" stock=0`; }
      if (optStocks >= 0) max = Math.min(max, optStocks);
    } else if (hasOptions) {
      const anyAvailable = product.options.some(g => g.values?.some(v => v.available !== false && (v.stocks === undefined || v.stocks === -1 || v.stocks > 0)));
      if (!anyAvailable) { soldOut = true; reason = 'no available option values'; }
    } else {
      if (product.stocks !== undefined && product.stocks !== -1 && product.stocks <= 0) { soldOut = true; reason = `product.stocks=${product.stocks}`; }
      if (product.stocks !== undefined && product.stocks >= 0) max = Math.min(max, product.stocks);
    }

    // Config-level stock: check if any selected config option is out of stock
    if (!soldOut) {
      for (const cfg of (product.configurations || [])) {
        const selected = selectedConfigs[cfg.name];
        if (!selected) continue;
        const opt = cfg.options?.find(o => o.value === selected);
        if (opt) {
          const cfgStocks = opt.stocks ?? -1;
          if (cfgStocks === 0 || !opt.available) { soldOut = true; reason = `config "${cfg.name}=${selected}" stock=${cfgStocks} avail=${opt.available}`; break; }
          if (cfgStocks >= 0) max = Math.min(max, cfgStocks);
        }
      }
    }

    // Config availability rules: check if current selection is blocked
    if (!soldOut && product.configAvailabilityRules?.length > 0) {
      for (const cfg of (product.configurations || [])) {
        const selected = selectedConfigs[cfg.name];
        if (!selected) continue;
        for (const rule of product.configAvailabilityRules) {
          const sourceVal = selectedConfigs[rule.configName];
          if (rule.targetConfigName === cfg.name && sourceVal === rule.selectedValue) {
            if (!rule.availableValues.includes(selected)) { soldOut = true; reason = `rule: ${rule.configName}=${sourceVal} blocks ${cfg.name}=${selected}`; break; }
          }
        }
        if (soldOut) break;
      }
    }

    if (soldOut) console.warn('SOLD OUT because:', reason, { hasOptions, selectedOption, selectedConfigs, productStocks: product.stocks });
    return { soldOut, max };
  };

  const { soldOut: outOfStock, max: maxQty } = computeStockStatus();

  // Calculate displayed price: base/option price + config modifiers
  const computeDisplayPrice = () => {
    let base = hasOptions
      ? (selectedOption?.price || 0)
      : (product.price || 0);

    // Add config price modifiers
    for (const cfg of (product.configurations || [])) {
      const selected = selectedConfigs[cfg.name];
      if (!selected) continue;
      const opt = cfg.options?.find(o => o.value === selected);
      if (opt?.priceModifier > 0) base += opt.priceModifier;
    }

    return base;
  };

  const displayPrice = computeDisplayPrice();
  const priceDisplay = (hasOptions && !selectedOption)
    ? `From ₱${Math.min(...product.options.flatMap(g => g.values.map(v => v.price))).toLocaleString()}`
    : `₱${displayPrice.toLocaleString()}`;

  return (
    <>
      <div className="page-body" style={{ padding: '44px var(--page-pad) 80px' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: '40px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/products" style={{ color: 'var(--ink-muted)' }}>Shop</Link>
          <span style={{ opacity: 0.35 }}>›</span>
          <Link to={`/products?cat=${product.category}`} style={{ color: 'var(--ink-muted)' }}>{categoryLabel(product.category)}</Link>
          <span style={{ opacity: 0.35 }}>›</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{product.name}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'start' }} className="product-layout">

          {/* ── Images ── */}
          <div>
            <div
              style={{ width: '100%', aspectRatio: '4/3', borderRadius: '20px', overflow: 'hidden', background: 'var(--accent-light)', marginBottom: '14px', position: 'relative', cursor: displayedImage ? 'zoom-in' : 'default' }}
              onClick={() => displayedImage && setLightboxOpen(true)}
            >
              {displayedImage ? (
                <img src={displayedImage} alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', serif", fontSize: '3rem', color: 'var(--accent)' }}>{product.name?.[0]}</div>
              )}
              {displayedImage && (
                <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.38)', color: '#fff', fontSize: '0.62rem', padding: '3px 8px', borderRadius: '10px', pointerEvents: 'none' }}>Click to expand</span>
              )}
            </div>
            {effectiveImages.length > 1 && (
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                {effectiveImages.map((img, i) => (
                  <button key={img._id || i} onClick={() => setMainImg(i)} style={{
                    width: 76, height: 76, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                    border: i === mainImg ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer', flexShrink: 0, padding: 0, background: 'none',
                  }}>
                    <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '10px' }}>{categoryLabel(product.category)}</p>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: '18px' }}>{product.name}</h1>

            {/* Price display + sold out badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
              <p style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>{priceDisplay}</p>
              {outOfStock && (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', padding: '4px 12px', borderRadius: '20px', background: '#1a1a1a', color: '#fff' }}>Sold out</span>
              )}
            </div>

            {/* Rich text description */}
            <div style={{ fontSize: '0.95rem', color: 'var(--ink-muted)', lineHeight: 1.75, marginBottom: '32px' }}>
              <RichText content={product.description} />
            </div>

            {/* ── OPTIONS (price-setting selectors) ── */}
            {hasOptions && (
              <div style={{ marginBottom: '24px' }}>
                {product.options.map(grp => (
                  <div key={grp._id || grp.name} style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '10px' }}>{grp.name}</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(grp.values || []).map((val) => {
                        const optStocks = val.stocks ?? -1;
                        const avail = val.available !== false && optStocks !== 0;
                        const isSelected = selectedOption?.valueId === val._id;
                        return (
                          <button
                            key={val._id}
                            onClick={() => {
                              if (!avail) return;
                              setSelectedOption({
                                groupId: grp._id,
                                groupName: grp.name,
                                valueId: val._id,
                                value: val.value,
                                price: val.price,
                              });
                              setQuantity(1);
                              setMainImg(0);
                            }}
                            disabled={!avail}
                            className={`pill ${isSelected ? 'active' : ''}`}
                            style={!avail ? { textDecoration: 'line-through', opacity: 0.4 } : {}}
                          >
                            {val.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── CONFIGS (add-on selectors) ── */}
            {product.configurations?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                {product.configurations.map(cfg => {
                  // Apply availability rules: filter options based on other selected configs
                  const allowedValues = new Set();
                  let hasRule = false;
                  for (const rule of (product.configAvailabilityRules || [])) {
                    if (rule.targetConfigName === cfg.name && selectedConfigs[rule.configName] === rule.selectedValue) {
                      hasRule = true;
                      (rule.availableValues || []).forEach(v => allowedValues.add(v));
                    }
                  }

                  return (
                    <div key={cfg._id || cfg.name} style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '8px' }}>{cfg.name}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(cfg.options || []).map((opt, oi) => {
                          const cfgStocks = opt.stocks ?? -1;
                          const ruleBlocked = hasRule && !allowedValues.has(opt.value);
                          const avail = opt.available !== false && cfgStocks !== 0 && !ruleBlocked;
                          const isSelected = selectedConfigs[cfg.name] === opt.value;
                          return (
                            <button key={oi}
                              className={`pill ${isSelected ? 'active' : ''}`}
                              onClick={() => { if (!avail) return; setSelectedConfigs(c => ({ ...c, [cfg.name]: opt.value })); setQuantity(1); setMainImg(0); }}
                              disabled={!avail}
                              style={!avail ? { textDecoration: 'line-through', opacity: 0.4 } : {}}>
                              {opt.value}
                              {opt.priceModifier > 0 && (
                                <span style={{ fontSize: '0.72rem', opacity: 0.7, marginLeft: '4px' }}>
                                  +₱{opt.priceModifier.toLocaleString()}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── ADD TO CART ── */}
            {!user?.isAdmin && (
              <div style={{ marginBottom: '32px' }}>
                {user && !outOfStock && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Quantity</span>
                    <button className="qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>−</button>
                    <span style={{ fontSize: '1rem', fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{quantity}</span>
                    <button className="qty-btn" onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty}>+</button>
                    {!hasOptions && product.stocks <= 10 && product.stocks > 0 && (
                      <span style={{ fontSize: '0.78rem', color: '#c0392b', fontWeight: 500 }}>{product.stocks} left</span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {user ? (
                    <button onClick={addToCart} disabled={outOfStock || addingToCart || (hasOptions && !selectedOption)} className="btn-dark" style={{ flex: 1 }}>
                      <span>
                        {addingToCart ? 'Adding…'
                          : outOfStock ? 'Sold out'
                          : hasOptions && !selectedOption ? 'Select an option'
                          : 'Add to Cart'}
                      </span>
                    </button>
                  ) : (
                    <Link to="/login" className="btn-dark" style={{ flex: 1, justifyContent: 'center' }}><span>Sign In to Purchase</span></Link>
                  )}
                </div>
              </div>
            )}

            {product.specifications && product.specifications.length > 0 && (
              <>
                <div style={{ height: '1px', background: 'var(--border)', marginBottom: '28px' }} />
                <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', marginBottom: '18px' }}>Specifications</h3>
                <table className="specs-table"><tbody>
                  {product.specifications.map((spec, i) => (
                    <SpecRow key={i} label={spec.label} value={spec.value} />
                  ))}
                </tbody></table>
              </>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ padding: '64px var(--page-pad) 80px', borderTop: '1px solid var(--border)' }}>
          <div className="section-header">
            <h2 className="section-title">You might also like</h2>
            <Link to="/products" className="section-link">View all →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            {related.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}

      <style>{`@media (max-width: 960px) { .product-layout { grid-template-columns: 1fr !important; gap: 40px !important; } }`}</style>

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
          <img src={displayedImage} alt={product?.name} onClick={e => e.stopPropagation()}
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
    </>
  );
}

function SpecRow({ label, value }) {
  if (!value) return null;
  return <tr><td className="spec-key">{label}</td><td className="spec-val">{value}</td></tr>;
}
