// Frontend mirror of EcommerceAPI/utils/variantResolution.js
// Handles both plain objects and Mongoose Map shapes (legacy/admin payloads can
// arrive as Maps even though /toJSON should flatten them).

export function getAttr(attrs, key) {
    if (!attrs) return undefined;
    if (typeof attrs.get === 'function') return attrs.get(key);
    return attrs[key];
}

function attrEntries(attrs) {
    if (!attrs) return [];
    if (typeof attrs.entries === 'function' && typeof attrs.get === 'function') return [...attrs.entries()];
    return Object.entries(attrs);
}

function hasStock(v) {
    if (v.available === false) return false;
    if (v.stock === 0) return false;
    return true;
}

export function resolveImages(product, selectedAttrs) {
    const attrs = selectedAttrs || {};
    const candidates = (product.variantImages || []).filter(img => {
        return attrEntries(img.appliesTo).every(([k, v]) => attrs[k] === v);
    });
    return candidates.sort((a, b) =>
        attrEntries(b.appliesTo).length - attrEntries(a.appliesTo).length
    );
}

export function findVariant(product, selectedAttrs) {
    const dims = (product.variantDimensions || []).map(d => d.name);
    const sel = selectedAttrs || {};
    return (product.variants || []).find(v =>
        dims.every(d => getAttr(v.attributes, d) === sel[d])
    );
}

// Returns the set of values for `dimensionName` such that AT LEAST ONE in-stock
// variant exists matching the constraints in `selectedAttrs` (other dims). The
// dimension's own value is wildcarded — so "is there any in-stock variant whose
// Color=Red regardless of Layout/Weight?" answers whether Red should show.
export function allowedValuesFor(product, dimensionName, selectedAttrs) {
    const sel = selectedAttrs || {};
    const allowed = new Set();
    for (const v of (product.variants || [])) {
        if (!hasStock(v)) continue;
        const compatible = Object.entries(sel).every(([k, val]) =>
            k === dimensionName || !val || getAttr(v.attributes, k) === val
        );
        if (compatible) {
            const myVal = getAttr(v.attributes, dimensionName);
            if (myVal) allowed.add(myVal);
        }
    }
    return allowed;
}
