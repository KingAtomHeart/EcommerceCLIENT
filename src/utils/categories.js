import { useEffect, useState } from 'react';
import { apiFetch } from './api';

/* useCategories — shared fetcher for /b1/categories.
   Hardcoded fallback survives an offline backend so the strip + dropdowns
   still render something instead of going blank. The fallback is the same
   list that used to live as the `CATEGORIES` constant in Home.js. */

const FALLBACK = [
  { name: 'Keyboards',          slug: 'keyboards',         sortOrder: 1, image: { url: '', altText: '' }, description: '', pinnedProductIds: [], pinnedGroupBuyIds: [], hasRecord: false },
  { name: 'Keycaps',            slug: 'keycaps',           sortOrder: 2, image: { url: '', altText: '' }, description: '', pinnedProductIds: [], pinnedGroupBuyIds: [], hasRecord: false },
  { name: 'Switches',           slug: 'switches',          sortOrder: 3, image: { url: '', altText: '' }, description: '', pinnedProductIds: [], pinnedGroupBuyIds: [], hasRecord: false },
  { name: 'Desk Accessories',   slug: 'desk-accessories',  sortOrder: 4, image: { url: '', altText: '' }, description: '', pinnedProductIds: [], pinnedGroupBuyIds: [], hasRecord: false },
  { name: 'Tools & Accessories',slug: 'tools-accessories', sortOrder: 5, image: { url: '', altText: '' }, description: '', pinnedProductIds: [], pinnedGroupBuyIds: [], hasRecord: false },
];

// Module-level cache so multiple components sharing a render tree only fetch
// once. Refetches happen explicitly via the `refresh` returned by the hook.
let cached = null;
let inflight = null;

async function fetchCategories() {
  if (inflight) return inflight;
  inflight = apiFetch('/categories')
    .then(data => {
      if (Array.isArray(data)) cached = data;
      else cached = FALLBACK;
      return cached;
    })
    .catch(() => { cached = FALLBACK; return cached; })
    .finally(() => { inflight = null; });
  return inflight;
}

export function useCategories() {
  const [list, setList] = useState(cached);
  const [loading, setLoading] = useState(cached == null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchCategories();
      if (!cancelled) {
        setList(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => {
    cached = null;
    setLoading(true);
    const data = await fetchCategories();
    setList(data);
    setLoading(false);
    return data;
  };

  return { categories: list || [], loading, refresh };
}

// Lower-level helper for code that needs categories outside React (rare).
export function getCachedCategories() {
  return cached || FALLBACK;
}

// Convert a free-form category string to the slug format used in URLs and
// the Category model. Stays in sync with the server-side normalisation.
export function categorySlug(input) {
  return String(input || '').trim().toLowerCase().replace(/\s+/g, '-');
}

// Human-friendly label for a slug. Used by ProductCard / page chrome.
export function categoryLabel(slug, categoriesList = cached) {
  const s = categorySlug(slug);
  const found = (categoriesList || FALLBACK).find(c => c.slug === s);
  if (found) return found.name;
  return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
