/**
 * Dataset vocabulary, decoding, shared filter and summary helpers.
 *
 * Rows are the branch observations of “CityMETER Fitness Thailand — Research Master 2026-10-26”
 * (data/fitness.json, built by scripts/build-data.py). One row = one row of the sheet's 02_STORES: an
 * official operator page, locator, social profile or announcement naming one branch. Nothing here merges,
 * moves or mutates a row.
 *
 * Counting unit (a contract, see DATA_METHOD.md §2):
 *   listed (default) — rows whose source still lists the service on the check date (source_listed): “สาขา”.
 *   announced · closed · review — counted apart (“รายการ”), never added to the listed figure; `all` shows
 *                      every row of the sheet as “รายการ”.
 * The unit words follow the status filter everywhere (unitWords).
 *
 * Area = the เขต/อำเภอ (DISTRICT) of CityMETER production that the build matched for the row (row.admin says
 * how: point · host · address · province · conflict · none). Points are published source points or the
 * registry reference point of a CityMETER venue; most rows have none and are never given one.
 */
import {seriesOf} from './cues.js';

/** Short labels for tight places (matrix columns); the full Thai label stays in titles, legends and lists. */
export const GROUP_SHORT = Object.freeze({
  gym: 'ยิม', ems: 'EMS', training: 'เทรนนิ่ง', pilates: 'พิลาทิส', boutique: 'บูทีค', yoga: 'โยคะ', combat: 'มวย', climb: 'ปีนผา', special: 'เฉพาะ',
});
/** Format families for the first finding: gyms (club + EMS) vs studios (one discipline or class format). */
export const FAMILY = Object.freeze({gym: 'gym', ems: 'gym', training: 'studio', pilates: 'studio', boutique: 'studio', yoga: 'studio', combat: 'studio', climb: 'studio', special: 'special'});

export const STATUS_TH = Object.freeze({listed: 'เปิดตามแหล่ง', announced: 'ประกาศเปิด', closed: 'ปิดแล้ว', review: 'ต้องตรวจสถานะ'});
export const STATUS_RAW_TH = Object.freeze({
  source_listed: 'แหล่งทางการยังแสดงสาขานี้ ณ วันตรวจ',
  announced_opening_soon: 'แหล่งทางการประกาศว่ากำลังจะเปิด', announced_coming_soon: 'แหล่งทางการประกาศ coming soon',
  announced_presale: 'แหล่งทางการเปิดขายสมาชิกล่วงหน้า (presale)', announced_opening_date_today: 'แหล่งทางการประกาศวันเปิดตรงกับวันตรวจ',
  permanently_closed: 'แหล่งทางการแจ้งปิดถาวร', closed_official: 'แหล่งทางการระบุว่าปิดแล้ว',
  source_status_unknown: 'แหล่งไม่ระบุสถานะชัดเจน', primary_network_listed_location_unresolved: 'อยู่ในรายชื่อเครือข่าย แต่ยังระบุที่ตั้งไม่ได้',
  official_profile_listed_source_conflict: 'หน้าทางการยังแสดง แต่มีแหล่งที่ขัดกัน', primary_listed_detail_refresh_pending: 'อยู่ในรายชื่อทางการ รอตรวจรายละเอียดใหม่',
});

/** Unit words for the status filter ('' = listed). */
export function unitWords(status = '') {
  return !status || status === 'listed'
    ? {one: 'สาขา', subject: 'สาขาฟิตเนสและสตูดิโอ', mode: 'listed'}
    : {one: 'รายการ', subject: status === 'all' ? 'รายการสาขาทุกสถานะ' : `รายการที่${STATUS_TH[status] || ''}`, mode: status};
}

/** Every province of the production base info, keyed by the production route code (/v3/citymeter/{code}). */
let PROVINCE_LIST = [];
export function setProvinces(list) { PROVINCE_LIST = Object.freeze((list || []).map(p => Object.freeze({code: p.id, dopa: p.code, th: p.name, en: p.nameEn}))); }
export const provinces = () => PROVINCE_LIST;
export const provinceByCode = code => PROVINCE_LIST.find(p => p.code === String(code || '').toUpperCase()) || null;
/** Accept a production code (BKK), a DOPA code (10) or an English/Thai name; returns the production code or ''. */
export const provinceCodeFrom = value => {
  const v = String(value || '').trim();
  const p = PROVINCE_LIST.find(x => x.code === v.toUpperCase() || x.dopa === v || x.en.toLowerCase() === v.toLowerCase() || x.th === v);
  return p ? p.code : '';
};

/** A usable coordinate inside Thailand's bounding box (most rows have none — never invented). */
export const hasPoint = r => Number.isFinite(r?.latitude) && Number.isFinite(r?.longitude) &&
  r.latitude >= 5 && r.latitude <= 21 && r.longitude >= 97 && r.longitude <= 106;

const lower = v => String(v || '').toLocaleLowerCase('th-TH');

/**
 * Decode data/fitness.json into row objects plus dictionaries.
 * `index` is the area index (js/areas.js#buildAreaIndex): every placed district code must exist there.
 */
export function decodeDataset(json, index) {
  if (!json?.cols || !Array.isArray(json.cols.key)) throw new Error('Invalid fitness dataset');
  const c = json.cols, n = c.key.length, V = json.vocab || {};
  const groups = (json.groups || []).map((g, i) => ({...g, index: i, series: seriesOf(g.id), short: GROUP_SHORT[g.id] || g.th}));
  const segments = (json.segments || []);
  const companies = new Map((json.companies || []).map(x => [x.id, x]));
  const brands = (json.brands || []).map((b, i) => ({...b, index: i, groupIndex: groups.findIndex(g => g.id === b.group)}));
  const venues = (json.venues || []).map((v, i) => ({...v, index: i}));
  const point = new Map((json.points || []).map(([i, lat, lon, role]) => [i, {lat, lon, role: V.pointRoles?.[role] || ''}]));
  const rows = [];
  let dropped = 0;
  for (let i = 0; i < n; i++) {
    const area = c.district[i] >= 0 ? json.districts[c.district[i]] : '';
    const province = c.province[i] >= 0 ? json.provinces[c.province[i]] : '';
    if (area && !index?.byId.has(area)) { dropped++; continue; }
    const group = groups[c.group[i]] || groups.at(-1);
    const brand = brands[c.brand[i]] || null;
    const venue = c.venue[i] >= 0 ? venues[c.venue[i]] : null;
    const pt = point.get(i) || (venue ? {lat: venue.latitude, lon: venue.longitude, role: 'host_registry_reference_point'} : null);
    const seg = segments[c.segment[i]] || {id: '', th: ''};
    const row = {
      id: c.key[i], name: c.name[i] || '', index: i,
      group: group.index, groupId: group.id, series: group.series, family: FAMILY[group.id] || 'studio', segment: seg.id, segmentTh: seg.th,
      brand, venue,
      status: V.status?.[c.status[i]] || 'listed', statusRaw: V.statusRaw?.[c.statusRaw[i]] || '',
      sourceType: V.sourceTypes?.[c.source[i]] || '', url: c.url[i] >= 0 ? json.urls[c.url[i]] : '', statusUrl: c.statusUrl[i] >= 0 ? json.urls[c.statusUrl[i]] : '',
      checked: c.checked[i] || '',
      area, province, admin: V.admin?.[c.admin[i]] || 'none', how: V.how?.[c.how[i]] || '', words: c.words[i] || '',
      longitude: pt ? pt.lon : null, latitude: pt ? pt.lat : null, pointRole: pt ? pt.role : '',
    };
    const a = area ? index.byId.get(area) : null;
    const p = province ? PROVINCE_LIST.find(x => x.code === province) : null;
    row.haystack = lower([row.name, brand?.name, venue?.name, venue?.nameTh, a?.name, a?.nameEn, p?.th, p?.en, seg.th, group.th].filter(Boolean).join(' '));
    rows.push(row);
  }
  for (const b of brands) {
    b.operatorCo = companies.get(b.operator) || null;
    b.ownerCo = companies.get(b.owner) || null;
    b.parentCo = companies.get(b.parent) || null;
  }
  return {meta: json.meta || {}, rows, groups, brands, venues, segments, companies, relationships: json.relationships || [], dropped};
}

/**
 * Shared filter used by map, counters, charts, panel and table.
 * f = {search, status, group, province, brand}; status '' = listed (default), 'all' = every row.
 * Area selection and area focus are applied by the caller (row scopes, see app.js).
 */
export function filterRows(rows, f = {}) {
  const q = lower(f.search).trim();
  const status = f.status || 'listed';
  return rows.filter(r => {
    if (status !== 'all' && r.status !== status) return false;
    if (f.group && r.groupId !== f.group) return false;
    if (f.province && r.province !== f.province) return false;
    if (f.brand && r.brand?.id !== f.brand) return false;
    return !q || r.haystack.includes(q);
  });
}

/** Counts for a selection (every number is a count of rows in the current unit). */
export function summarize(rows) {
  let points = 0, placed = 0, provinced = 0;
  const brands = new Set(), areas = new Set(), provinces = new Set();
  for (const r of rows) {
    if (hasPoint(r)) points++;
    if (r.area) { placed++; areas.add(r.area); }
    if (r.province) { provinced++; provinces.add(r.province); }
    if (r.brand) brands.add(r.brand.id);
  }
  return {count: rows.length, points, placed, provinced, brands: brands.size, areas: areas.size, provinces: provinces.size};
}

/** Rows per group for a selection (every group listed, zero kept as a measured 0). */
export function mixOf(rows, groups) {
  const byGroup = groups.map(g => ({id: g.id, index: g.index, series: g.series, th: g.th, short: g.short, count: 0}));
  const family = {gym: 0, studio: 0, special: 0};
  for (const r of rows) { byGroup[r.group].count++; family[r.family] = (family[r.family] || 0) + 1; }
  return {byGroup, family};
}

export const safeURL = value => {
  try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; }
  catch { return ''; }
};

/**
 * Production CityMETER deep links (route scheme observed in the production bundle, 2026-10-22). Production has
 * no fitness dataset, so the link opens the same area without a dataset parameter.
 */
export const PRODUCTION = 'https://landometer.com/v3/citymeter';
export function productionLink({province = '', area = ''} = {}) {
  if (!province) return PRODUCTION;
  if (area) return `${PRODUCTION}/${province}/D/${area}`;
  return `${PRODUCTION}/${province}`;
}
