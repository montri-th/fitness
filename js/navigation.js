/**
 * This demo's navigation on the shared header code: the titles of its controls and its pictogram subset. The
 * nav-7 glyphs and the help dialog are js/shell/navigation.js, the dataset picker js/shell/header.js
 * (citymeter-shell: edit those in every repository at once, js/shell/manifest.json).
 */
import {installNavigation, NAV_GLYPHS, NAV_ICON_CONTRACT} from './shell/navigation.js';
import {installHeader} from './shell/header.js';

export {NAV_GLYPHS, NAV_ICON_CONTRACT};

/**
 * Metric-tile pictograms (test exception approved by the owner 2026-10-22 for the
 * Luxury Brands demo, reused here byte-for-byte; to be registered in LDS if it
 * proves itself). Same family and axes as nav-7, a separate subset so the
 * approved nav-7 bytes stay unchanged. Glyph → meaning in Fitness:
 * brand (diamond) = แบรนด์ · store (storefront) = สาขา · area (map) = เขต/อำเภอ ·
 * province (location_city) = จังหวัด · segment (category) = รูปแบบ · venue (local_mall) =
 * ศูนย์การค้า. exclusive (star) is not used (it would read as a rating); gla (square_foot) is
 * not used (no per-area ratio is drawn).
 */
export const PICTOGRAM_CONTRACT = Object.freeze({
  family: 'LDS Material Symbols Rounded Pictogram',
  file: 'assets/icons/material-pictogram-300.woff2', bytes: 2120,
  sha256: '73ec48664ed89caf4bdb420c5129637dc57d0820b11e6eb49ed6537dbef7dac3',
  manifest: 'assets/icons/material-pictogram-300.json',
  axes: Object.freeze({FILL: 0, wght: 300, GRAD: 0, opsz: 24}),
  glyphs: Object.freeze({brand: '\uEAD5', store: '\uEA12', venue: '\uE54C', area: '\uE55B', province: '\uE7F1', exclusive: '\uF09A', gla: '\uEA49', segment: '\uE72C',
    ai: '\uE65F', streetview: '\uE56E', maps: '\uE0C8', building: '\uEA40'}),
  status: 'test exception to LDS nav-7 (owner 2026-10-22; action and building glyphs added 2026-10-29)',
  fallback: 'Text labels carry the meaning; pictograms stay hidden until the font has loaded.',
});
const TITLES = {
  'fit-map': 'ปรับแผนที่ให้เห็นพื้นที่ที่โฟกัสหรือพื้นที่ที่เลือก',
  'country-map': 'ดูทั้งประเทศ: กรอบจังหวัดแสดงจำนวนสาขา ทุกพื้นที่มีสี (ล้างตัวกรองจังหวัดและโฟกัส)',
  'toggle-3d': 'สลับมุมมอง 3 มิติ (อาคารทั้งเมือง) กับแผนผัง 2 มิติ',
  'toggle-neighborhoods': 'แสดงหรือซ่อนสีและขอบเขตเขต/อำเภอ',
  'mobile-panel': 'เปิดแผงข้อมูลและตัวกรอง',
  'open-help': 'เปิดวิธีใช้',
  'open-help-sheet': 'เปิดวิธีใช้',
  'toggle-insights': 'เปิดหรือย่อกราฟเปรียบเทียบพื้นที่',
  'open-table': 'เปิดตารางสาขาตามตัวกรอง',
  'toggle-table': 'ปิดตารางและกลับไปแผนที่',
  'search': 'ค้นหาชื่อสาขา แบรนด์ ศูนย์การค้า เขต/อำเภอ หรือจังหวัด',
  'group': 'กรองตามรูปแบบ (จัดกลุ่มจากประเภทในชีตวิจัย)',
  'status': 'สถานะตามแหล่งทางการ ณ วันตรวจ: เปิดตามแหล่ง (ค่าเริ่มต้น) ประกาศเปิด ปิดแล้ว หรือต้องตรวจสถานะ',
  'province': 'กรองตามจังหวัด',
  'brand': 'กรองตามแบรนด์ (เปิดข้อมูลบริษัทของแบรนด์ด้วย)',
  'prev-page': 'ดูหน้าก่อนหน้าของตาราง',
  'next-page': 'ดูหน้าถัดไปของตาราง',
  'tab-count': 'เปรียบเทียบจำนวนสาขาของแต่ละเขต/อำเภอ',
  'tab-mix': 'ดูรูปแบบในแต่ละเขต/อำเภอ',
  'tab-brands': 'เปรียบเทียบจำนวนสาขาของแต่ละแบรนด์',
};

if (typeof document !== 'undefined') {
  installNavigation({titles: TITLES, pictogramProbe: PICTOGRAM_CONTRACT.glyphs.store});
  installHeader();
}
