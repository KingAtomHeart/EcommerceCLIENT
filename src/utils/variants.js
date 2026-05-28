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

// Dimension values used to be bare strings (["Red", "Blue"]) and now carry a
// price modifier ([{ value: "Red", priceModifier: 0 }, ...]). Normalise either
// shape to the object form so the rest of the UI can read .value /
// .priceModifier without conditionals scattered everywhere.
export function getDimValues(dim) {
    if (!dim || !Array.isArray(dim.values)) return [];
    return dim.values.map(v => {
        if (typeof v === 'string') return { value: v, priceModifier: 0 };
        if (v && typeof v === 'object') {
            return { value: String(v.value ?? ''), priceModifier: Number(v.priceModifier) || 0 };
        }
        return null;
    }).filter(v => v && v.value);
}

// Look up the priceModifier for a specific value on a specific dimension.
// Returns 0 for unknown values so the price calc can always sum without nulls.
export function getValueModifier(dim, value) {
    if (!dim || value == null) return 0;
    const found = getDimValues(dim).find(v => v.value === value);
    return found ? found.priceModifier : 0;
}

// Sum the price modifiers contributed by the current selection across every
// dimension. Used by the customer page to show base + variant additions.
export function sumValueModifiers(product, selectedAttrs) {
    const sel = selectedAttrs || {};
    let total = 0;
    for (const dim of (product?.variantDimensions || [])) {
        const v = sel[dim.name];
        if (!v) continue;
        total += getValueModifier(dim, v);
    }
    return total;
}
