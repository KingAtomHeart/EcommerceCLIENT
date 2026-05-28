// Custom-page HTML rendering utilities.
//
// The product / group-buy admin can paste raw HTML + CSS into a `customPageHtml`
// field. When set, that markup is rendered below the buy section in place of
// the block-based landing page. The admin owns the layout entirely; this
// helper just substitutes a small set of dynamic tokens before injection so
// product data flows through without forcing the admin to retype it.
//
// Supported tokens (case-sensitive, surrounded by `{{ }}` with optional
// whitespace inside):
//   {{name}}        — product / GB name
//   {{description}} — description string (raw — interpolate inside a <p> or
//                     similar; markdown will not be rendered here)
//   {{price}}       — numeric price formatted with comma separators, no symbol
//                     (write `₱{{price}}` to get the symbol)
//   {{category}}    — category string
//   {{image1}} … {{imageN}} — image URL at that 1-based index, or empty
//
// Anything unmatched is replaced with an empty string to keep stray `{{x}}`
// from leaking through to customers.
//
// This is trusted-admin input — output is fed to dangerouslySetInnerHTML, so
// inline event handlers (onclick=...) will fire. Do not expose this field to
// untrusted users.

export function renderCustomPageTokens(html, product) {
  if (!html || typeof html !== 'string') return '';
  const images = product?.images || [];
  // Product uses `price`; GroupBuy uses `basePrice`. Fall back gracefully.
  const price = product?.price ?? product?.basePrice ?? 0;
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, rawKey) => {
    const key = rawKey.trim();
    if (key === 'name') return product?.name || '';
    if (key === 'description') return product?.description || '';
    if (key === 'category') return product?.category || '';
    if (key === 'price') return Number(price || 0).toLocaleString();
    const m = key.match(/^image(\d+)$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      return images[idx]?.url || '';
    }
    return '';
  });
}

// Skeleton HTML modelled on the Bowl Keyboards Oblique landing page. Paste
// this into the Custom HTML field and edit. Uses tokens so name / price /
// images update with the underlying product. Self-contained styles scoped
// under `.cp-page` so they don't bleed into the rest of the site.
export const CUSTOM_PAGE_SKELETON = `<style>
  .cp-page { background: var(--bg, #faf8f5); color: var(--ink, #1a1612); font-family: 'DM Sans', system-ui, sans-serif; }
  .cp-section { max-width: 1100px; margin: 0 auto; padding: 64px 24px; }
  .cp-section.cp-dark { background: #1a1612; color: #f3eee5; max-width: none; padding-left: 24px; padding-right: 24px; }
  .cp-section.cp-dark .cp-inner { max-width: 1100px; margin: 0 auto; }
  .cp-eyebrow { font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: #837469; margin: 0 0 12px; font-weight: 600; }
  .cp-h2 { font-family: 'DM Serif Display', serif; font-size: clamp(1.6rem, 2.6vw, 2.2rem); letter-spacing: -0.02em; margin: 0 0 24px; line-height: 1.1; }
  .cp-lead { font-size: 1.05rem; line-height: 1.7; color: #4a3f37; max-width: 640px; margin: 0; }
  .cp-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
  .cp-cols h3 { font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: #837469; margin: 0 0 10px; font-weight: 600; }
  .cp-cols ul { list-style: none; padding: 0; margin: 0; }
  .cp-cols li { font-size: 0.9rem; padding: 3px 0; line-height: 1.5; }
  .cp-hero { width: 100%; }
  .cp-hero img { width: 100%; display: block; }
  .cp-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
  .cp-specs ul { list-style: none; padding: 0; margin: 0; }
  .cp-specs li { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.08); display: grid; grid-template-columns: 200px 1fr; gap: 16px; font-size: 0.9rem; }
  .cp-specs li:last-child { border-bottom: none; }
  .cp-specs li strong { font-weight: 500; color: #837469; }
  .cp-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
  .cp-notes img { width: 100%; border-radius: 4px; display: block; }
  @media (max-width: 760px) {
    .cp-section { padding: 40px 20px; }
    .cp-cols { grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .cp-specs, .cp-notes { grid-template-columns: 1fr; gap: 24px; }
    .cp-specs li { grid-template-columns: 1fr; gap: 2px; }
  }
</style>

<div class="cp-page">

  <!-- BUY NOW summary ─────────────────────────────────────────────────── -->
  <section class="cp-section">
    <p class="cp-eyebrow">Buy now</p>
    <h2 class="cp-h2">{{name}}</h2>
    <p class="cp-lead">{{description}}</p>
  </section>

  <!-- Vendors / Timeline / Price / Kit Contents ───────────────────────── -->
  <section class="cp-section">
    <div class="cp-cols">
      <div>
        <h3>Vendors</h3>
        <ul>
          <li>Asia · Your vendor</li>
          <li>NA · Your vendor</li>
          <li>EU · Your vendor</li>
          <li>Oceania · Your vendor</li>
        </ul>
      </div>
      <div>
        <h3>Timeline</h3>
        <ul>
          <li>Instock Q1 2026</li>
        </ul>
      </div>
      <div>
        <h3>Price</h3>
        <ul>
          <li>From ₱{{price}}</li>
        </ul>
      </div>
      <div>
        <h3>Kit Contents</h3>
        <ul>
          <li>Top case</li>
          <li>Bottom case</li>
          <li>PCB</li>
          <li>Plate</li>
          <li>Daughterboard</li>
          <li>Hardware</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Exploded diagram (full bleed image) ─────────────────────────────── -->
  <section class="cp-hero">
    <img src="{{image1}}" alt="{{name}} exploded view">
  </section>

  <!-- Case specifications ─────────────────────────────────────────────── -->
  <section class="cp-section">
    <p class="cp-eyebrow">Case</p>
    <h2 class="cp-h2">Specifications</h2>
    <div class="cp-specs">
      <ul>
        <li><strong>Material</strong><span>Aluminum 6063</span></li>
        <li><strong>Weight</strong><span>1.4 kg</span></li>
        <li><strong>Finish</strong><span>Anodized matte</span></li>
        <li><strong>Mount</strong><span>Top mount</span></li>
      </ul>
      <ul>
        <li><strong>Layout</strong><span>65%</span></li>
        <li><strong>Typing angle</strong><span>6.5°</span></li>
        <li><strong>Front height</strong><span>20 mm</span></li>
        <li><strong>Dimensions</strong><span>320 × 110 mm</span></li>
      </ul>
    </div>
  </section>

  <!-- Design notes with paired image ──────────────────────────────────── -->
  <section class="cp-section cp-notes">
    <img src="{{image2}}" alt="{{name}} detail">
    <div>
      <p class="cp-eyebrow">Design</p>
      <h2 class="cp-h2">Notes</h2>
      <p class="cp-lead">Write the design philosophy here. What makes this build distinctive — the case profile, the mounting style, the typing feel, the inspirations behind it.</p>
    </div>
  </section>

  <!-- Dark colorways callout ──────────────────────────────────────────── -->
  <section class="cp-section cp-dark">
    <div class="cp-inner">
      <p class="cp-eyebrow" style="color:#cdc4b3;">Colorways</p>
      <h2 class="cp-h2" style="color:#f3eee5;">Pick your finish</h2>
      <p class="cp-lead" style="color:#cdc4b3;">List the colorways available, or replace this section with an image grid of finishes.</p>
    </div>
  </section>

</div>
`;
