/**
 * First Aha: where fitness branches concentrate — the top เขต/อำเภอ of the leading province — and what kind
 * of places they are.
 *
 * Metric: branches per district (LDS `count` family; a row is one branch observation in the current unit).
 * The research covers a declared set of brands, so the figure is "how many of these brands' branches", never
 * a market size, a capacity or a density per person.
 *
 * One 3D frame: the leading province is the province holding the most rows placed at district level; the
 * Aha shows up to three districts of that province with the most rows (one coherent city scene) and their
 * share of the province's placed rows — numerator and denominator stated. The district with the most rows
 * outside that province is the second finding.
 *
 * Ties: the focus never cuts through a tie. When the district after the last one shown has the same count, only
 * the districts strictly above that count are shown (possibly one, possibly none). With none — every district
 * of the province holds the same number, e.g. a brand with one branch per district — the Aha says the branches
 * are spread (`spread`), not concentrated. The outside finding lists every district tied at its top count.
 *
 * Personality (Luxury Brands' "บุคลิกของย่าน"): the share of studio formats (training, Pilates, boutique
 * classes, yoga, combat, climbing — js/model.js#FAMILY) among the focus rows, against the rest of the same
 * province's placed rows. Both shares are of rows that carry a district; rows placed only at province level
 * are left out of both and their number is stated.
 *
 * Snapshot values in the handoff JSON are regression fixtures, never UI constants.
 */
import {summarizeAreas, byCount} from './areas.js';

export function summarizeAreaInsight(rows = [], index, {limit = 3} = {}) {
  const selected = Array.isArray(rows) ? rows : [];
  const summaries = summarizeAreas(selected, index);
  const ranked = [...summaries].sort(byCount);
  const placedBy = new Map();
  for (const r of selected) if (r.area && r.province) placedBy.set(r.province, (placedBy.get(r.province) || 0) + 1);
  const home = [...placedBy].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] || '';
  const homeRanked = ranked.filter(a => a.province === home);
  let areas = homeRanked.slice(0, limit);
  const cut = homeRanked[limit];
  if (cut && areas.at(-1).count === cut.count) areas = areas.filter(a => a.count > cut.count);
  const spread = !areas.length && homeRanked.length ? {areas: homeRanked.length, count: homeRanked[0].count} : null;
  const ids = new Set(areas.map(a => a.id));
  const count = areas.reduce((s, a) => s + a.count, 0);
  const homeRows = home ? selected.filter(r => r.province === home) : [];
  const homePlaced = homeRows.filter(r => r.area);
  const rest = homePlaced.filter(r => !ids.has(r.area));
  const focusRows = homePlaced.filter(r => ids.has(r.area));
  const studio = list => list.filter(r => r.family === 'studio').length;
  const outsideRanked = ranked.filter(a => a.province !== home);
  const outsideTop = outsideRanked.filter(a => a.count === outsideRanked[0]?.count);
  return {
    mode: 'count', areas, areaIds: areas.map(a => a.id), home, count, spread, homeAreaIds: homeRanked.map(a => a.id),
    homeRows: homeRows.length, homePlaced: homePlaced.length, homeUnplaced: homeRows.length - homePlaced.length,
    share: homePlaced.length ? (count / homePlaced.length) * 100 : 0,
    studio: {focus: studio(focusRows), focusTotal: focusRows.length, rest: studio(rest), restTotal: rest.length,
      focusShare: focusRows.length ? (studio(focusRows) / focusRows.length) * 100 : null, restShare: rest.length ? (studio(rest) / rest.length) * 100 : null},
    totalRows: selected.length, placedRows: selected.filter(r => r.area).length, areaCount: summaries.length,
    outside: outsideTop.length ? {id: outsideTop[0].id, name: outsideTop[0].name, province: outsideTop[0].province, count: outsideTop[0].count,
      tied: outsideTop.map(a => ({id: a.id, name: a.name, province: a.province}))} : null,
  };
}

/** Rows inside a set of district ids (membership = the row's own matched district). */
export function filterAreaRows(rows, areaIdsSet) {
  if (!(areaIdsSet instanceof Set) || !areaIdsSet.size) return [];
  return (Array.isArray(rows) ? rows : []).filter(r => areaIdsSet.has(r.area));
}
