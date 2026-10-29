/**
 * Reading-panel view models. Pure: no DOM, no map.
 *
 * Every profile reads `scopeRows` (filters before any area selection) so ranks and comparisons keep the
 * whole selection as reference. A row is one branch observation of the research master (02_STORES); the
 * default unit counts rows whose source still lists the service (“สาขา”). Brand and company links are the
 * sheet's own ids (01_BRANDS, 11_COMPANIES, 12_RELATIONSHIPS); names are never used to join. Points are
 * published source points or a CityMETER venue's registry reference point and are never upgraded; district
 * membership is the matched production code (row.admin says how).
 */
import {mixOf, hasPoint} from './model.js';
import {summarizeAreas, byCount, levelWords} from './areas.js';

const COLLATOR = new Intl.Collator('th');
/** Lists: by brand, then branch name — a neutral, stable order (no size or popularity data exists). */
export const listOrder = (a, b) => COLLATOR.compare(a.brand?.name || '', b.brand?.name || '') || COLLATOR.compare(a.name, b.name) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Brands present in rows, most rows first. */
export function brandsIn(rows, limit = 12) {
  const m = new Map();
  for (const r of rows) if (r.brand) { const e = m.get(r.brand.id) || {brand: r.brand, count: 0}; e.count++; m.set(r.brand.id, e); }
  return [...m.values()].sort((a, b) => b.count - a.count || COLLATOR.compare(a.brand.name, b.brand.name)).slice(0, limit);
}

/** Distinct brands among rows (a total, never the length of a cut list). */
export const distinctBrands = rows => new Set(rows.map(r => r.brand?.id).filter(Boolean)).size;

/** Districts of a selection ranked by count (ties: distinct brands, then name). */
export function rankAreas(rows, index, {province = ''} = {}) {
  return summarizeAreas(rows, index, {province}).sort(byCount);
}

/** Rows of the selection that no district holds, by reason (rows are never placed by name). */
export function unplacedOf(rows) {
  let noArea = 0, noProvince = 0, conflict = 0;
  for (const r of rows) {
    if (r.area) continue;
    if (r.admin === 'conflict') conflict++;
    else if (r.province) noArea++;
    else noProvince++;
  }
  return {noArea, noProvince, conflict, total: noArea + noProvince + conflict};
}

export function buildOverview(scopeRows, index, {province = '', groups = []} = {}) {
  return {ranking: rankAreas(scopeRows, index, {province}), brands: brandsIn(scopeRows, 12), unplaced: unplacedOf(scopeRows),
    mix: mixOf(scopeRows, groups), count: scopeRows.length};
}

/**
 * EVID-05 state of a selection: every district is in the research scope, so a district with no row is a
 * measured zero of this dataset (“0 ที่พบ” — none of the brands lists a branch there), never no_data.
 */
const selectionState = count => (count ? 'measured' : 'measured_zero');

export function buildAreaProfile(scopeRows, areaId, index, groups, venues = []) {
  const area = index.byId.get(areaId);
  if (!area) return null;
  const ranking = rankAreas(scopeRows, index);
  const inProvince = ranking.filter(a => a.province === area.province);
  const mine = scopeRows.filter(r => r.area === areaId);
  const provincePlaced = scopeRows.filter(r => r.province === area.province && r.area).length;
  const pos = ranking.findIndex(a => a.id === areaId);
  const posProvince = inProvince.findIndex(a => a.id === areaId);
  return {
    area, words: levelWords(area.province), count: mine.length, km2: area.km2, coverageState: selectionState(mine.length), scopeCount: scopeRows.length,
    rank: pos >= 0 ? pos + 1 : null, rankOf: ranking.length, rankProvince: posProvince >= 0 ? posProvince + 1 : null, rankProvinceOf: inProvince.length,
    provincePlaced, share: provincePlaced ? (mine.length / provincePlaced) * 100 : null,
    points: mine.filter(hasPoint).length, ...mixOf(mine, groups), brands: brandsIn(mine, 40), brandCount: distinctBrands(mine), rows: [...mine].sort(listOrder),
    venues: venues.filter(v => v.district === areaId).map(v => ({venue: v, count: mine.filter(r => r.venue?.id === v.id).length})).filter(v => v.count),
  };
}

/** Thai labels of the relationship roles recorded in 12_RELATIONSHIPS (wording of the sheet, not a legal finding). */
export const ROLE_TH = Object.freeze({
  operator_thailand: 'ผู้ดำเนินงานในไทย', master_franchisee_thailand: 'มาสเตอร์แฟรนไชส์ในไทย', brand_owner: 'เจ้าของแบรนด์',
  brand_rights_owner: 'ผู้ถือสิทธิ์แบรนด์', brand_owner_or_group_entity: 'เจ้าของแบรนด์หรือนิติบุคคลของกลุ่ม', brand_group: 'กลุ่มของแบรนด์',
  parent_group: 'กลุ่มบริษัทแม่', portfolio_brand: 'แบรนด์ในพอร์ตของ', licensor: 'ผู้ให้สิทธิ์ใช้แบรนด์', global_franchise_platform: 'แพลตฟอร์มแฟรนไชส์ระดับโลก',
  company_named_by_official_site: 'บริษัทที่เว็บไซต์ทางการระบุชื่อ', associated_operator_trading_name: 'ชื่อทางการค้าของผู้ดำเนินงานที่เกี่ยวข้อง',
  investor: 'ผู้ลงทุน', investor_in_company: 'ผู้ลงทุนในบริษัท', majority_investor_in_company: 'ผู้ลงทุนรายใหญ่ในบริษัท',
});
const ROLE_ORDER = ['operator_thailand', 'master_franchisee_thailand', 'associated_operator_trading_name', 'company_named_by_official_site', 'brand_owner',
  'brand_rights_owner', 'brand_owner_or_group_entity', 'licensor', 'brand_group', 'parent_group', 'portfolio_brand', 'global_franchise_platform', 'investor'];

/**
 * Companies behind a brand: the relationships recorded for the brand, then — one level up — the recorded
 * relationships OF those companies (investors). Nothing is inferred from a missing record.
 */
export function companiesOf(brand, data) {
  const rels = (data.relationships || []).filter(r => r.objectType === 'brand' && r.object === brand.id)
    .sort((a, b) => ROLE_ORDER.indexOf(a.type) - ROLE_ORDER.indexOf(b.type));
  const direct = rels.map(r => ({...r, company: data.companies.get(r.company) || {id: r.company, name: r.company}}));
  const ids = new Set(direct.map(d => d.company.id));
  const upstream = (data.relationships || []).filter(r => r.objectType === 'company' && ids.has(r.object))
    .map(r => ({...r, company: data.companies.get(r.company) || {id: r.company, name: r.company}, of: data.companies.get(r.object) || {id: r.object, name: r.object}}));
  return {direct, upstream};
}

/** Other brands of this dataset recorded with the same company (id join on 12_RELATIONSHIPS, never by name). */
export function relatedBrands(brand, data) {
  const rels = (data.relationships || []).filter(r => r.objectType === 'brand');
  const mine = new Set(rels.filter(r => r.object === brand.id).map(r => r.company));
  const by = new Map();
  for (const r of rels) {
    if (r.object === brand.id || !mine.has(r.company)) continue;
    const b = data.brands.find(x => x.id === r.object);
    if (!b) continue;
    const e = by.get(b.id) || {brand: b, companies: new Set()};
    e.companies.add(data.companies.get(r.company)?.name || r.company);
    by.set(b.id, e);
  }
  return [...by.values()].map(e => ({brand: e.brand, companies: [...e.companies]})).sort((a, b) => COLLATOR.compare(a.brand.name, b.brand.name));
}

/** Brand card: every row of the brand in the dataset (all statuses), the rows in the scope and where they are. */
export function buildBrandProfile(brandId, {allRows, scopeRows, index, data}) {
  const brand = data.brands.find(b => b.id === brandId);
  if (!brand) return null;
  const rows = allRows.filter(r => r.brand?.id === brandId);
  const byStatus = {listed: 0, announced: 0, closed: 0, review: 0};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const inScope = scopeRows.filter(r => r.brand?.id === brandId);
  const areas = summarizeAreas(inScope, index).sort(byCount);
  const group = data.groups.find(g => g.id === brand.group) || null;
  const segment = data.segments.find(s => s.id === brand.segment) || null;
  return {brand, group, segment, all: rows.length, byStatus, scopeCount: inScope.length, areas,
    provinces: new Set(inScope.map(r => r.province).filter(Boolean)).size,
    points: inScope.filter(hasPoint).length, placed: inScope.filter(r => r.area).length,
    companies: companiesOf(brand, data), related: relatedBrands(brand, data)};
}

/** A CityMETER venue (Shopping Center registry) and the rows the sheet links to it by venue id. */
export function buildVenueProfile(venueId, {allRows, scopeRows, index, groups, data}) {
  const venue = data.venues.find(v => v.id === venueId);
  if (!venue) return null;
  const rows = scopeRows.filter(r => r.venue?.id === venueId).sort(listOrder);
  const all = allRows.filter(r => r.venue?.id === venueId);
  return {venue, area: index.byId.get(venue.district) || null, words: levelWords(index.byId.get(venue.district)?.province || ''),
    rows, count: rows.length, all: all.length, ...mixOf(rows, groups)};
}

/**
 * A building the map draws, with the rows whose points fall inside it (building-join.js):
 * sel = {key, kind: 'osm', rows, height}. Not a venue: no name.
 */
export function buildBuildingProfile(sel, index, groups) {
  if (!sel?.rows?.length) return null;
  const rows = [...sel.rows].sort(listOrder);
  const area = index.byId.get(rows[0].area) || null;
  const areaIds = [...new Set(rows.map(r => r.area))];
  return {key: sel.key, kind: sel.kind || 'osm', rows, count: rows.length, area, areaCount: areaIds.length, words: levelWords(rows[0].province),
    height: Number.isFinite(sel.height) ? sel.height : null, brands: brandsIn(rows, 6), brandCount: distinctBrands(rows), ...mixOf(rows, groups)};
}

/** Store (branch) detail: the other branches of the brand in the scope, and same-format neighbours in the district. */
export function buildStoreDetail(row, {scopeRows, index, groups, building = null}) {
  if (!row) return null;
  const area = row.area ? index.byId.get(row.area) || null : null;
  const sameBrand = row.brand ? scopeRows.filter(r => r.brand?.id === row.brand.id && r.id !== row.id) : [];
  const sameArea = row.area ? scopeRows.filter(r => r.area === row.area && r.id !== row.id).sort(listOrder) : [];
  return {row, area, words: levelWords(row.province), group: groups[row.group], building,
    sameBrand: {count: sameBrand.length, rows: sameBrand.sort(listOrder).slice(0, 8), areas: new Set(sameBrand.map(r => r.area).filter(Boolean)).size},
    sameArea: {count: sameArea.length, rows: sameArea.slice(0, 8), formats: mixOf(sameArea, groups).byGroup.filter(g => g.count).length}};
}
