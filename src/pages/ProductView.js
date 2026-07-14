import { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import UserContext from '../context/UserContext';
import AddToOrderContext from '../context/AddToOrderContext';
import ProductCard from '../components/ProductCard';
import GroupBuyCard from '../components/GroupBuyCard';
import { RichText } from '../components/AdminView';
import { LandingPageRenderer } from '../components/LandingPage';
import { renderCustomPageTokens } from '../utils/customPage';
import { apiFetch } from '../utils/api';
import { allowedValuesForTarget } from '../utils/availabilityRules';
import { resolveImages, findVariant, allowedValuesFor, getAttr, getDimValues, sumValueModifiers } from '../utils/variants';
import { useCurrency } from '../context/CurrencyContext';
import toast from 'react-hot-toast';

const categoryLabel = (slug) => ({
  keyboards: 'Keyboards', keycaps: 'Keycaps', switches: 'Switches',
  'desk-accessories': 'Desk Accessories', 'tools-accessories': 'Tools & Acc.'
}[slug] || slug || 'Products');

export default function ProductView() {
  const { productId } = useParams();
  const { format, formatDelta } = useCurrency();
  const { user } = useContext(UserContext);
  const { token: addToOrderToken, info: addToOrderInfo } = useContext(AddToOrderContext);
  const navigate = useNavigate();

  // Customers locked to a GB add-link can't browse in-stock — bounce back to their GB.
  useEffect(() => {
    if (addToOrderInfo?.type === 'gb-cart' && addToOrderInfo.rootGroupBuyId) {
      toast.error('This add-link is locked to your group buy.');
      navigate(`/group-buys/${addToOrderInfo.rootGroupBuyId}`, { replace: true });
    }
  }, [addToOrderInfo, navigate]);
  const [product, setProduct] = useState(null);
  // Two card lists with mixed product / group-buy items. Each entry is
  // { kind: 'product' | 'gb', item: ... } so the render can pick the right card.
  const [addOns, setAddOns] = useState([]);
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
  // Variant system: { [dimensionName]: value }
  const [selectedAttrs, setSelectedAttrs] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setMainImg(0); setQuantity(1); setSelectedOption(null); setSelectedConfigs({}); setSelectedAttrs({});

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

        // Initial auto-select: pick the single variant with the highest stock and use its attrs.
        if (data.useVariants && data.variantDimensions?.length > 0) {
          const stockVal = v => (v.stock === -1 ? Infinity : (v.stock ?? 0));
          const best = (data.variants || [])
            .filter(v => v.available !== false && stockVal(v) > 0)
            .sort((a, b) => stockVal(b) - stockVal(a))[0];
          const variantInitial = {};
          if (best) {
            for (const dim of data.variantDimensions) {
              const bv = getAttr(best.attributes, dim.name);
              if (bv) variantInitial[dim.name] = bv;
            }
          } else {
            // No in-stock variant; fall back to first allowed per cascade so UI still shows something.
            for (const dim of data.variantDimensions) {
              const allowed = allowedValuesFor(data, dim.name, variantInitial);
              const first = [...allowed][0];
              if (first) variantInitial[dim.name] = first;
            }
          }
          setSelectedAttrs(variantInitial);
        }

        try {
          // Fetch products (incl. add-ons so child lookup works) + group buys
          // in parallel — addons / related can mix both via pinnedAddOnIds /
          // pinnedRelatedIds. Each card-list entry carries its kind so the
          // renderer can dispatch to ProductCard vs GroupBuyCard.
          const [allProducts, allGbs] = await Promise.all([
            apiFetch('/products/active?includeAddOns=true').then(r => Array.isArray(r) ? r : []),
            apiFetch('/group-buys/active').then(r => Array.isArray(r) ? r : []).catch(() => []),
          ]);
          if (cancelled) return;

          // Resolver: pinned id list → ordered [{ kind, item }]. Unknown ids
          // are skipped so a deleted reference doesn't crash the page.
          const resolvePinned = (ids) => (ids || []).map(id => {
            const p = allProducts.find(x => x._id === id);
            if (p) return { kind: 'product', item: p };
            const g = allGbs.find(x => x._id === id);
            if (g) return { kind: 'gb', item: g };
            return null;
          }).filter(Boolean);

          // Add-ons: pinned list wins; otherwise auto-show children that point
          // back at this product via parentProductId.
          let addOnList;
          if (Array.isArray(data.pinnedAddOnIds) && data.pinnedAddOnIds.length > 0) {
            addOnList = resolvePinned(data.pinnedAddOnIds);
          } else {
            addOnList = allProducts
              .filter(p => String(p.parentProductId) === String(data._id))
              .map(item => ({ kind: 'product', item }));
          }
          setAddOns(addOnList);

          // Related: pinned wins; otherwise same-category siblings (top-level
          // products only, exclude self + addons of self).
          let relatedList;
          if (Array.isArray(data.pinnedRelatedIds) && data.pinnedRelatedIds.length > 0) {
            relatedList = resolvePinned(data.pinnedRelatedIds);
          } else {
            relatedList = allProducts
              .filter(p =>
                p.category === data.category &&
                p._id !== data._id &&
                !p.parentProductId
              )
              .slice(0, 4)
              .map(item => ({ kind: 'product', item }));
          }
          setRelated(relatedList);
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
        const { restricted, allowed } = allowedValuesForTarget(
          product.configAvailabilityRules, cfg.name, prev
        );
        if (restricted && prev[cfg.name] && !allowed.has(prev[cfg.name])) {
          const firstAllowed = cfg.options?.find(
            o => o.available !== false && (o.stocks ?? -1) !== 0 && allowed.has(o.value)
          );
          next[cfg.name] = firstAllowed?.value || '';
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedConfigs, product]);



  // Build effective image list, narrowed to what's relevant to the current
  // selection so the thumbnail strip doesn't sprawl across many rows when a
  // product has 6+ colorways × 4 weights × angle shots.
  //
  // For variant products: include the selected variant's own image, every
  // variantImages entry whose `appliesTo` is compatible with selectedAttrs
  // (resolveImages already handles "Any" wildcards via empty appliesTo), and
  // the generic product gallery. Other variants' images stay out of the
  // strip — the variant picker pills above handle switching between them.
  //
  // For non-variant products with options/configurations: keep all option /
  // config / gallery images (the per-option pills are the only way to see
  // them).
  //
  // For products without any tagged variantImages: fall back to showing
  // everything (so a product that only has a flat gallery still works).
  const effectiveImages = useMemo(() => {
    if (!product) return [];
    const out = [];
    const seen = new Set();
    const push = (url, altText, id) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({ url, altText: altText || '', _id: id });
    };

    if (product.useVariants) {
      const taggedVariantImages = (product.variantImages || []).length > 0;
      if (taggedVariantImages) {
        // Selection-aware: only the matching variant + its tagged shots + gallery.
        const sel = findVariant(product, selectedAttrs);
        if (sel?.image?.url) push(sel.image.url, sel.image.altText, `vimg-${sel._id || 'sel'}`);
        resolveImages(product, selectedAttrs).forEach((vi, i) =>
          push(vi.url, vi.altText, `vi-${vi._id || i}`)
        );
      } else {
        // No tagging — keep legacy behaviour so older products don't lose images.
        (product.variants || []).forEach((v, i) => {
          if (v?.image?.url) push(v.image.url, v.image.altText, `vimg-${v._id || i}`);
        });
      }
    } else {
      (product.options || []).forEach((grp, gi) => {
        (grp.values || []).forEach((val, vi) => {
          if (val?.image?.url) push(val.image.url, val.image.altText || val.value, `opt-${val._id || `${gi}-${vi}`}`);
        });
      });
      (product.configurations || []).forEach((cfg, ci) => {
        (cfg.options || []).forEach((opt, oi) => {
          if (opt?.image?.url) push(opt.image.url, opt.image.altText || opt.value, `cfg-${opt._id || `${ci}-${oi}`}`);
        });
      });
    }
    (product.images || []).forEach((img, i) => push(img.url, img.altText, img._id || `g-${i}`));
    return out;
  }, [product, selectedAttrs]);

  // Sync mainImg to the currently selected option/config/variant's image when
  // that selection changes. The gallery itself stays stable.
  useEffect(() => {
    if (!product || effectiveImages.length === 0) return;
    let targetUrl = null;
    if (product.useVariants) {
      const sel = findVariant(product, selectedAttrs);
      targetUrl = sel?.image?.url || null;
      if (!targetUrl) targetUrl = resolveImages(product, selectedAttrs)[0]?.url || null;
    } else {
      if (selectedOption?.valueId) {
        for (const grp of (product.options || [])) {
          const val = grp.values?.find(v => v._id === selectedOption.valueId);
          if (val?.image?.url) { targetUrl = val.image.url; break; }
        }
      }
      if (!targetUrl) {
        for (const cfg of (product.configurations || [])) {
          const val = selectedConfigs[cfg.name];
          if (!val) continue;
          const opt = cfg.options?.find(o => o.value === val);
          if (opt?.image?.url) targetUrl = opt.image.url;
        }
      }
    }
    if (!targetUrl) return;
    const idx = effectiveImages.findIndex(im => im.url === targetUrl);
    if (idx >= 0) setMainImg(idx);
  }, [product, selectedAttrs, selectedOption, selectedConfigs, effectiveImages]);

  // Safeguard — when the filtered effectiveImages shrinks (variant switch
  // hid some shots), the previously-selected index may now be out of range.
  // Snap back to 0 instead of rendering a blank canvas.
  useEffect(() => {
    if (mainImg >= effectiveImages.length && effectiveImages.length > 0) {
      setMainImg(0);
    }
  }, [effectiveImages.length, mainImg]);

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

  // Swipe-to-navigate (mobile). Tracks the starting touch; commits a horizontal
  // swipe only if dx > 40px AND dominantly horizontal. The `swiped` flag blocks
  // the lightbox-open click that fires alongside touchend on some browsers.
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
  const onCanvasClick = () => {
    if (swipeState.current.swiped) { swipeState.current.swiped = false; return; }
    if (displayedImage) setLightboxOpen(true);
  };

  const displayedImage = effectiveImages[mainImg]?.url || effectiveImages[0]?.url;

  const addToCart = async () => {
    if (!user) { navigate('/login'); return; }

    // Variant-based add to cart
    if (product.useVariants) {
      const variant = findVariant(product, selectedAttrs);
      if (!variant) {
        const allSelected = (product.variantDimensions || []).every(d => selectedAttrs[d.name]);
        toast.error(allSelected ? 'This combination is not available.' : 'Please select all options.');
        return;
      }
      if (variant.stock === 0 || variant.available === false) {
        toast.error('This variant is out of stock.'); return;
      }
      setAddingToCart(true);
      try {
        await apiFetch('/cart/add-to-cart', { method: 'POST', body: JSON.stringify({ productId: product._id, quantity, variantId: variant._id, ...(addToOrderToken ? { addToOrderToken } : {}) }) });
        toast.success('Added to cart!');
      } catch (err) { toast.error(err.message || 'Failed to add to cart'); }
      finally { setAddingToCart(false); }
      return;
    }

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
        ...(addToOrderToken ? { addToOrderToken } : {}),
      };
      await apiFetch('/cart/add-to-cart', { method: 'POST', body: JSON.stringify(body) });
      toast.success(`${product.name} added to cart`);
    } catch (err) { toast.error(err.message); }
    finally { setAddingToCart(false); }
  };

  if (loading) return <div className="page-body loading-center"><div className="spinner" /></div>;
  if (!product) return <div className="page-body loading-center"><p>Product not found.</p></div>;

  // Determine stock status: option stock + config stock + config availability rules
  // Variant stock status
  const currentVariant = product?.useVariants ? findVariant(product, selectedAttrs) : null;

  const computeStockStatus = () => {
    // Variant path
    if (product?.useVariants) {
      if (!currentVariant) return { soldOut: true, max: 0 };
      if (currentVariant.available === false || currentVariant.stock === 0) return { soldOut: true, max: 0 };
      return { soldOut: false, max: currentVariant.stock >= 0 ? currentVariant.stock : 99 };
    }
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
        const { restricted, allowed } = allowedValuesForTarget(
          product.configAvailabilityRules, cfg.name, selectedConfigs
        );
        if (restricted && !allowed.has(selected)) {
          soldOut = true;
          reason = `rule blocks ${cfg.name}=${selected}`;
          break;
        }
      }
    }

    if (soldOut) console.warn('SOLD OUT because:', reason, { hasOptions, selectedOption, selectedConfigs, productStocks: product.stocks });
    return { soldOut, max };
  };

  const { soldOut: outOfStock, max: maxQty } = computeStockStatus();

  // Calculate displayed price: product.price is the base, option/variant/config prices add on top.
  // Variant pricing now flows from each selected DIMENSION VALUE's priceModifier
  // (so e.g. Silver weight contributes +₱3,300 once, not echoed across every
  // pill). The legacy per-variant `price` field is treated as an additional
  // override modifier on top — useful for one-off "Limited Edition" combos
  // without rewriting the per-value modifiers.
  const computeDisplayPrice = () => {
    let total = product.price || 0;
    if (hasOptions && selectedOption) total += (selectedOption.price || 0);
    if (product.useVariants) {
      total += sumValueModifiers(product, selectedAttrs);
      if (currentVariant?.price != null && currentVariant.price !== '') {
        total += Number(currentVariant.price) || 0;
      }
    }

    // Add config price modifiers
    for (const cfg of (product.configurations || [])) {
      const selected = selectedConfigs[cfg.name];
      if (!selected) continue;
      const opt = cfg.options?.find(o => o.value === selected);
      if (opt?.priceModifier) total += Number(opt.priceModifier) || 0;
    }

    return total;
  };

  const displayPrice = computeDisplayPrice();
  const priceDisplay = (hasOptions && !selectedOption)
    ? `From ${format((product.price || 0) + Math.min(...product.options.flatMap(g => g.values.map(v => v.price || 0))))}`
    : format(displayPrice);

  return (
    <>
      <div className="page-body pv-page" style={{ padding: '44px var(--page-pad) 80px' }}>
        {/* Breadcrumb */}
        <div className="pv-breadcrumb" style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: '40px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/products" style={{ color: 'var(--ink-muted)' }}>Shop</Link>
          <span style={{ opacity: 0.35 }}>›</span>
          <Link to={`/products?cat=${product.category}`} style={{ color: 'var(--ink-muted)' }}>{categoryLabel(product.category)}</Link>
          <span style={{ opacity: 0.35 }}>›</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{product.name}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'start' }} className="product-layout">

          {/* ── Images (sticky on desktop so the gallery stays in view while
                  the customer scrolls the info column on the right) ── */}
          <div
            className="product-image-col"
            style={{ position: 'sticky', top: 'calc(var(--nav-h) + 16px)', alignSelf: 'start' }}
          >
            <div
              style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: '20px', overflow: 'hidden', background: 'var(--accent-light)', marginBottom: '14px', position: 'relative', cursor: displayedImage ? 'zoom-in' : 'default', touchAction: 'pan-y' }}
              onClick={onCanvasClick}
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
                  <img src={displayedImage} alt={product.name}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.3s ease' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
                </>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', serif", fontSize: '3rem', color: 'var(--accent)' }}>{product.name?.[0]}</div>
              )}
              {displayedImage && (
                <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.38)', color: '#fff', fontSize: '0.62rem', padding: '3px 8px', borderRadius: '10px', pointerEvents: 'none' }}>Click to expand</span>
              )}
            </div>
            {effectiveImages.length > 1 && (
              // Single-row horizontal carousel. Previously wrapped onto 3+ rows
              // for products with many colorway shots. Snap + edge fade hint
              // at scrollability without showing a fat scrollbar.
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
                      cursor: 'pointer', flexShrink: 0, padding: 0, background: 'none',
                      scrollSnapAlign: 'start',
                    }}>
                      <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
                {/* Right edge fade — hints there's more to scroll. Only shows
                    when the row actually overflows (≥ 7 thumbs at 72+10 px). */}
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

            {/* ── VARIANT DIMENSIONS ── */}
            {product.useVariants && (product.variantDimensions || []).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                {product.variantDimensions.map((dim, dimIdx) => {
                  // Priority cascade: dim N's availability depends only on dims 1..N-1.
                  // The first dim always shows every in-stock value.
                  const priorAttrs = {};
                  for (let i = 0; i < dimIdx; i++) {
                    const n = product.variantDimensions[i].name;
                    if (selectedAttrs[n]) priorAttrs[n] = selectedAttrs[n];
                  }
                  const dimAllowed = allowedValuesFor(product, dim.name, priorAttrs);
                  const dimValues = getDimValues(dim);
                  return (
                    <div key={dim._id || dim.name} style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '8px' }}>{dim.name}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {dimValues.map(({ value: val, priceModifier }, vi) => {
                          const avail = dimAllowed.has(val);
                          const isSelected = selectedAttrs[dim.name] === val;
                          // Pills now show their OWN value's modifier instead of the
                          // selected variant's full price delta — so the +₱3,300 on
                          // Silver only appears on the Silver pill, not echoed across
                          // every other dimension's pills.
                          const valDelta = formatDelta(priceModifier);
                          return (
                            <button key={vi}
                              className={`pill ${isSelected ? 'active' : ''}`}
                              onClick={() => {
                                // Set this dim; snap LATER dims to the highest-stock variant that
                                // matches dims 1..dimIdx. Never touches earlier dims.
                                const next = { ...selectedAttrs, [dim.name]: val };
                                const fixed = product.variantDimensions.slice(0, dimIdx + 1).map(d => d.name);
                                const stockVal = v => (v.stock === -1 ? Infinity : (v.stock ?? 0));
                                const best = (product.variants || [])
                                  .filter(v => v.available !== false && stockVal(v) > 0 && fixed.every(n => getAttr(v.attributes, n) === next[n]))
                                  .sort((a, b) => stockVal(b) - stockVal(a))[0];
                                if (best) {
                                  for (let j = dimIdx + 1; j < product.variantDimensions.length; j++) {
                                    const lname = product.variantDimensions[j].name;
                                    const bv = getAttr(best.attributes, lname);
                                    if (bv) next[lname] = bv;
                                  }
                                }
                                setSelectedAttrs(next);
                                setQuantity(1); setMainImg(0);
                              }}
                              style={!avail ? { textDecoration: 'line-through', opacity: 0.4 } : {}}>
                              {val}
                              {valDelta && (
                                <span style={{ fontSize: '0.72rem', opacity: 0.7, marginLeft: '4px' }}>
                                  {valDelta}
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

            {/* ── OPTIONS (price-setting selectors) ── */}
            {!product.useVariants && hasOptions && (
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
                            {formatDelta(val.price) && (
                              <span style={{ fontSize: '0.72rem', opacity: 0.7, marginLeft: '4px' }}>
                                {formatDelta(val.price)}
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
            {!product.useVariants && product.configurations?.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                {product.configurations.map(cfg => {
                  // Apply availability rules: filter options based on other selected configs
                  const { restricted, allowed } = allowedValuesForTarget(
                    product.configAvailabilityRules, cfg.name, selectedConfigs
                  );

                  return (
                    <div key={cfg._id || cfg.name} style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '8px' }}>{cfg.name}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(cfg.options || []).map((opt, oi) => {
                          const cfgStocks = opt.stocks ?? -1;
                          const ruleBlocked = restricted && !allowed.has(opt.value);
                          const avail = opt.available !== false && cfgStocks !== 0 && !ruleBlocked;
                          const isSelected = selectedConfigs[cfg.name] === opt.value;
                          return (
                            <button key={oi}
                              className={`pill ${isSelected ? 'active' : ''}`}
                              onClick={() => { if (!avail) return; setSelectedConfigs(c => ({ ...c, [cfg.name]: opt.value })); setQuantity(1); setMainImg(0); }}
                              disabled={!avail}
                              style={!avail ? { textDecoration: 'line-through', opacity: 0.4 } : {}}>
                              {opt.value}
                              {formatDelta(opt.priceModifier) && (
                                <span style={{ fontSize: '0.72rem', opacity: 0.7, marginLeft: '4px' }}>
                                  {formatDelta(opt.priceModifier)}
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

      {/* Marketing surface below the buy section.
          customPageHtml takes precedence — when an admin pastes raw markup,
          the block-based landing page is hidden so the two don't fight for
          the same vertical space. Trusted-admin input; rendered as-is. */}
      {product.customPageHtml && product.customPageHtml.trim()
        ? (
          <div
            style={{ borderTop: '1px solid var(--border)' }}
            dangerouslySetInnerHTML={{ __html: renderCustomPageTokens(product.customPageHtml, product) }}
          />
        )
        : Array.isArray(product.landingPage) && product.landingPage.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <LandingPageRenderer blocks={product.landingPage} />
          </div>
        )
      }

      {/* Add-ons — pinned-or-auto. Each entry carries its kind so we can mix
          products and group buys in the same grid using the matching card. */}
      {addOns.length > 0 && (
        <section className="pv-addons-section" style={{ padding: '56px var(--page-pad) 8px', borderTop: '1px solid var(--border)' }}>
          <div className="section-header">
            <h2 className="section-title">Add-ons</h2>
          </div>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.92rem', marginBottom: '28px' }}>
            Optional extras paired with {product.name}.
          </p>
          <div className="pv-addons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            {addOns.map(({ kind, item }) => kind === 'gb'
              ? <GroupBuyCard key={`gb-${item._id}`} gb={item} />
              : <ProductCard key={`p-${item._id}`} product={item} />
            )}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="pv-related-section" style={{ padding: '64px var(--page-pad) 80px', borderTop: '1px solid var(--border)' }}>
          <div className="section-header">
            <h2 className="section-title">You might also like</h2>
            <Link to="/products" className="section-link">View all →</Link>
          </div>
          <div className="pv-related-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            {related.map(({ kind, item }) => kind === 'gb'
              ? <GroupBuyCard key={`gb-${item._id}`} gb={item} />
              : <ProductCard key={`p-${item._id}`} product={item} />
            )}
          </div>
        </section>
      )}

      <style>{`
        @media (max-width: 960px) {
          .product-layout { grid-template-columns: 1fr !important; gap: 32px !important; }
          /* Stacked layout — sticky has no headroom and would pin the image
             at the top while the user is reading the info underneath. */
          .product-image-col { position: static !important; }
        }
        @media (max-width: 640px) {
          /* Tighten the page chrome on phones — the desktop 44/80px padding
             eats too much vertical space before the buy section. */
          .pv-page { padding: 24px var(--page-pad) 56px !important; }
          .pv-breadcrumb { margin-bottom: 20px !important; font-size: 0.78rem !important; }
          .product-layout { gap: 24px !important; }
          /* Cross-sell card grids should stack instead of forcing 240px
             columns that overflow on narrow phones. */
          .pv-addons-grid, .pv-related-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .pv-addons-section { padding: 40px var(--page-pad) 0 !important; }
          .pv-related-section { padding: 40px var(--page-pad) 56px !important; }
        }
      `}</style>

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
