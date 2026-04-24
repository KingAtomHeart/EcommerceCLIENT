// Shared color scheme for order and group-buy statuses. Uses CSS classes so dark mode
// can override via [data-theme="dark"] in globals.css.

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const MAP = {
  // Order statuses
  pending:        'gray',
  processing:     'amber',
  shipped:        'blue',
  delivered:      'green',
  cancelled:      'red',
  // GB order
  confirmed:      'green',
  inproduction:   'purple',
  // GB campaign phases
  interestcheck:  'gray',
  open:           'blue',
  closingsoon:    'amber',
  closed:         'gray',
  production:     'purple',
  completed:      'green',
};

// Read the current palette colors out of CSS variables so inline-styled chart pieces
// (like donut segments) can sample them too. Returns { bg, color } at call time.
const PALETTES = {
  light: {
    gray:   { bg: '#f0ede8', color: '#6b6256' },
    amber:  { bg: '#fdf0d5', color: '#8a6d1a' },
    blue:   { bg: '#d1e7f0', color: '#0c5460' },
    purple: { bg: '#e6dcf5', color: '#5d3b9e' },
    green:  { bg: '#d4ebd6', color: '#1f6b3a' },
    red:    { bg: '#f5d6d8', color: '#8b2a31' },
  },
  dark: {
    gray:   { bg: '#2a2822', color: '#c8b99f' },
    amber:  { bg: '#3d3118', color: '#f0c85a' },
    blue:   { bg: '#1a3642', color: '#6fc3d8' },
    purple: { bg: '#2d2346', color: '#b39bde' },
    green:  { bg: '#1e3d27', color: '#7dd89b' },
    red:    { bg: '#3d1f21', color: '#e89ba0' },
  },
};

function currentTheme() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') || 'light';
}

export function statusPaletteKey(status) {
  return MAP[norm(status)] || 'gray';
}

export function statusStyle(status) {
  const key = statusPaletteKey(status);
  const pal = PALETTES[currentTheme()] || PALETTES.light;
  return pal[key];
}

export function StatusBadge({ status, label, style }) {
  const key = statusPaletteKey(status);
  return (
    <span className={`status-badge status-${key}`} style={style}>
      {label || status}
    </span>
  );
}
