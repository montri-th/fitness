/**
 * Contextual outbound actions: the next question a reader has at each view, answered outside the demo.
 *
 *  - ถาม Google AI — Google Search AI Mode (udm=50) with a question written for the view: a branch (is it open,
 *    hours, membership, reviews), a building (which gyms/studios are inside), a district (what is there, how they
 *    compare), a brand (how many branches, who runs it, price and positioning) or the country overview;
 *  - Street View — only where the view has a point (a published branch point, or a venue's registry reference
 *    point, which is not a shopfront: the label says "ใกล้");
 *  - Google Maps — a search by brand + branch + venue/district, for every branch (most have no point).
 *
 * Pure: builds labels and https URLs from public names only (no user data, no internal ids). The results are
 * Google's, not CityMETER data — the bar says so once.
 */
const enc = encodeURIComponent;
export const aiModeURL = q => `https://www.google.com/search?udm=50&q=${enc(q)}`;
export const mapsSearchURL = q => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
export const streetViewURL = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon)
  ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}` : '');

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const join = (...parts) => clean(parts.filter(Boolean).join(' '));
/** A branch label without a repeat of the brand ("Jetts - Black Gaysorn Village" → "Black Gaysorn Village"). */
export function branchLabel(row) {
  const brand = clean(row?.brand?.name), name = clean(row?.name);
  if (!name || name === brand) return '';
  const lower = name.toLowerCase(), b = brand.toLowerCase();
  let out = name;
  if (b && lower.startsWith(b)) out = name.slice(brand.length).replace(/^[\s\-–—:·|]+/, '');
  out = out.replace(/\s+(EN|En)\s+-\s+.*$/, '');   // locator page titles ("… EN - Jetts Thailand Fitness 24 Hours")
  return clean(out);
}

/**
 * ctx: {kind: 'store'|'venue'|'building'|'area'|'brand'|'overview', row?, venue?, area?: {place, province},
 *       brand?, point?: {lat, lon, role}, rows?}
 * → [{id, label, href, note}] in display order (only the actions that apply).
 */
export function contextActions(ctx = {}) {
  const out = [], place = ctx.area ? join(ctx.area.place, ctx.area.province) : '';
  const add = (id, label, href, note = '') => { if (href) out.push({id, label, href, note}); };
  if (ctx.kind === 'store' && ctx.row) {
    const r = ctx.row, brand = clean(r.brand?.name || r.name), branch = branchLabel(r), host = clean(r.venue?.name);
    const where = host || place;
    add('ai', 'ถาม Google AI', aiModeURL(`${join(brand, branch ? `สาขา ${branch}` : '', where ? `(${where})` : '')} ยังเปิดอยู่ไหม เปิดกี่โมง ค่าสมาชิกเท่าไร และรีวิวล่าสุดเป็นอย่างไร`));
    add('maps', 'Google Maps', mapsSearchURL(join(brand, branch, host || ctx.area?.place, ctx.area?.province)));
  } else if (ctx.kind === 'venue' && ctx.venue) {
    const v = ctx.venue;
    add('ai', 'ถาม Google AI', aiModeURL(`${join(v.name, place)} มีฟิตเนสหรือสตูดิโออะไรบ้าง แต่ละที่เด่นเรื่องอะไร และเปิดกี่โมง`));
    add('maps', 'Google Maps', mapsSearchURL(join(v.name, ctx.area?.province)));
  } else if (ctx.kind === 'building') {
    const names = [...new Set((ctx.rows || []).map(r => clean(r.brand?.name)).filter(Boolean))].slice(0, 3);
    add('ai', 'ถาม Google AI', aiModeURL(`${join(names.join(' '), place)} อยู่อาคารไหน มีฟิตเนสหรือสตูดิโออื่นในอาคารเดียวกันไหม`));
  } else if (ctx.kind === 'area' && ctx.area) {
    add('ai', 'ถาม Google AI', aiModeURL(`ฟิตเนสและสตูดิโอใน${clean(ctx.area.place)} ${clean(ctx.area.province)} มีที่ไหนน่าสนใจ เทียบราคา บรรยากาศ และคลาส`));
    add('maps', 'Google Maps', mapsSearchURL(`ฟิตเนส ${join(ctx.area.place, ctx.area.province)}`));
  } else if (ctx.kind === 'brand' && ctx.brand) {
    const b = clean(ctx.brand.name);
    add('ai', 'ถาม Google AI', aiModeURL(`${b} ในประเทศไทย มีกี่สาขา ใครเป็นผู้ดำเนินงาน ค่าสมาชิก และจุดเด่นเทียบคู่แข่ง`));
  } else if (ctx.kind === 'overview') {
    add('ai', 'ถาม Google AI', aiModeURL('ภาพรวมตลาดฟิตเนสและสตูดิโอในประเทศไทยล่าสุด แบรนด์ไหนขยายสาขาเร็ว และรูปแบบไหนกำลังโต'));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
    add('streetview', p.role === 'host' ? 'Street View ใกล้อาคาร' : 'Street View', streetViewURL(p.lat, p.lon),
      p.role === 'host' ? 'ตำแหน่งอ้างอิงของอาคาร ไม่ใช่ทางเข้าร้าน' : '');
  }
  return out;
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** The action bar (icon + short label; one note that the answers come from Google). '' when nothing applies. */
export function actionBar(ctx) {
  const list = contextActions(ctx);
  if (!list.length) return '';
  return `<div class="ask-bar" role="group" aria-label="ค้นต่อใน Google">${list.map(a => `<a class="ask-link ask-${esc(a.id)}" href="${esc(a.href)}" target="_blank" rel="noopener noreferrer"${a.note ? ` title="${esc(a.note)}"` : ''}><i class="pictogram pic-${a.id === 'ai' ? 'ai' : a.id === 'streetview' ? 'streetview' : 'maps'}" aria-hidden="true"></i><span>${esc(a.label)}</span></a>`).join('')}<span class="ask-note">เปิดใน Google · ผลลัพธ์ไม่ใช่ข้อมูล CityMETER</span></div>`;
}
