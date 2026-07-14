// The built-in navbar links an admin is allowed to rename. Custom pages carry
// their own navLabel (edited in the page editor) and aren't listed here.
//
// `key`      — stable id stored in SiteSettings.navLabels; NEVER change these.
// `default`  — the label shown when the admin hasn't set an override.
// `audience` — which nav the link appears in ('customer', 'admin', or 'both').
//              Purely for grouping in the admin editor.
//
// Keep this list in sync with ALLOWED_NAV_KEYS in EcommerceAPI/controllers/siteSettings.js.
export const NAV_ITEMS = [
  { key: 'home', default: 'Home', audience: 'both' },
  { key: 'shop', default: 'Shop', audience: 'customer' },
  { key: 'groupBuys', default: 'Group Buys', audience: 'customer' },
  { key: 'community', default: 'Community', audience: 'customer' },
  { key: 'contact', default: 'Contact', audience: 'customer' },
  { key: 'dashboard', default: 'Dashboard', audience: 'admin' },
  { key: 'messages', default: 'Messages', audience: 'admin' },
];

export const NAV_LABEL_MAXLEN = 24;

// Resolve a nav item's display label: the admin override if set, else the default.
export function navLabel(labels, key, fallback) {
  const override = labels && typeof labels[key] === 'string' ? labels[key].trim() : '';
  return override || fallback;
}
