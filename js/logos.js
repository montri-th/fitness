/**
 * Brand and venue logos — identity support next to the name, never instead of it.
 *
 * Registries: data/brand-logos.json (scripts/build-logos.py: the research master's 16_BRAND_LOGOS, every file
 * SHA-256 checked) and data/venue-logos.json (scripts/build-data.py: the CityMETER Shopping Centers registry's
 * venue logos for the venues this dataset links, bytes unchanged).
 *
 * Rules: the name stays the record of identity and is always written next to (or, in a pin, announced with) the
 * logo; a logo keeps its source colours, proportions and background — the chip behind it is the library's
 * recommended surface and is the same in the light and dark themes; a missing or invalid logo only means no logo.
 * Files load lazily (an <img> per use, cached by the browser).
 */
const FILE = /^assets\/(brand|venue)-logos\/[A-Za-z0-9._-]+\.(svg|png|jpe?g|webp)$/;
const MIME = new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']);
const HEX = /^#[0-9A-Fa-f]{6}$/;
let brands = new Map(), venues = new Map(), issues = [];

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function publicURL(value) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const u = new URL(value), host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || !host.includes('.') ||
      /(^|\.)(drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com|googleusercontent\.com)$/.test(host)) return '';
    return u.href;
  } catch { return ''; }
}

function valid(r) {
  const w = Number(r?.width), h = Number(r?.height);
  return r && FILE.test(r.file || '') && MIME.has(r.mime) && /^[a-f0-9]{64}$/.test(r.sha256 || '') && w > 0 && h > 0;
}

/** Load both registries (either may be null). Returns {brands, venues, issues}. */
export function configureLogos({brandLogos = null, venueLogos = null} = {}) {
  brands = new Map(); venues = new Map(); issues = [];
  for (const r of brandLogos?.logos || []) {
    if (!valid(r) || !/^BR-FIT-[a-f0-9]{12}$/.test(r.brand || '') || !HEX.test(r.backing || '')) { issues.push({brand: r?.brand || '', reason: 'invalid_record'}); continue; }
    if (brands.has(r.brand)) { issues.push({brand: r.brand, reason: 'duplicate'}); continue; }
    brands.set(r.brand, Object.freeze({...r, ratio: r.width / r.height, sourcePage: publicURL(r.sourcePage)}));
  }
  const bg = r => (HEX.test(r.background || '') ? r.background : '#E5E9E6');
  for (const r of venueLogos?.logos || []) {
    if (!valid(r) || !/^[A-Za-z0-9._-]{3,80}$/.test(r.key || '')) { issues.push({venue: r?.key || '', reason: 'invalid_record'}); continue; }
    venues.set(r.key, Object.freeze({...r, ratio: r.width / r.height, backing: bg(r)}));
  }
  return {brands: brands.size, venues: venues.size, issues: [...issues]};
}

export const brandLogo = brand => (brand ? brands.get(typeof brand === 'string' ? brand : brand.id) || null : null);
export const venueLogo = venue => (venue?.logo ? venues.get(venue.logo) || null : null);

/** Chip box: height by size, width from the artwork's ratio (bounded so a square and a wide wordmark both read). */
const SIZES = {xs: 18, sm: 22, md: 30, lg: 46};
function chip(logo, {size = 'sm', alt = '', className = '', title = ''} = {}) {
  const h = SIZES[size] || SIZES.sm, pad = size === 'xs' ? 2 : size === 'lg' ? 5 : 3;
  const inner = h - 2 * pad - 2;
  const w = Math.round(Math.min(Math.max(inner * logo.ratio, inner), inner * (size === 'lg' ? 4.2 : 3.4))) + 2 * pad + 2;
  const img = `<img src="${esc(logo.file)}" alt="${esc(alt)}" width="${logo.width}" height="${logo.height}" loading="lazy" decoding="async">`;
  return `<span class="logo-chip logo-${esc(size)}${className ? ' ' + esc(className) : ''}" style="--logo-bg:${esc(logo.backing)};--logo-w:${w}px;--logo-h:${h}px;--logo-pad:${pad}px"${title ? ` title="${esc(title)}"` : ''}${alt ? '' : ' aria-hidden="true"'}>${img}</span>`;
}

/** The brand's logo chip ('' when none). decorative: the brand name is written next to it. */
export function brandLogoMarkup(brand, {size = 'sm', decorative = true, className = ''} = {}) {
  const logo = brandLogo(brand);
  if (!logo) return '';
  const name = typeof brand === 'string' ? logo.name : brand.name || logo.name;
  return chip(logo, {size, className, alt: decorative ? '' : `โลโก้ ${name}`, title: logo.role === 'shared_chain_banner' ? `${name} · โลโก้ร่วมของเครือ` : ''});
}

export function venueLogoMarkup(venue, {size = 'sm', decorative = true, className = ''} = {}) {
  const logo = venueLogo(venue);
  return logo ? chip(logo, {size, className, alt: decorative ? '' : `โลโก้ ${venue.name}`}) : '';
}

/** Coverage of the brands in the data (every brand is expected to have one). */
export function logoCoverage(brandList = []) {
  const missing = brandList.filter(b => !brandLogo(b)).map(b => b.id);
  return {brands: brandList.length, withLogo: brandList.length - missing.length, missing, venues: venues.size, issues: [...issues], complete: !missing.length && !issues.length};
}
