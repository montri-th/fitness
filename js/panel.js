/**
 * Reading panel views as HTML strings. Pure: no DOM access, no map.
 *
 * Every actionable element carries data-action (+ data-id / data-value); the app binds one delegated
 * handler. Actions: select-area · select-store · select-building · select-venue · select-province ·
 * filter-brand · set-status · back · explore-top · clear-focus · open-charts · open-table · clear-filter ·
 * leave-area.
 *
 * Copy is short, natural Thai. Units follow the status filter (model.js#unitWords): สาขา = a branch the
 * brand's official page still lists on the check date (default) · รายการ = a row of another status, or of
 * every status. Building wording: "จุดตกในอาคาร" — the published point falls inside the drawn outline; never
 * "ตั้งอยู่ใน". Missing is never shown as 0. Every view ends with one provenance line (dataset · source · date
 * · boundary) and one clause on what the counted unit is. Metric tiles and headings carry the pictogram
 * subset (js/navigation.js PICTOGRAM_CONTRACT); the text is the meaning.
 *
 * Brand first (owner 2026-10-29): wherever a branch is named, the brand logo and brand name come first and the
 * branch name second. Panels stay short: logos, pictograms, small bars and one action bar (js/ask.js) carry what
 * text used to; the evidence details sit in one closed <details> block.
 */
import {productionLink, provinceByCode, hasPoint, STATUS_TH, STATUS_RAW_TH} from './model.js';
import {areaWord} from './areas.js';
import {cueMarkup, seriesOf} from './cues.js';
import {ROLE_TH} from './profile-model.js';
import {brandLogoMarkup, venueLogoMarkup} from './logos.js';
import {actionBar, branchLabel} from './ask.js';

/** The venue's page in CityMETER Shopping centers (deep link by registry id). */
export const SHOPPING_SITE = 'https://montri-th.github.io/shoppingcenter/';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const num = n => NUMBER.format(n);
/** Whole-number share; a non-zero part never prints as 0% ("<1%"). */
export const pct = (part, whole) => (!whole ? '—' : part && Math.round((part / whole) * 100) === 0 ? '<1%' : `${NUMBER.format(Math.round((part / whole) * 100))}%`);
/** A number and its unit never split across lines in running text. */
const nw = html => `<span class="nowrap">${html}</span>`;
const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };

export function link(url, label, cls = 'source-link') {
  const u = safeURL(url);
  return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
}

export function thaiDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

/** Metric tile with a decorative pictogram; value may be a preformatted string. */
export function metricTile(value, label, kind = '') {
  const shown = typeof value === 'string' ? value : num(value);
  return `<div class="metric${kind ? ` metric-${kind}` : ''}"><i class="metric-symbol pictogram pic-${esc(kind || 'plain')}" aria-hidden="true"></i><strong class="data-number">${esc(shown)}</strong><span>${esc(label)}</span></div>`;
}
export const heading = (kind, text, id = '') => `<h3${id ? ` id="${esc(id)}"` : ''}><i class="pictogram pic-${esc(kind)}" aria-hidden="true"></i>${esc(text)}</h3>`;

const provinceName = code => provinceByCode(code)?.th || code || '';
/** "เขตวัฒนา" / "อำเภอเมืองภูเก็ต". */
const placeName = a => (a ? `${areaWord(a.province)}${a.name}` : '');
/** One word for a list of districts: เขต (all Bangkok), อำเภอ (none), else เขต/อำเภอ. */
export const words = areas => {
  const p = new Set(areas.map(a => a.province));
  return p.size === 1 ? areaWord([...p][0]) : 'เขต/อำเภอ';
};

/* ---------- vocabularies (display copy for the sheet's codes) ---------- */

/** How the row's district was matched at build time (row.admin). */
export const ADMIN_TH = Object.freeze({
  point: 'จากจุดที่แหล่งเผยแพร่',
  host: 'จากตำแหน่งศูนย์การค้าในทะเบียน CityMETER',
  address: 'จากที่อยู่ที่แหล่งเผยแพร่',
  province: 'แหล่งระบุได้แค่จังหวัด จึงไม่อยู่ในสีของเขต/อำเภอใด',
  conflict: 'จังหวัดในชุดข้อมูลไม่ตรงกับที่อยู่ จึงยังไม่ระบุพื้นที่',
  none: 'แหล่งไม่ระบุจังหวัด',
});
export const SOURCE_TYPE_TH = Object.freeze({
  official_operator_page: 'หน้าสาขาบนเว็บไซต์ทางการ', official_operator_web: 'เว็บไซต์ทางการ', official_operator_website: 'เว็บไซต์ทางการ',
  official_operator_locator_rendered: 'หน้าค้นหาสาขาทางการ', official_operator_network_locator: 'หน้าค้นหาสาขาของเครือข่าย',
  official_operator_social: 'โซเชียลทางการ', official_operator_facebook: 'Facebook ทางการ', official_facebook_rendered: 'Facebook ทางการ',
  official_operator_facebook_closure_notice: 'ประกาศบน Facebook ทางการ', official_line_oa: 'LINE ทางการ', official_linktree: 'Linktree ทางการ',
  official_company_profile_index: 'หน้าบริษัททางการ', official_host_directory: 'รายชื่อร้านของศูนย์การค้า',
});
export const POINT_ROLE_TH = Object.freeze({
  store_source_point: 'จุดที่หน้าทางการของสาขาเผยแพร่',
  operator_published_map_destination_point: 'จุดปลายทางแผนที่ที่ผู้ดำเนินงานเผยแพร่',
  official_social_profile_map_point_historical: 'จุดจากโปรไฟล์โซเชียลทางการ',
  host_registry_reference_point: 'ตำแหน่งอ้างอิงของศูนย์การค้าในทะเบียน CityMETER ไม่ใช่ทางเข้าสาขา',
});
/** Branch-list coverage of a brand (01_BRANDS.branch_coverage). Counts stay ours, never in the label. */
export const COVERAGE_TH = Object.freeze({
  full: 'ครบตามรายชื่อสาขาทางการ', full_official_list: 'ครบตามรายชื่อสาขาทางการ', full_locator_enumerated: 'ครบตามหน้าค้นหาสาขาทางการ',
  official_sites_enumerated: 'ครบตามสาขาที่เว็บไซต์ทางการระบุ', partial: 'บางส่วน — ยังไม่ใช่รายชื่อครบทั้งเครือข่าย',
  partial_locator_enumerated: 'บางส่วนจากหน้าค้นหาสาขา', full_locator_enumerated_address_partial: 'ครบตามหน้าค้นหาสาขา ที่อยู่บางสาขายังไม่ครบ',
  full_current_network_locator_three_sites_addresses_unresolved: 'ครบตามหน้าค้นหาสาขา บางสาขายังระบุที่อยู่ไม่ได้',
  full_locator_enumerated_with_conflict: 'ครบตามหน้าค้นหาสาขา มีแหล่งที่ขัดกัน',
  full_current_locator_29_cards_24_listed_5_announced: 'ครบตามหน้าค้นหาสาขาปัจจุบัน',
  six_branches_fully_enumerated_from_official_announcement_street_addresses_partial: 'ครบตามประกาศทางการ ที่อยู่บางสาขายังไม่ครบ',
  one_official_site_listed_contact_placeholder_flagged: 'หนึ่งสาขาที่แหล่งทางการระบุ',
  one_current_operator_location_identity_confirmed_alias_relation_unresolved: 'หนึ่งสาขาปัจจุบันของผู้ดำเนินงาน',
  historical_single_site_officially_closed: 'สาขาเดียว แหล่งทางการแจ้งปิดแล้ว',
});
export const coverageLabel = code => COVERAGE_TH[code] || (String(code).startsWith('full') ? 'ครบตามแหล่งทางการ' : String(code).startsWith('partial') ? 'บางส่วน' : 'ตามแหล่งทางการ');
const STATUS_ORDER = ['listed', 'announced', 'closed', 'review'];
const STATUS_UNIT = Object.freeze({
  listed: 'สาขาที่หน้าทางการของแบรนด์ยังแสดง ณ วันตรวจ',
  announced: 'สาขาที่แหล่งทางการประกาศว่าจะเปิด ณ วันตรวจ',
  closed: 'สาขาที่แหล่งทางการแจ้งว่าปิดแล้ว',
  review: 'สาขาที่สถานะในแหล่งยังไม่ชัด',
});

export function statusPill(status, raw = '') {
  if (!status) return '';
  return `<span class="status-pill tone-${esc(status)}"${raw ? ` title="${esc(STATUS_RAW_TH[raw] || '')}"` : ''}>${esc(STATUS_TH[status] || status)}</span>`;
}

/**
 * Every view that shows numbers ends with dataset · source · date · boundary, and what one counted unit is.
 * ctx = {meta, unit}
 */
export function provenance(ctx = {}, boundary = '') {
  const meta = ctx.meta || {}, unit = ctx.unit || {mode: 'listed', one: 'สาขา'};
  const brands = meta.readmeCheck?.brands;
  const clause = unit.mode === 'listed'
    ? `สาขา = ${STATUS_UNIT.listed}${brands ? ` · ${num(brands)} แบรนด์ในชุดข้อมูล ไม่ใช่ทุกฟิตเนสในประเทศ` : ''}`
    : unit.mode === 'all'
      ? 'รายการ = ทุกแถวในชุดข้อมูลทุกสถานะ ไม่ใช่จำนวนสาขาที่เปิด'
      : `รายการ = ${STATUS_UNIT[unit.mode] || 'แถวในชุดข้อมูล'} · นับแยกจากสาขาที่เปิดตามแหล่ง`;
  return `<p class="hint panel-foot provenance"><span>ชุดข้อมูล CityMETER Fitness</span> · <span>แหล่ง หน้าทางการของแต่ละแบรนด์</span> · <span>ตรวจ ${esc(thaiDate(meta.checkedOn || ''))}</span> · <span>ขอบเขต ${esc(boundary)}</span><br>${esc(clause)}</p>`;
}

/* ---------- shared fragments ---------- */

function groupBars(byGroup, total, unit) {
  const list = byGroup.filter(g => g.count > 0).sort((a, b) => b.count - a.count || a.index - b.index);
  if (!list.length) return `<p class="hint">ไม่มี${esc(unit.one)}</p>`;
  const max = Math.max(1, ...list.map(g => g.count));
  return `<ul class="mix-list" aria-label="รูปแบบ (${esc(unit.one)})">${list.map(g => `
    <li><span class="mix-label">${cueMarkup(g.series)}${esc(g.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill category-${g.series}" style="width:${Math.max(3, Math.round((g.count / max) * 100))}%"></span></span>
      <span class="mix-value data-number" title="${num(g.count)} จาก ${num(total)} ${esc(unit.one)}">${num(g.count)}</span></li>`).join('')}</ul>`;
}

function rowMeta(r, {showArea = false, index = null, unit} = {}) {
  const area = showArea && index && r.area ? index.byId.get(r.area) : null;
  // The venue name is left out when the branch name already says it (“Cloud 11” at Cloud 11).
  const fold = t => String(t || '').toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '');
  const venue = r.venue && !(fold(branchLabel(r)).includes(fold(r.venue.name)) && fold(r.venue.name)) ? r.venue.name : '';
  return [venue, unit?.mode === 'listed' ? '' : STATUS_TH[r.status] || '',
    area ? `${placeName(area)} · ${provinceName(area.province)}` : showArea && !r.area ? (r.province ? `${provinceName(r.province)} · ระบุได้แค่จังหวัด` : 'ไม่ระบุจังหวัด') : ''].filter(Boolean).join(' · ');
}

/** Brand first: logo + brand, then the branch name, then where (venue · area) and status. */
export function storeList(rows, opts = {}) {
  return `<ul class="outlet-list">${rows.map(r => {
    const brand = r.brand?.name || r.name || 'ไม่มีชื่อในแหล่งข้อมูล', branch = branchLabel(r), meta = rowMeta(r, opts);
    return `<li><button type="button" class="brand-row" data-action="select-store" data-id="${esc(r.id)}">${brandLogoMarkup(r.brand, {size: 'sm', className: 'row-logo'}) || cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(brand)}</strong>${branch ? `<span class="row-branch">${esc(branch)}</span>` : ''}<span class="row-meta">${cueMarkup(r.series, {className: 'row-cue-inline'})}${esc(meta || '')}</span></span></button></li>`;
  }).join('')}</ul>`;
}

function brandChips(list, unit) {
  if (!list.length) return '<p class="hint">ไม่มีแบรนด์ในตัวกรองนี้</p>';
  return `<ul class="chip-list logo-wall">${list.map(c => `<li><button type="button" class="brand-chip" data-action="filter-brand" data-value="${esc(c.brand.id)}" title="${esc(c.brand.name)} — ${num(c.count)} ${esc(unit.one)} (ดูเฉพาะแบรนด์นี้)">${brandLogoMarkup(c.brand, {size: 'sm'}) || cueMarkup(seriesOf(c.brand.group), {className: 'chip-cue'})}<span>${esc(c.brand.name)}</span><small class="data-number">${num(c.count)}</small></button></li>`).join('')}</ul>`;
}

/** The brands of a building or venue as a strip of logos; each opens that brand's branch there (or the first). */
function brandStrip(rows) {
  const seen = new Map();
  for (const r of rows) if (r.brand && !seen.has(r.brand.id)) seen.set(r.brand.id, r);
  if (!seen.size) return '';
  return `<ul class="logo-strip" aria-label="แบรนด์ในอาคารนี้">${[...seen.values()].map(r => `<li><button type="button" class="logo-button" data-action="select-store" data-id="${esc(r.id)}" title="${esc(r.brand.name)}${branchLabel(r) ? ` · ${esc(branchLabel(r))}` : ''}">${brandLogoMarkup(r.brand, {size: 'md'}) || cueMarkup(r.series)}<span>${esc(r.brand.name)}</span></button></li>`).join('')}</ul>`;
}

/** Districts ranked by count, bars in the map's 41-sample count ramp colour (classOf). */
function areaRanking(list, classOf, unit, {title, note = '', limit = 10, showProvince = false, id = 'rank-title'} = {}) {
  const top = list.slice(0, limit);
  if (!top.length) return '';
  const max = Math.max(1, ...top.map(a => a.count));
  return `<section class="panel-section" aria-labelledby="${esc(id)}">
    <div class="section-heading">${heading('area', title, id)}<span class="hint">${esc(note)}</span></div>
    <ol class="rank-list">${top.map((a, i) => {
      const where = `${showProvince ? `${provinceName(a.province)} · ` : ''}${num(a.count)} ${unit.one} · ${num(a.brands)} แบรนด์`;
      return `<li><button type="button" class="rank-row" data-action="select-area" data-id="${esc(a.id)}" aria-label="อันดับ ${i + 1} ${esc(placeName(a))} ${showProvince ? esc(provinceName(a.province)) : ''} ${num(a.count)} ${esc(unit.one)} ${num(a.brands)} แบรนด์">
        <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
        <span class="rank-name">${esc(placeName(a))}<small>${esc(where)}</small></span>
        <span class="rank-track" aria-hidden="true"><span class="rank-fill" style="width:${Math.max(3, Math.round((a.count / max) * 100))}%;background:${esc(classOf(a))}"></span></span>
        <span class="rank-value data-number" aria-hidden="true">${num(a.count)}</span></button></li>`;
    }).join('')}</ol>
  </section>`;
}

/** Rows no district holds, by reason — they stay in every total, never in a district colour. */
function unplacedNote(u, unit) {
  if (!u?.total) return '';
  const parts = [u.noArea ? `ระบุได้แค่จังหวัด ${num(u.noArea)}` : '', u.noProvince ? `ไม่ระบุจังหวัด ${num(u.noProvince)}` : '', u.conflict ? `ข้อมูลจังหวัดขัดกัน ${num(u.conflict)}` : ''].filter(Boolean);
  return `<p class="hint">ไม่อยู่ในอันดับ ${parts.join(' · ')} ${esc(unit.one)} — นับในยอดรวม</p>`;
}

/** Other statuses under the same filters: counted apart, one click away. */
function statusOthers(counts, unit) {
  if (!counts || unit.mode !== 'listed') return '';
  const others = STATUS_ORDER.slice(1).filter(s => counts[s]);
  if (!others.length) return '';
  return `<p class="hint status-others">ไม่รวมในตัวเลข: ${others.map(s => `<button type="button" class="link-button" data-action="set-status" data-value="${s}">${esc(STATUS_TH[s])} ${num(counts[s])}</button>`).join(' · ')} รายการ</p>`;
}

/* ---------- Brand card (brand filter) ---------- */

/** One line per company (and, for investors, per company invested in): its recorded roles and evidence links. */
function companyItems(list) {
  const by = new Map();
  for (const c of list) {
    const key = `${c.company.id}|${c.of?.id || ''}`;
    const e = by.get(key) || {company: c.company, of: c.of, roles: [], urls: []};
    const role = ROLE_TH[c.type] || 'บริษัทที่เกี่ยวข้อง';
    if (!e.roles.includes(role)) e.roles.push(role);
    if (c.url && !e.urls.includes(c.url)) e.urls.push(c.url);
    by.set(key, e);
  }
  return [...by.values()].map(e => `<li><span class="company-role">${esc(e.roles.join(' · '))}</span> <strong>${esc(e.company.name)}</strong>${e.company.jurisdiction ? ` <small>(${esc(e.company.jurisdiction === 'Thailand' ? 'ไทย' : e.company.jurisdiction)})</small>` : ''}${e.of ? ` <small>ใน ${esc(e.of.name)}</small>` : ''} ${e.urls.map((u, i) => link(u, e.urls.length > 1 ? `หลักฐาน ${i + 1}` : 'หลักฐาน')).join(' ')}</li>`).join('');
}

export function renderBrandCard(p, ctx = {}) {
  if (!p) return '';
  const b = p.brand, unit = ctx.unit;
  const statuses = STATUS_ORDER.filter(s => p.byStatus[s]).map(s => `${statusPill(s)} <span class="data-number">${num(p.byStatus[s])}</span>`).join(' ');
  const companies = p.companies.direct.length
    ? `<ul class="company-list">${companyItems(p.companies.direct)}</ul>${p.companies.upstream.length ? `<p class="company-sub">ผู้ลงทุนที่บันทึก</p><ul class="company-list">${companyItems(p.companies.upstream)}</ul>` : ''}<p class="hint">ชื่อบริษัทตามที่แหล่งระบุ ยังไม่ได้ตรวจกับทะเบียนนิติบุคคล</p>`
    : '<p class="hint">ยังไม่พบชื่อบริษัทในแหล่งทางการ — ไม่ได้แปลว่าไม่มีบริษัทแม่</p>';
  const companyNames = [...new Set(p.companies.direct.map(c => c.company.name))];
  const related = p.related.length ? `<div class="related"><span class="hint">บริษัทเดียวกัน</span><ul class="chip-list logo-wall">${p.related.map(r => `<li><button type="button" class="brand-chip" data-action="filter-brand" data-value="${esc(r.brand.id)}" title="${esc(r.companies.join(', '))}">${brandLogoMarkup(r.brand, {size: 'sm'}) || cueMarkup(seriesOf(r.brand.group), {className: 'chip-cue'})}<span>${esc(r.brand.name)}</span></button></li>`).join('')}</ul></div>` : '';
  return `<section class="brand-card detail-head" aria-labelledby="brand-title">
      <div class="identity">${brandLogoMarkup(b, {size: 'lg', decorative: false})}<div>
        <p class="eyebrow eyebrow-cue">${cueMarkup(seriesOf(b.group))}${esc(p.group?.th || '')}${p.segment ? ` · ${esc(p.segment.th)}` : ''}</p>
        <h2 id="brand-title">${esc(b.name)}</h2></div></div>
      <p class="brand-status">${statuses}</p>
      ${p.scopeCount ? `<div class="metrics compact">${metricTile(p.scopeCount, unit.one, 'store')}${metricTile(p.placed, 'ระบุเขต/อำเภอได้', 'area')}${metricTile(p.provinces, 'จังหวัด', 'province')}</div>` : ''}
      <p class="fact-line"><span class="fact-icon pictogram pic-store" aria-hidden="true"></span>${esc(coverageLabel(b.coverage))}${companyNames.length ? ` · <span class="fact-icon pictogram pic-brand" aria-hidden="true"></span>${esc(companyNames.slice(0, 2).join(' · '))}${companyNames.length > 2 ? ` +${num(companyNames.length - 2)}` : ''}` : ''}</p>
      ${actionBar({kind: 'brand', brand: b})}
      ${related}
      <details class="source-details"><summary>บริษัทและแหล่ง</summary>
        <dl class="facts"><dt>บริษัท</dt><dd>${companies}</dd>
        <dt>แหล่ง</dt><dd>${link(b.url, 'เว็บไซต์ทางการ') || 'ไม่มีลิงก์สาธารณะ'}${b.checkedOn ? ` · ตรวจ ${esc(thaiDate(b.checkedOn))}` : ''}</dd></dl></details>
      <div class="detail-actions"><button type="button" class="btn quiet" data-action="clear-filter" data-id="brand">ดูทุกแบรนด์</button></div>
    </section>`;
}

/* ---------- Overview ---------- */

/** The district(s) with the most rows outside the leading province — every district tied at that count. */
function outsideLine(insight, home, unit, province) {
  const o = insight.outside;
  // One branch is the floor of every district that has any: “most” would say nothing.
  if (!o || province || o.count < 2) return '';
  const linkTo = a => `<button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(placeName(a))}</button> ${esc(provinceName(a.province))}`;
  const tied = o.tied || [o];
  if (tied.length === 1) return `<p class="aha-secondary">นอก${esc(home)}มากที่สุด: ${linkTo(tied[0])} ${nw(`<span class="data-number">${num(o.count)}</span> ${esc(unit.one)}`)}</p>`;
  const shown = tied.slice(0, 3), rest = tied.length - shown.length;
  return `<p class="aha-secondary">นอก${esc(home)}มากที่สุด ${nw(`<span class="data-number">${num(o.count)}</span> ${esc(unit.one)}`)} เท่ากัน ${num(tied.length)} พื้นที่: ${shown.map(linkTo).join(' · ')}${rest ? ` และอีก ${num(rest)} พื้นที่` : ''}</p>`;
}

/**
 * focusMode: 'auto' (default top districts) · 'explicit' (user-chosen) · 'none' (every district).
 * personality: show the studio-share comparison (off when a format filter makes it meaningless).
 */
export function renderOverview({insight, summary, overview, focusMode = 'auto', classOf = () => 'var(--scale-count-3)', provinces = [], unknownProvince = 0,
  province = '', statusCounts = null, brandCard = '', personality = true, ctx = {}}) {
  const unit = ctx.unit;
  const count = insight.areas.length;
  const w = words(insight.areas);
  const names = insight.areas.map(a => `<button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(a.name)}</button>`).join(' · ');
  const home = provinceName(insight.home);
  let aha;
  if (!summary.count && focusMode !== 'explicit') {
    const others = statusCounts && unit.mode === 'listed' && STATUS_ORDER.slice(1).some(s => statusCounts[s]);
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบแรก</p><h2>ไม่พบ${esc(unit.one)}ตามตัวกรองนี้</h2>
      ${others ? `<p class="aha-copy">ตัวกรองเดียวกันยังมีสาขาสถานะอื่น</p>` : ''}
      <div class="aha-actions">${others ? '<button type="button" data-action="set-status" data-value="all" class="btn primary">ดูทุกสถานะ</button>' : ''}<button type="button" data-action="clear-filter" data-id="all" class="btn">ล้างตัวกรอง</button></div></section>`;
  } else if (focusMode === 'explicit') {
    aha = `<section class="aha is-focused" aria-label="ข้อค้นพบ"><p class="eyebrow">กำลังสำรวจ ${num(count)} ${esc(w)}</p>
      <h2>${insight.areas.map(a => esc(a.name)).join(' · ')}</h2>
      <p class="aha-copy">${nw(`<strong class="data-number">${num(insight.count)}</strong> ${esc(unit.one)}`)}</p>
      <div class="aha-actions"><button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  } else if (!count && insight.spread) {
    // Every district of the leading province holds the same number: the branches are spread, not concentrated.
    const sw = areaWord(insight.home), sp = insight.spread;
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบแรก</p>
      <h2><span class="aha-number data-number">${num(sp.areas)}</span><span class="aha-headline">${esc(sw)}ใน${esc(home)} มี${esc(unit.one)}${esc(sw)}ละ ${num(sp.count)} ${esc(unit.one)}เท่ากัน</span></h2>
      <p class="aha-copy">${esc(unit.one)}กระจาย ไม่กระจุกใน${esc(sw)}ใด · ${nw(`<strong class="data-number">${num(insight.homePlaced)}</strong> ${esc(unit.one)}`)}ที่ระบุ${esc(sw)}ได้${insight.homeUnplaced ? ` · อีก ${nw(`${num(insight.homeUnplaced)} ${esc(unit.one)}`)}ระบุได้แค่จังหวัด` : ''}</p>
      ${outsideLine(insight, home, unit, province)}
      <div class="aha-actions"><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  } else if (!count) {
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบแรก</p><h2><span class="aha-number data-number">${num(summary.count)}</span><span class="aha-headline">${esc(unit.one)}ตามตัวกรอง — ยังระบุเขต/อำเภอไม่ได้</span></h2>
      <p class="aha-copy">แหล่งระบุที่ตั้งของ${esc(unit.one)}เหล่านี้ได้แค่จังหวัดหรือไม่ระบุเลย จึงยังจัดอันดับเขต/อำเภอไม่ได้</p>
      <div class="aha-actions"><button type="button" data-action="open-table" class="btn">ดูรายชื่อ</button></div></section>`;
  } else {
    const toggle = focusMode === 'auto'
      ? '<button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button>'
      : `<button type="button" data-action="explore-top" class="btn primary">โฟกัส ${num(count)} ${esc(w)}นี้</button>`;
    const s = insight.studio;
    const studio = personality && s.focusShare != null && s.restShare != null && s.focusTotal >= 10 && s.restTotal >= 10
      ? `<p class="aha-personality">สตูดิโอ ${nw(`<strong class="data-number">${pct(s.focus, s.focusTotal)}</strong>`)} ของ${esc(unit.one)}ใน${count === 1 ? esc(placeName(insight.areas[0])) : ` ${num(count)} ${esc(w)}นี้`} ${nw(`(${num(s.focus)}/${num(s.focusTotal)})`)} · ${esc(w)}อื่นของ${esc(home)} ${nw(`<strong class="data-number">${pct(s.rest, s.restTotal)}</strong> (${num(s.rest)}/${num(s.restTotal)})`)}</p>`
      : '';
    const outside = outsideLine(insight, home, unit, province);
    const rule = `<p class="hint">นับ${esc(unit.one)}ที่ระบุ${esc(w)}ได้${studio ? ' · สตูดิโอ = เทรนนิ่ง/PT พิลาทิส คลาสบูทีค โยคะ มวย ปีนผา' : ''}</p>`;
    aha = `<section class="aha${focusMode === 'auto' ? ' is-auto' : ''}" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบแรก</p>
      <h2><span class="aha-number data-number">${pct(insight.count, insight.homePlaced)}</span><span class="aha-headline">ของ${esc(unit.one)}ใน${esc(home)}ที่ระบุ${esc(w)}ได้ อยู่ใน${count === 1 ? esc(placeName(insight.areas[0])) : ` ${num(count)} ${esc(w)}นี้`}</span></h2>
      <p class="aha-copy">${names}<br>${nw(`<strong class="data-number">${num(insight.count)}</strong> จาก ${num(insight.homePlaced)} ${esc(unit.one)}`)}${insight.homeUnplaced ? ` · อีก ${nw(`${num(insight.homeUnplaced)} ${esc(unit.one)}`)}ใน${esc(home)}ระบุได้แค่จังหวัด` : ''}</p>
      ${studio}${outside}${rule}<div class="aha-actions">${toggle}<button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  }
  const narrowed = focusMode !== 'none' && count > 0 && summary.count !== overview.count;
  const metrics = `<section class="metrics" aria-label="${narrowed ? 'ตัวเลขของพื้นที่ที่โฟกัส' : 'ตัวเลขรวมของข้อมูลที่เลือก'}">
    ${metricTile(summary.count, `${unit.one}${narrowed ? ' ในโฟกัส' : ''}`, 'store')}
    ${metricTile(summary.brands, `แบรนด์${narrowed ? ' ในโฟกัส' : ''}`, 'brand')}
    ${metricTile(summary.areas, `${narrowed ? esc(w) : 'เขต/อำเภอ'}ที่พบ`, 'area')}
    ${metricTile(summary.provinces, 'จังหวัดที่พบ', 'province')}
  </section>${statusOthers(statusCounts, unit)}`;
  const scopeText = province ? `${provinceName(province)} · ${areaWord(province)}ตามขอบเขต CityMETER` : 'ประเทศไทย 77 จังหวัด · เขต/อำเภอตามขอบเขต CityMETER';
  const provinceRows = p => `<li><button type="button" class="province-row" data-action="select-province" data-id="${esc(p.code)}" aria-label="${esc(p.name)} ${num(p.count)} ${esc(unit.one)} กดเพื่อดูจังหวัด"><i class="province-swatch" style="background:${esc(p.fill)}" aria-hidden="true"></i><span class="province-name">${esc(p.name)}</span><span class="province-count data-number">${num(p.count)}<small>${esc(unit.one)}</small></span></button></li>`;
  const shown = provinces.slice(0, 8), rest = provinces.slice(8);
  const unknown = unknownProvince ? `<p class="hint">ไม่ระบุจังหวัด ${nw(`${num(unknownProvince)} ${esc(unit.one)}`)} — นับในยอดรวม ไม่อยู่บนแผนที่</p>` : '';
  const provinceList = provinces.length > 1 ? `<section class="panel-section" aria-labelledby="province-title">
    <div class="section-heading">${heading('province', `จังหวัดที่มี${unit.one}มากที่สุด`, 'province-title')}<span class="hint">${num(provinces.length)} จังหวัด</span></div>
    <ul class="province-list">${shown.map(provinceRows).join('')}</ul>
    ${rest.length ? `<details class="more-provinces"><summary>อีก ${num(rest.length)} จังหวัด</summary><ul class="province-list">${rest.map(provinceRows).join('')}</ul></details>` : ''}
    ${unknown}</section>` : '';
  const rw = province ? areaWord(province) : 'เขต/อำเภอ';
  const rank = areaRanking(overview.ranking, classOf, unit, {title: `${rw}ที่มี${unit.one}มากที่สุด`, note: `${num(overview.ranking.length)} ${rw}`, showProvince: !province});
  const ranking = rank ? rank.replace('</section>', `${unplacedNote(overview.unplaced, unit)}</section>`) : '';
  const mix = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('segment', 'รูปแบบ')}<span class="hint">${num(overview.count)} ${esc(unit.one)}ตามตัวกรอง</span></div>${groupBars(overview.mix.byGroup, overview.count, unit)}</section>` : '';
  const brands = overview.brands.length && !brandCard ? `<section class="panel-section"><div class="section-heading">${heading('brand', `แบรนด์ที่มี${unit.one}มากที่สุด`)}<span class="hint"><button type="button" class="link-button" data-action="open-charts" data-value="brands">ดูทุกแบรนด์</button></span></div>${brandChips(overview.brands, unit)}</section>` : '';
  return `${brandCard}${aha}${metrics}${provinceList}${ranking}${mix}${brands}${brandCard ? '' : actionBar({kind: 'overview'})}${provenance(ctx, scopeText)}`;
}

/* ---------- Empty selections (EVID-05) ---------- */

/**
 * measured_zero: every district is in the research scope (the brands' own branch lists cover the country),
 * so a district with no row under the filters is a measured 0 of this dataset — offered with where the same
 * filters match. Never "no data".
 */
function selectionNote(p, place, ctx) {
  if (p.coverageState !== 'measured_zero') return '';
  const unit = ctx.unit;
  const base = ctx.filtered
    ? `<span>0 ${esc(unit.one)}ภายใต้ตัวกรองนี้</span>`
    : `<span>ไม่มีแบรนด์ใดในชุดข้อมูลที่หน้าทางการระบุ${esc(unit.one)}ในพื้นที่นี้ ณ วันตรวจ</span>`;
  const elsewhere = p.scopeCount > 0
    ? `<span>ตัวกรองเดียวกันพบ <strong class="data-number">${num(p.scopeCount)}</strong> ${esc(unit.one)}ในพื้นที่อื่น</span><button type="button" class="btn quiet" data-action="leave-area">ดูพื้นที่ที่พบ</button>`
    : '';
  return `<div class="empty-note" role="note"><strong>ไม่พบ${esc(unit.subject)}ใน${esc(place)}</strong>${base}${elsewhere}</div>`;
}

/* ---------- District (เขต/อำเภอ) ---------- */

export function renderArea(p, classOf, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, a = p.area, w = p.words;
  const place = `${w.area}${a.name}`, prov = provinceName(a.province);
  const rankText = p.rank ? `อันดับ ${num(p.rank)} จาก ${num(p.rankOf)} ทั่วประเทศ${p.rankProvince && p.rankProvinceOf > 1 ? ` · ${num(p.rankProvince)} จาก ${num(p.rankProvinceOf)} ใน${prov}` : ''}` : '';
  const listLimit = 30;
  const head = `<section class="detail-head">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${esc(w.area)} · <button type="button" class="link-button" data-action="select-province" data-id="${esc(a.province)}">${esc(prov)}</button>${rankText ? ` · ${esc(rankText)}` : ''}</p>
      <h2>${esc(place)}</h2>${a.nameEn ? `<p class="subtle">${esc(a.nameEn)}</p>` : ''}
      <div class="metrics compact">${metricTile(p.count, unit.one, 'store')}${metricTile(p.brandCount, 'แบรนด์', 'brand')}${metricTile(p.count ? pct(p.family.studio, p.count) : '—', 'สตูดิโอ', 'segment')}${metricTile(p.count && p.provincePlaced ? pct(p.count, p.provincePlaced) : '—', `ของ${prov}`, 'province')}</div>
      ${selectionNote(p, place, ctx)}
      ${p.count && p.provincePlaced ? `<p class="hint">${pct(p.count, p.provincePlaced)} = ${nw(`${num(p.count)} จาก ${num(p.provincePlaced)} ${esc(unit.one)}`)}ใน${esc(prov)}ที่ระบุ${esc(w.area)}ได้ · สตูดิโอ = เทรนนิ่ง/PT พิลาทิส คลาสบูทีค โยคะ มวย ปีนผา</p>` : ''}
      ${actionBar({kind: 'area', area: {place, province: prov}})}
      <div class="detail-actions">${p.count ? '<button type="button" class="btn" data-action="open-table">ดูรายชื่อ</button><button type="button" class="btn quiet" data-action="open-charts">เปรียบเทียบพื้นที่</button>' : ''}${link(productionLink({province: a.province, area: a.id}), 'ดูใน CityMETER', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `${place} ${prov} (ขอบเขต CityMETER)`;
  if (!p.count) return `${head}${provenance(ctx, boundary)}`;
  const venues = p.venues.length ? `<section class="panel-section"><div class="section-heading">${heading('venue', 'ศูนย์การค้า')}<span class="hint">${num(p.venues.length)}</span></div>
      <ul class="outlet-list">${p.venues.map(v => `<li><button type="button" class="brand-row" data-action="select-venue" data-id="${esc(v.venue.id)}">${venueLogoMarkup(v.venue, {size: 'sm', className: 'row-logo'}) || `<i class="pictogram pic-venue row-pic" aria-hidden="true"></i>`}<span class="row-text"><strong>${esc(v.venue.name)}</strong><span class="row-meta">${num(v.count)} ${esc(unit.one)}${v.venue.nameTh ? ` · ${esc(v.venue.nameTh)}` : ''}</span></span></button></li>`).join('')}</ul></section>` : '';
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('brand', 'แบรนด์')}<span class="hint">${num(p.brands.length)}</span></div>${brandChips(p.brands, unit)}</section>
    <section class="panel-section"><div class="section-heading">${heading('segment', 'รูปแบบ')}<span class="hint">${esc(unit.one)}</span></div>${groupBars(p.byGroup, p.count, unit)}</section>
    ${venues}
    <section class="panel-section"><div class="section-heading">${heading('store', unit.mode === 'listed' ? 'สาขา' : 'รายการ')}<span class="hint">${num(p.count)}</span></div>${storeList(p.rows.slice(0, listLimit), {unit})}
      ${p.count > listLimit ? `<p class="hint">แสดง ${num(listLimit)} จาก ${num(p.count)} ${esc(unit.one)} · <button type="button" class="link-button" data-action="open-table">ดูทั้งหมดในตาราง</button></p>` : ''}</section>
    ${provenance(ctx, boundary)}`;
}

/* ---------- Venue (CityMETER Shopping Center registry) ---------- */

export function renderVenue(p, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, v = p.venue;
  const prov = p.area ? provinceName(p.area.province) : '';
  const point = Number.isFinite(v.latitude) && Number.isFinite(v.longitude) ? {lat: v.latitude, lon: v.longitude, role: 'host'} : null;
  const head = `<section class="detail-head venue">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity">${venueLogoMarkup(v, {size: 'lg', decorative: false}) || '<i class="pictogram pic-venue identity-pic" aria-hidden="true"></i>'}<div>
        <p class="eyebrow">ศูนย์การค้า${p.area ? ` · <button type="button" class="link-button" data-action="select-area" data-id="${esc(p.area.id)}">${esc(placeName(p.area))}</button> · ${esc(prov)}` : ''}</p>
        <h2>${esc(v.name)}</h2>${v.nameTh ? `<p class="subtle">${esc(v.nameTh)}</p>` : ''}</div></div>
      <div class="metrics compact">${metricTile(p.count, unit.one, 'store')}${metricTile(p.brandCount, 'แบรนด์', 'brand')}</div>
      ${brandStrip(p.rows)}
      <p class="hint">${p.inBuilding ? `${esc(unit.one)}ที่ผูกกับศูนย์การค้านี้ และที่จุดตกในอาคารเดียวกัน` : `${esc(unit.one)}ที่ชุดข้อมูลผูกกับศูนย์การค้านี้`}${p.all > p.linked ? ` · ผูกไว้ทุกสถานะ ${num(p.all)} รายการ` : ''}</p>
      ${actionBar({kind: 'venue', venue: v, area: p.area ? {place: placeName(p.area), province: prov} : null, point})}
      <div class="detail-actions">${v.scId ? link(`${SHOPPING_SITE}?venue=${encodeURIComponent(v.scId)}`, 'ดูศูนย์นี้ใน CityMETER ศูนย์การค้า', 'btn quiet source-link') : ''}${p.area ? link(productionLink({province: p.area.province, area: p.area.id}), 'ดูเขตนี้ใน CityMETER', 'btn quiet source-link') : ''}</div>
    </section>
`;
  const boundary = point
    ? `${v.name} · ตำแหน่งจากทะเบียนศูนย์การค้า CityMETER ${v.scId || ''}${p.building ? ' และอาคาร OpenStreetMap ที่ตำแหน่งนั้นตก' : ''}`.replace(/\s+$/, '')
    : `${v.name} · ทะเบียนศูนย์การค้า CityMETER ${v.scId || ''} (ทะเบียนยังไม่มีตำแหน่ง${p.areaFromRows ? ' — พื้นที่ตามสาขาที่ผูก' : ''})`;
  if (!p.count) return `${head}<div class="empty-note" role="note"><strong>ไม่พบ${esc(unit.subject)}ที่ผูกกับศูนย์การค้านี้หรือในอาคารเดียวกันตามตัวกรอง</strong></div>${provenance(ctx, boundary)}`;
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('store', unit.mode === 'listed' ? 'สาขา' : 'รายการ')}<span class="hint">${num(p.count)}</span></div>${storeList(p.rows, {unit})}</section>
    <section class="panel-section"><div class="section-heading">${heading('segment', 'รูปแบบ')}</div>${groupBars(p.byGroup, p.count, unit)}</section>
    ${provenance(ctx, boundary)}`;
}

/* ---------- Building (display-time spatial join) ---------- */

export function renderBuilding(b, ctx = {}) {
  if (!b) return '';
  const unit = ctx.unit, w = b.words;
  const area = b.area ? `${w.area}${b.area.name}` : '';
  const height = b.height != null ? `สูงราว ${num(Math.round(b.height))} ม. (OpenStreetMap)` : '';
  const withPoint = b.rows.find(hasPoint);
  return `<section class="detail-head building">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow"><i class="pictogram pic-building" aria-hidden="true"></i> อาคารบนแผนที่${b.area ? ` · <button type="button" class="link-button" data-action="select-area" data-id="${esc(b.area.id)}">${esc(area)}</button>` : ''}${height ? ` · ${esc(height)}` : ''}</p>
      <h2>${unit.mode === 'listed' ? 'สาขา' : 'รายการ'}ที่จุดตกในอาคารนี้</h2>
      <div class="metrics compact">${metricTile(b.count, unit.one, 'store')}${metricTile(b.brandCount, 'แบรนด์', 'brand')}</div>
      ${brandStrip(b.rows)}
      ${actionBar({kind: 'building', rows: b.rows, area: b.area ? {place: area, province: provinceName(b.area.province)} : null,
        point: withPoint ? {lat: withPoint.latitude, lon: withPoint.longitude, role: withPoint.pointRole === 'host_registry_reference_point' ? 'host' : 'point'} : null})}
    </section>
    <section class="panel-section"><div class="section-heading">${heading('store', unit.mode === 'listed' ? 'สาขา' : 'รายการ')}<span class="hint">${num(b.count)}</span></div>${storeList(b.rows.slice(0, 40), {showArea: b.areaCount > 1, index: ctx.index, unit})}
      ${b.count > 40 ? `<p class="hint">แสดง ${num(40)} จาก ${num(b.count)} · ดูทั้งหมดในตาราง</p>` : ''}</section>
    <section class="panel-section"><div class="section-heading">${heading('segment', 'รูปแบบ')}</div>${groupBars(b.byGroup, b.count, unit)}</section>
    ${provenance(ctx, `จุดของสาขาที่ตกในขอบอาคาร OpenStreetMap หนึ่งหลัง${area ? ` · ${area} (ขอบเขต CityMETER)` : ''}`)}`;
}

/* ---------- Store (branch) ---------- */

export function renderStore(d, ctx = {}) {
  if (!d) return '';
  const unit = ctx.unit, r = d.row, w = d.words;
  const brandName = r.brand?.name || r.name || 'ไม่มีชื่อในแหล่งข้อมูล', branch = branchLabel(r);
  const prov = provinceName(r.province);
  const coords = hasPoint(r) ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : '';
  const host = r.pointRole === 'host_registry_reference_point';
  const areaChip = d.area
    ? `<button type="button" class="fact-chip" data-action="select-area" data-id="${esc(d.area.id)}"><i class="pictogram pic-area" aria-hidden="true"></i>${esc(w.area)}${esc(d.area.name)} · ${esc(prov)}</button>`
    : r.province ? `<button type="button" class="fact-chip" data-action="select-province" data-id="${esc(r.province)}"><i class="pictogram pic-province" aria-hidden="true"></i>${esc(prov)} · ระบุได้แค่จังหวัด</button>` : '<span class="fact-chip is-quiet">ไม่ระบุจังหวัด</span>';
  const venueChip = r.venue
    ? (Number.isFinite(r.venue.latitude) ? `<button type="button" class="fact-chip" data-action="select-venue" data-id="${esc(r.venue.id)}">${venueLogoMarkup(r.venue, {size: 'xs'}) || '<i class="pictogram pic-venue" aria-hidden="true"></i>'}${esc(r.venue.name)}</button>`
      : `<span class="fact-chip">${venueLogoMarkup(r.venue, {size: 'xs'}) || '<i class="pictogram pic-venue" aria-hidden="true"></i>'}${esc(r.venue.name)}</span>`) : '';
  // The building the point falls in: a CityMETER venue's building opens the venue (one list for the building).
  const bd = d.building;
  const buildingChip = !bd ? ''
    : bd.venue && bd.venue.id !== r.venue?.id ? `<button type="button" class="fact-chip" data-action="select-venue" data-id="${esc(bd.venue.id)}"><i class="pictogram pic-building" aria-hidden="true"></i>จุดตกในอาคารเดียวกับ ${esc(bd.venue.name)}${bd.others ? ` · อีก ${num(bd.others)} ${esc(unit.one)}ในอาคารนี้` : ''}</button>`
    : bd.venue ? (bd.others ? `<button type="button" class="fact-chip" data-action="select-venue" data-id="${esc(bd.venue.id)}"><i class="pictogram pic-building" aria-hidden="true"></i>อีก ${num(bd.others)} ${esc(unit.one)}ในอาคารนี้</button>` : '')
    : bd.others ? `<button type="button" class="fact-chip" data-action="select-building" data-id="${esc(bd.key)}"><i class="pictogram pic-building" aria-hidden="true"></i>จุดตกในอาคารเดียวกับอีก ${num(bd.others)} ${esc(unit.one)}</button>` : '';
  const ownerHost = r.ownerHost && host
    ? `<br><span class="hint">เจ้าของข้อมูลยืนยัน ${esc(thaiDate(r.ownerHost.on))} ว่าสาขาอยู่ใน ${esc(r.venue?.name || 'ศูนย์การค้านี้')}${r.ownerHost.sourcePointM ? ` · จุดที่หน้าทางการเผยแพร่ห่าง ${num(r.ownerHost.sourcePointM)} ม. จึงไม่ใช้` : ''}</span>` : '';
  const point = coords
    ? `<span class="data-number">${esc(coords)}</span><br><span class="hint">${esc(POINT_ROLE_TH[r.pointRole] || 'จุดที่แหล่งเผยแพร่')}</span>${ownerHost}`
    : '<span>แหล่งไม่เผยแพร่พิกัด</span><br><span class="hint">จึงไม่มีหมุดบนแผนที่ สาขายังนับอยู่ในพื้นที่ตามที่อยู่</span>';
  const statusUrl = r.statusUrl && r.statusUrl !== r.url ? ` · ${link(r.statusUrl, 'หน้าที่ระบุสถานะ')}` : '';
  return `<section class="detail-head store">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity">${brandLogoMarkup(r.brand, {size: 'lg', decorative: false})}<div>
        <p class="eyebrow eyebrow-cue">${cueMarkup(r.series)}${esc(d.group?.th || '')}${r.segmentTh && r.segmentTh !== d.group?.th ? ` · ${esc(r.segmentTh)}` : ''}</p>
        <h2>${r.brand ? `<button type="button" class="link-button title-link" data-action="filter-brand" data-value="${esc(r.brand.id)}" title="ดูทุกสาขาของแบรนด์นี้">${esc(brandName)}</button>` : esc(brandName)}</h2>
        ${branch ? `<p class="branch-name">${esc(branch)}</p>` : ''}</div></div>
      <p class="store-status">${statusPill(r.status, r.statusRaw)}${r.url ? ` ${link(r.url, 'หน้าแหล่งทางการ', 'source-link chip-link')}` : ''}</p>
      <div class="fact-chips">${areaChip}${venueChip}${buildingChip}${coords ? '' : '<span class="fact-chip is-quiet" title="แหล่งไม่เผยแพร่พิกัด จึงไม่มีหมุดบนแผนที่">ไม่มีพิกัดจากแหล่ง</span>'}</div>
      ${actionBar({kind: 'store', row: r, area: d.area ? {place: `${w.area}${d.area.name}`, province: prov} : r.province ? {place: '', province: prov} : null,
        point: hasPoint(r) ? {lat: r.latitude, lon: r.longitude, role: host ? 'host' : 'point'} : null})}
      <details class="source-details"><summary>แหล่ง สถานะ และพิกัด</summary>
        <dl class="facts">
          <dt>สถานะ</dt><dd>${esc(STATUS_RAW_TH[r.statusRaw] || STATUS_TH[r.status] || '')}${statusUrl}</dd>
          <dt>พื้นที่</dt><dd>${esc(ADMIN_TH[r.admin] || '')}</dd>
          <dt>พิกัด</dt><dd>${point}</dd>
          <dt>แหล่ง</dt><dd>${esc(SOURCE_TYPE_TH[r.sourceType] || 'แหล่งทางการ')} · ตรวจ ${esc(thaiDate(r.checked))}<br><span class="hint data-number" title="รหัสสาขาในชุดข้อมูลนี้">รหัส ${esc(r.id)}</span></dd>
        </dl>
        <p class="links">${d.area ? link(productionLink({province: r.province, area: r.area}), 'ดูพื้นที่นี้ใน CityMETER') : ''}</p>
      </details>
    </section>
    ${r.brand ? `<section class="panel-section"><div class="section-heading">${heading('brand', `${unit.mode === 'listed' ? 'สาขา' : 'รายการ'}อื่นของ ${r.brand.name}`)}<span class="hint">${num(d.sameBrand.count)} · ${num(d.sameBrand.areas)} เขต/อำเภอ</span></div>
      ${d.sameBrand.rows.length ? storeList(d.sameBrand.rows, {showArea: true, index: ctx.index, unit}) : '<p class="hint">ไม่มีในตัวกรองนี้</p>'}
      ${d.sameBrand.count > d.sameBrand.rows.length ? `<p class="hint">แสดง ${num(d.sameBrand.rows.length)} จาก ${num(d.sameBrand.count)} ${esc(unit.one)} · <button type="button" class="link-button" data-action="filter-brand" data-value="${esc(r.brand.id)}">ดูเฉพาะแบรนด์นี้</button></p>` : ''}</section>` : ''}
    ${d.sameArea.count ? `<section class="panel-section"><div class="section-heading">${heading('area', `${unit.mode === 'listed' ? 'สาขา' : 'รายการ'}อื่นใน${w.area}นี้`)}<span class="hint">${num(d.sameArea.count)}</span></div>${storeList(d.sameArea.rows, {unit})}
      ${d.sameArea.count > d.sameArea.rows.length ? `<p class="hint">แสดง ${num(d.sameArea.rows.length)} จาก ${num(d.sameArea.count)} ${esc(unit.one)} · <button type="button" class="link-button" data-action="select-area" data-id="${esc(d.area.id)}">ดู${esc(w.area)}นี้</button></p>` : ''}</section>` : ''}
    ${provenance(ctx, d.area ? `${w.area}${d.area.name} ${prov} (ขอบเขต CityMETER)` : prov || 'ไม่ระบุจังหวัด')}`;
}

/* ---------- Active filter chips ---------- */

export function renderFilterChips(values, labels) {
  const chips = [];
  const push = (key, text) => chips.push(`<li><button type="button" class="filter-chip" data-action="clear-filter" data-id="${esc(key)}" aria-label="ล้างตัวกรอง ${esc(text)}"><span>${esc(text)}</span><i aria-hidden="true">×</i></button></li>`);
  if (values.search) push('search', `ค้นหา “${values.search}”`);
  if (values.status) push('status', values.status === 'all' ? 'ทุกสถานะ' : STATUS_TH[values.status] || values.status);
  if (values.group) push('group', labels.group[values.group] || values.group);
  if (values.province) push('province', labels.province[values.province] || values.province);
  if (values.brand) push('brand', labels.brand[values.brand] || values.brand);
  return chips.length ? `<ul class="filter-chips" aria-label="ตัวกรองที่ใช้อยู่">${chips.join('')}<li><button type="button" class="filter-chip clear-all" data-action="clear-filter" data-id="all">ล้างทั้งหมด</button></li></ul>` : '';
}
