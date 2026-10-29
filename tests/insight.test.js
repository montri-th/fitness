import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {summarizeAreaInsight, filterAreaRows} from '../js/area-insight.js';
import {summarizeAreas, levelWords, byCount, areaLabel} from '../js/areas.js';
import {filterRows} from '../js/model.js';
import {buildAreaModel} from '../js/map-layers.js';
import {buildProvinceModel} from '../js/provinces.js';

test('first Aha (snapshot fixture): the three เขต with the most listed branches in the province holding the most placed branches', () => {
  const {data, index, listed} = load();
  const i = summarizeAreaInsight(filterRows(data.rows, {}), index);
  assert.equal(i.mode, 'count');
  assert.equal(i.home, 'BKK');
  assert.deepEqual(i.areaIds, ['1039', '1007', '1033'], 'วัฒนา · ปทุมวัน · คลองเตย');
  assert.deepEqual(i.areas.map(a => a.count), [21, 19, 16]);
  assert.equal(i.count, 56);
  // Denominator: the leading province's branches that carry a district; the rest are stated apart.
  assert.equal(i.homeRows, 186);
  assert.equal(i.homePlaced, 147);
  assert.equal(i.homeUnplaced, 39);
  assert.ok(Math.abs(i.share - (56 / 147) * 100) < 1e-9);
  assert.equal(Math.round(i.share), 38);
  // Personality: studio formats among the focus vs the rest of the province's placed rows.
  assert.deepEqual(i.studio, {focus: 35, focusTotal: 56, rest: 28, restTotal: 91, focusShare: (35 / 56) * 100, restShare: (28 / 91) * 100});
  // Second finding: the district with the most branches outside the leading province.
  assert.deepEqual(i.outside, {id: '8301', name: 'เมืองภูเก็ต', province: 'PKT', count: 17, tied: [{id: '8301', name: 'เมืองภูเก็ต', province: 'PKT'}]});
  assert.equal(i.spread, null);
  assert.equal(i.totalRows, 352);
  assert.equal(i.placedRows, 252);
  // The leading province holds the most placed rows; the three are the top of it by count (ties: brands, name).
  const placed = new Map();
  for (const r of listed) if (r.area) placed.set(r.province, (placed.get(r.province) || 0) + 1);
  assert.equal([...placed].sort((a, b) => b[1] - a[1])[0][0], 'BKK');
  const ranked = summarizeAreas(listed, index).sort(byCount);
  assert.deepEqual(ranked.filter(a => a.province === 'BKK').slice(0, 3).map(a => a.id), i.areaIds);
  assert.equal(ranked[0].id, '1039', 'the leader is the district with the most branches in the country');
  assert.equal(filterAreaRows(listed, new Set(i.areaIds)).length, i.count);
});

test('the focus never cuts through a tie; a province where every district holds the same number is “spread”', () => {
  const {data, index} = load();
  const brand = name => filterRows(data.rows, {brand: data.brands.find(b => b.name === name).id});
  // Jetts: ปทุมวัน 5, then several Bangkok districts with 2 — only the district above the tie is the focus.
  const j = summarizeAreaInsight(brand('Jetts'), index);
  assert.equal(j.home, 'BKK');
  assert.deepEqual(j.areas.map(a => [a.name, a.count]), [['ปทุมวัน', 5]]);
  assert.deepEqual([j.count, j.homePlaced], [5, 27]);
  assert.deepEqual([j.outside.count, j.outside.tied.map(a => a.name)], [2, ['บางกรวย', 'ปากเกร็ด', 'เมืองเชียงใหม่', 'เมืองนครราชสีมา', 'เมืองภูเก็ต']], 'every district tied at the top outside count');
  // Fitness First: one branch in each of 11 Bangkok districts — no focus, a spread finding.
  const ff = summarizeAreaInsight(brand('Fitness First'), index);
  assert.deepEqual(ff.areas, []);
  assert.deepEqual(ff.spread, {areas: 11, count: 1});
  assert.equal(ff.homeAreaIds.length, 11);
  // No district after the cut: the ranking is kept as is.
  const pkt = summarizeAreaInsight(filterRows(data.rows, {province: 'PKT'}), index);
  assert.deepEqual(pkt.areas.map(a => [a.name, a.count]), [['เมืองภูเก็ต', 17], ['ถลาง', 6]], 'only two Phuket districts hold a listed branch');
});

test('the Aha follows the filters: every status, a province, nothing', () => {
  const {data, index} = load();
  const all = summarizeAreaInsight(filterRows(data.rows, {status: 'all'}), index);
  assert.deepEqual(all.areas.map(a => [a.name, a.count]), [['วัฒนา', 23], ['ปทุมวัน', 20], ['คลองเตย', 16]]);
  const pkt = summarizeAreaInsight(filterRows(data.rows, {province: 'PKT'}), index);
  assert.equal(pkt.home, 'PKT');
  assert.equal(pkt.homePlaced + pkt.homeUnplaced, 25);
  assert.equal(pkt.areas[0].name, 'เมืองภูเก็ต');
  assert.equal(pkt.outside, null, 'a one-province selection has no outside finding');
  const none = summarizeAreaInsight([], index);
  assert.equal(none.areas.length, 0);
  assert.equal(none.share, 0);
});

test('district model: EVID-05 — every district is in the research scope, so an empty one is a measured zero, never no data', () => {
  const {data, index} = load();
  const rows = filterRows(data.rows, {});
  const all = buildAreaModel(rows, index);
  assert.equal(all.areas.length, 928);
  assert.equal(all.noDataCount, 0);
  assert.equal(all.zeroCount, 928 - 71, '71 districts hold at least one listed branch');
  assert.ok(all.areas.filter(a => a.state === 'measured_zero').every(a => a.count === 0 && a.fill === all.classes.zero.fill));
  assert.equal(all.classes.scaleId, 'count');
  assert.equal(all.classes.method, 'geometric-1-2-5');
  assert.deepEqual(all.classes.classes.map(c => c.label), ['1', '2–4', '5–9', '10–21']);
  const bkk = buildAreaModel(rows, index, {province: 'BKK'});
  assert.equal(bkk.areas.length, 50, 'Bangkok has 50 เขต frames');
  assert.equal(bkk.zeroCount, 14);
  const uncovered = new Set(['1001']);
  assert.equal(buildAreaModel(rows, index, {province: 'BKK', noDataIds: uncovered}).byId.get('1001').state, 'no_data', 'the no_data treatment stays available');
});

test('province frames count rows per province (a total) in the current unit; rows without a province are on no frame', () => {
  const {data, provincesGeo} = load();
  const rows = filterRows(data.rows, {});
  const m = buildProvinceModel(rows, provincesGeo);
  assert.equal(m.provinces.length, 77);
  const by = new Map();
  for (const r of rows) if (r.province) by.set(r.province, (by.get(r.province) || 0) + 1);
  for (const p of m.provinces) assert.equal(p.count, by.get(p.code) || 0, p.code);
  assert.equal(m.provinces.reduce((s, p) => s + p.count, 0), 303, '352 listed − 49 without a province');
  assert.equal(m.classes.scaleId, 'count');
  assert.equal(m.zeroCount, 77 - 23);
  const none = buildProvinceModel([], provincesGeo);
  assert.ok(none.provinces.every(p => p.state === 'measured_zero'));
});

test('level words follow the province: เขต in Bangkok, อำเภอ elsewhere', () => {
  const {index} = load();
  assert.deepEqual(levelWords('BKK'), {area: 'เขต'});
  assert.deepEqual(levelWords('PKT'), {area: 'อำเภอ'});
  assert.equal(areaLabel(index.byId.get('1039')), 'เขตวัฒนา');
  assert.equal(areaLabel(index.byId.get('8301')), 'อำเภอเมืองภูเก็ต');
});
