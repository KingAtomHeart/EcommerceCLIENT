import { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { RichText } from '../components/AdminView';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

const statusLabel = {
  'interest-check': 'Interest Check', 'open': 'Open', 'closing-soon': 'Closing Soon',
  'closed': 'Closed', 'production': 'In Production', 'completed': 'Completed',
};

export default function GroupBuyView() {
  const { id } = useParams();
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [gb, setGb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImg, setMainImg] = useState(0);

  // Selected option: { groupId, groupName, valueId, value, price }
  const [selectedOption, setSelectedOption] = useState(null);
  // Selected configs: { [configName]: optionValue }
  const [configs, setConfigs] = useState({});

  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    apiFetch(`/group-buys/${id}`)
      .then(data => {
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
      })
      .catch(() => toast.error('Group buy not found'))
      .finally(() => setLoading(false));
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

  // Compute total price including config modifiers
  const computedPrice = useMemo(() => {
    let base = 0;
    if (hasOptions && selectedOption) {
      base = selectedOption.price;
    } else if (gb) {
      base = gb.basePrice || 0;
    }
    // Add configuration modifiers
    if (gb?.configurations?.length > 0) {
      for (const cfg of gb.configurations) {
        const selectedVal = configs[cfg.name];
        if (!selectedVal) continue;
        const opt = cfg.options?.find(o => o.value === selectedVal);
        if (opt?.priceModifier > 0) base += opt.priceModifier;
      }
    }
    return base;
  }, [gb, hasOptions, selectedOption, configs]);

  // Build effective image list: option/config image prepended, gallery follows
  const effectiveImages = useMemo(() => {
    if (!gb) return [];
    let overrideUrl = null;
    for (const cfg of (gb.configurations || [])) {
      const val = configs[cfg.name];
      if (!val) continue;
      const opt = cfg.options?.find(o => o.value === val);
      if (opt?.image?.url) overrideUrl = opt.image.url;
    }
    if (selectedOption?.valueId && hasOptions) {
      for (const grp of (gb.options || [])) {
        const val = grp.values?.find(v => v._id === selectedOption.valueId);
        if (val?.image?.url) { overrideUrl = val.image.url; break; }
      }
    }
    const gallery = gb.images || [];
    if (!overrideUrl) return gallery;
    const withoutDupe = gallery.filter(img => img.url !== overrideUrl);
    return [{ url: overrideUrl, altText: '', _id: 'override' }, ...withoutDupe];
  }, [gb, configs, selectedOption, hasOptions]);

  const addToCart = async () => {
    if (!user) { navigate('/login'); return; }
    if (hasOptions && !selectedOption) {
      toast.error('Please select an option');
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
        }),
      });
      toast.success('Added to cart!');
      navigate('/cart');
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
      : `From ₱${Math.min(...gb.options.flatMap(g => g.values.map(v => v.price))).toLocaleString()}`
    : `₱${computedPrice.toLocaleString()}`;

  return (
    <div className="page-body" style={{ padding: '44px var(--page-pad) 80px' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: '40px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Link to="/group-buys" style={{ color: 'var(--ink-muted)' }}>Group Buys</Link>
        <span style={{ opacity: 0.35 }}>›</span>
        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{gb.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'start' }} className="product-layout">

        {/* ── Images ── */}
        <div>
          <div
            style={{ width: '100%', aspectRatio: '4/3', borderRadius: '20px', overflow: 'hidden', background: 'var(--accent-light)', marginBottom: '14px', position: 'relative', cursor: displayedImage ? 'zoom-in' : 'default' }}
            onClick={() => displayedImage && setLightboxOpen(true)}
          >
            {displayedImage ? (
              <img src={displayedImage} alt={gb.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', serif", fontSize: '3rem', color: 'var(--accent)' }}>{gb.name?.[0]}</div>
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
                  cursor: 'pointer', padding: 0, background: 'none', flexShrink: 0,
                }}><img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></button>
              ))}
            </div>
          )}
        </div>

        {/* ── Details ── */}
        <div>
          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: '20px',
              background: isOpen ? 'var(--accent-light)' : isIC ? '#fef3cd' : '#f8d7da',
              color: isOpen ? 'var(--accent)' : isIC ? '#856404' : '#721c24',
            }}>{statusLabel[gb.status]}</span>
            {gb.orderCount > 0 && <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>{gb.orderCount} joined</span>}
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
          {gb.moq > 0 && (
            <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', marginBottom: '20px' }}>
              MOQ: {gb.moq} {gb.orderCount >= gb.moq ? '(reached)' : `(${gb.moq - gb.orderCount} more needed)`}
            </p>
          )}

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
