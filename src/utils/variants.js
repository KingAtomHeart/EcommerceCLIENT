// Frontend mirror of EcommerceAPI/utils/variantResolution.js
// Works with plain objects (no Mongoose Maps).

export function resolveImages(product, selectedAttrs) {
    const attrs = selectedAttrs || {};
    const candidates = (product.variantImages || []).filter(img => {
        const at = img.appliesTo || {};
        return Object.entries(at).every(([k, v]) => attrs[k] === v);
    });
    return candidates.sort((a, b) =>
        Object.keys(b.appliesTo || {}).length - Object.keys(a.appliesTo || {}).length
    );
}

export function findVariant(product, selectedAttrs) {
    const dims = (product.variantDimensions || []).map(d => d.name);
    const sel = selectedAttrs || {};
    return (product.variants || []).find(v => {
        const attrs = v.attributes || {};
        return dims.every(d => attrs[d] === sel[d]);
    });
}

export function allowedValuesFor(product, dimensionName, selectedAttrs) {
    const sel = selectedAttrs || {};
    const allowed = new Set();
    for (const v of (product.variants || [])) {
        if (v.available === false) continue;
        if (v.stock === 0) continue;
        const attrs = v.attributes || {};
        const compatible = Object.entries(sel).every(([k, val]) =>
            k === dimensionName || !val || attrs[k] === val
        );
        if (compatible && attrs[dimensionName]) allowed.add(attrs[dimensionName]);
    }
    return allowed;
}
