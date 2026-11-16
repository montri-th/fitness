/**
 * What the search box of CityMETER · Fitness knows by name: the entries js/shell/fuzzy.js matches and
 * js/shell/search.js lists (release 0.6.0; owner 2026-11-12 12:05, VERBATIM: “ศึกษาแนวคิดเรื่อง Fuzzy search แล้ว
 * implement กับ demo web ให้ได้ user benefit สูงสุดตาม user intent ในขณะนั้น และตาม product statement”).
 *
 * The product statement asks “สาขาฟิตเนสกระจุกอยู่ตรงไหน และเป็นฟิตเนสแบบไหน”. So a name typed here opens the level
 * that answers it: a province or a เขต/อำเภอ (the branches there), a brand or a format (where it is), a shopping
 * centre (the branches in it), or one branch (its page). The order below is the order among equal matches: places
 * first, as the statement reads an area before a branch; a format before a brand, because a format's name is a word
 * many brands carry (“pilates”).
 *
 * Brand first (INV26): a branch is named by its brand, then its own label (js/ask.js#branchLabel) — the way the page
 * names it everywhere, and the way people type it (“jetts ekkamai”).
 *
 * Pure: entries from the decoded dataset; no DOM, no numbers shown (a row names what it is and where).
 */
import {areaWord} from './areas.js';
import {provinces, STATUS_TH} from './model.js';
import {branchLabel} from './ask.js';
import {PROVINCE_AKA, withoutMueang} from './shell/fuzzy.js';

export const SEARCH_KINDS = Object.freeze([
  {id: 'province', level: 'province', auto: true}, {id: 'area', level: 'district', auto: true},
  {id: 'group', auto: true}, {id: 'brand', auto: true}, {id: 'venue'}, {id: 'store'},
]);
/** Words a name may begin with, or carry, that people add or leave out. */
export const SEARCH_HEADS = Object.freeze(['ฟิตเนส', 'ยิม', 'สตูดิโอ', 'fitness', 'gym', 'studio', 'the']);
/** What to try when nothing is found: the kinds of name this demo knows. */
export const SEARCH_HINT = 'ลองชื่อแบรนด์ สาขา ศูนย์การค้า รูปแบบ เขต/อำเภอ หรือจังหวัด';

/** A branch as the page names it: the brand, then the branch's own label. */
export const storeTitle = r => [r.brand?.name, branchLabel(r)].filter(Boolean).join(' ') || r.name || '';

/** Every entry, the places and filters first, then the shopping centres, then the branches (every status). */
export function* searchEntries({data, index}) {
  const byCode = new Map(provinces().map(p => [p.code, p]));
  for (const p of provinces()) yield {id: p.code, kind: 'province', name: p.th, nameEn: p.en, aka: PROVINCE_AKA[p.th], codes: [p.code, p.dopa], province: p.code};
  const places = new Map(), provinceOnly = new Map();
  const inProvince = code => {
    if (!provinceOnly.has(code)) { const p = byCode.get(code); provinceOnly.set(code, [p?.th, p?.en]); }
    return provinceOnly.get(code);
  };
  for (const a of index.byId.values()) {
    const p = byCode.get(a.province);
    places.set(a.id, [a.name, a.nameEn, p?.th, p?.en]);
    yield {id: a.id, kind: 'area', name: a.name, nameEn: a.nameEn, also: withoutMueang(a.name), codes: [a.id], within: inProvince(a.province), province: a.province, area: a.id};
  }
  for (const g of data.groups) yield {id: g.id, kind: 'group', name: g.th, nameEn: g.en, aka: [g.short]};
  for (const b of data.brands) yield {id: b.id, kind: 'brand', name: b.name, brand: b};
  // A shopping centre is headed by the name the page heads it with; its Thai name finds it too.
  for (const v of data.venues) {
    const a = v.district ? index.byId.get(v.district) : null;
    yield {id: v.id, kind: 'venue', name: v.name, aka: [v.nameTh], within: a ? places.get(a.id) : undefined, province: a?.province || '', area: a?.id || '', venue: v};
  }
  for (const r of data.rows) {
    const where = r.area ? places.get(r.area) : r.province ? inProvince(r.province) : [];
    // A branch is also found with the shopping centre it is in (“fitness first เซ็นทรัล พระราม2”).
    const within = r.venue ? [r.venue.name, r.venue.nameTh, ...where] : where;
    yield {id: r.id, kind: 'store', name: storeTitle(r), within, province: r.province, area: r.area, row: r};
  }
}

/** The line under a name in the list: what it is and where. */
export function searchNote(entry, {index, data}) {
  const province = code => provinces().find(p => p.code === code)?.th || '';
  if (entry.kind === 'province') return 'จังหวัด';
  if (entry.kind === 'area') return [areaWord(entry.province), province(entry.province)].filter(Boolean).join(' · ');
  if (entry.kind === 'brand') return ['แบรนด์', data.groups[entry.brand.groupIndex]?.short].filter(Boolean).join(' · ');
  if (entry.kind === 'group') return 'รูปแบบ';
  if (entry.kind === 'venue') return ['ศูนย์การค้า', index.byId.get(entry.area)?.name, province(entry.province)].filter(Boolean).join(' · ');
  // A branch the source no longer lists as open says so, as its popup does.
  const r = entry.row, a = r.area ? index.byId.get(r.area) : null;
  return [data.groups[r.group]?.short, r.status !== 'listed' ? STATUS_TH[r.status] : '', a?.name, province(r.province)].filter(Boolean).join(' · ');
}
