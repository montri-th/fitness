/**
 * Chart models — every chart describes scopeRows (filters before any area selection) over the same
 * membership as the map (the row's own matched district). Ranking and top-N trimming happen only after every
 * district has been summarised.
 */
import {rankAreas, brandsIn} from './profile-model.js';

export function buildChartModel(rows, index, groups, {limit = 20} = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const ranking = rankAreas(list, index);
  return {areas: ranking.slice(0, limit), totalAreas: ranking.length, counts: ranking.map(a => a.count), groups, totalRows: list.length,
    placedRows: list.filter(r => r.area).length};
}

/** District × format matrix of row counts (equal cells; zero is a measured 0 in this selection). */
export function areaMatrix(model, {areaLimit = 12} = {}) {
  const areas = model.areas.slice(0, areaLimit);
  const groups = model.groups;
  const cells = areas.flatMap(a => {
    const counts = new Array(groups.length).fill(0);
    for (const r of a.rows) counts[r.group]++;
    return groups.map(g => ({areaId: a.id, areaName: a.name, groupId: g.id, group: g.index, groupName: g.th, count: counts[g.index], total: a.count}));
  });
  return {areas, groups, cells, max: Math.max(0, ...cells.map(c => c.count))};
}

/** Brands of the selection ranked by rows (ties by name); every brand counted, the list cut after ranking. */
export function brandRanking(rows, {limit = 20} = {}) {
  const all = brandsIn(Array.isArray(rows) ? rows : [], Infinity);
  return {brands: all.slice(0, limit), total: all.length};
}
