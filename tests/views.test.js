import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {buildOverview, buildAreaProfile, buildStoreDetail, buildBuildingProfile, buildBrandProfile, buildVenueProfile, listOrder, unplacedOf, relatedBrands} from '../js/profile-model.js';
import {renderOverview, renderArea, renderBuilding, renderStore, renderVenue, renderBrandCard, renderFilterChips, provenance, pct, coverageLabel, COVERAGE_TH, SOURCE_TYPE_TH, POINT_ROLE_TH, ADMIN_TH} from '../js/panel.js';
import {summarizeAreaInsight} from '../js/area-insight.js';
import {summarize, productionLink, filterRows, unitWords, hasPoint, STATUS_RAW_TH} from '../js/model.js';
import {buildChartModel, areaMatrix, brandRanking} from '../js/chart-model.js';
import {buildBreadcrumb, renderBreadcrumb, breadcrumbText, productionHref} from '../js/breadcrumb.js';
import {CUES, CUE_PATHS, GROUP_SERIES, cueMarkup, seriesOf} from '../js/cues.js';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const ctxFor = (data, index, mode = 'listed', filtered = false) => ({meta: data.meta, unit: unitWords(mode), index, filtered});
const common = (data, index, rows) => ({allRows: data.rows, scopeRows: rows, index, groups: data.groups, data});
const statusCounts = rows => rows.reduce((m, r) => ({...m, [r.status]: (m[r.status] || 0) + 1}), {listed: 0, announced: 0, closed: 0, review: 0});

test('every panel view ends with dataset · source · date · boundary and says what one counted unit is', () => {
  const {data, index} = load();
  const rows = filterRows(data.rows, {});
  const ctx = ctxFor(data, index);
  const insight = summarizeAreaInsight(rows, index);
  const store = rows.find(r => r.brand && r.area && hasPoint(r));
  const jetts = data.brands.find(b => b.name === 'Jetts');
  const views = {
    overview: renderOverview({insight, summary: summarize(insight.areas.flatMap(a => a.rows)), overview: buildOverview(rows, index, {groups: data.groups}), focusMode: 'auto',
      provinces: [], unknownProvince: 30, province: '', statusCounts: statusCounts(data.rows), ctx}),
    area: renderArea(buildAreaProfile(rows, '1039', index, data.groups, data.venues), () => '#000', ctx),
    store: renderStore(buildStoreDetail(store, common(data, index, rows)), ctx),
    venue: renderVenue(buildVenueProfile(data.venues.find(v => v.name === 'Fifty Fifth Thonglor').id, common(data, index, rows)), ctx),
    building: renderBuilding(buildBuildingProfile({key: 'osm:1', kind: 'osm', rows: rows.filter(r => hasPoint(r)).slice(0, 3), height: 24}, index, data.groups), ctx),
    brand: renderOverview({insight: summarizeAreaInsight(filterRows(data.rows, {brand: jetts.id}), index), summary: summarize(rows), overview: buildOverview(filterRows(data.rows, {brand: jetts.id}), index, {groups: data.groups}),
      focusMode: 'auto', province: '', brandCard: renderBrandCard(buildBrandProfile(jetts.id, common(data, index, filterRows(data.rows, {brand: jetts.id}))), ctx), ctx}),
  };
  for (const [name, html] of Object.entries(views)) {
    const t = text(html);
    assert.ok(t.includes('ชุดข้อมูล CityMETER Fitness'), `${name}: dataset`);
    assert.ok(t.includes('แหล่ง หน้าทางการของแต่ละแบรนด์'), `${name}: source`);
    assert.ok(t.includes('ตรวจ 26 ต.ค. 2569'), `${name}: date`);
    assert.ok(/ขอบเขต \S/.test(t), `${name}: boundary`);
    assert.ok(t.includes('สาขา = สาขาที่หน้าทางการของแบรนด์ยังแสดง ณ วันตรวจ · 126 แบรนด์ในชุดข้อมูล ไม่ใช่ทุกฟิตเนสในประเทศ'), `${name}: unit`);
    assert.equal((html.match(/class="hint panel-foot provenance"/g) || []).length, 1, `${name}: exactly one provenance line`);
    assert.ok(!/ตั้งอยู่ใน|ยอดขาย|ส่วนแบ่งตลาด|ผู้ใช้บริการ/.test(t), `${name}: no located-inside, sales, market-share or footfall claim`);
  }
  const o = text(views.overview);
  assert.ok(o.includes('37% ของสาขาในกรุงเทพมหานครที่ระบุเขตได้ อยู่ใน 3 เขตนี้'), o.slice(0, 300));
  assert.ok(o.includes('62 จาก 167 สาขา') && o.includes('อีก 33 สาขา ในกรุงเทพมหานครระบุได้แค่จังหวัด'), 'numerator, denominator and the unplaced rows');
  assert.ok(o.includes('สตูดิโอ 58% ของสาขาใน 3 เขตนี้ (36/62) · เขตอื่นของกรุงเทพมหานคร 30% (32/105)'), 'the personality comparison states both bases');
  assert.ok(o.includes('นอกกรุงเทพมหานครมากที่สุด: อำเภอเมืองภูเก็ต ภูเก็ต 17 สาขา'));
  assert.ok(o.includes('ไม่รวมในตัวเลข: ประกาศเปิด 19 · ปิดแล้ว 2 · ต้องตรวจสถานะ 5 รายการ'), 'other statuses are counted apart, one click away');
  assert.ok(o.includes('ไม่อยู่ในอันดับ ระบุได้แค่จังหวัด 40 · ไม่ระบุจังหวัด 29 · ข้อมูลจังหวัดขัดกัน 1 สาขา'));
  // Other statuses: the unit word and the provenance clause follow the status.
  assert.ok(text(provenance(ctxFor(data, index, 'announced'), 'x')).includes('รายการ = สาขาที่แหล่งทางการประกาศว่าจะเปิด ณ วันตรวจ · นับแยกจากสาขาที่เปิดตามแหล่ง'));
  assert.ok(text(provenance(ctxFor(data, index, 'all'), 'x')).includes('รายการ = ทุกแถวในชุดข้อมูลทุกสถานะ ไม่ใช่จำนวนสาขาที่เปิด'));
  const a = text(views.area);
  assert.ok(a.includes('เขตวัฒนา') && a.includes('อันดับ 1 จาก 76 ทั่วประเทศ'), a.slice(0, 200));
  assert.ok(a.includes('15% = 25 จาก 167 สาขา ในกรุงเทพมหานครที่ระบุเขตได้'));
});

test('brand card: companies by recorded role with their evidence link, investors one level up, brands of the same company by id', () => {
  const {data, index} = load();
  const ff = data.brands.find(b => b.name === 'Fitness First');
  const p = buildBrandProfile(ff.id, common(data, index, filterRows(data.rows, {brand: ff.id})));
  assert.deepEqual(p.byStatus, {listed: 32, announced: 0, closed: 0, review: 0});
  assert.deepEqual(p.companies.direct.map(c => [c.type, c.company.name]), [['operator_thailand', 'Evolution Wellness (Thailand) Ltd.'], ['brand_owner', 'Evolution Wellness'], ['brand_rights_owner', 'Evolution Wellness']]);
  assert.deepEqual(relatedBrands(ff, data).map(r => r.brand.name), ['Celebrity Fitness']);
  const t = text(renderBrandCard(p, ctxFor(data, index)));
  assert.ok(t.includes('ผู้ดำเนินงานในไทย Evolution Wellness (Thailand) Ltd.'), t);
  assert.ok(t.includes('เจ้าของแบรนด์ · ผู้ถือสิทธิ์แบรนด์ Evolution Wellness'), 'one line per company with all its recorded roles');
  assert.ok(t.includes('ชื่อบริษัทตามที่แหล่งระบุ ยังไม่ได้ตรวจกับทะเบียนนิติบุคคล'));
  assert.ok(t.includes('บริษัทเดียวกัน') && t.includes('Celebrity Fitness'));
  const jetts = data.brands.find(b => b.name === 'Jetts');
  const j = buildBrandProfile(jetts.id, common(data, index, filterRows(data.rows, {brand: jetts.id})));
  assert.deepEqual(j.companies.upstream.map(c => [c.company.name, c.of.name]), [['Quadrant Private Equity', 'Fitness & Lifestyle Group'], ['Oaktree Capital Management', 'Fitness & Lifestyle Group']]);
  assert.ok(text(renderBrandCard(j, ctxFor(data, index))).includes('ผู้ลงทุนที่บันทึก'));
  // A brand without a recorded company says so — never “independent”.
  const lone = data.brands.find(b => !data.relationships.some(r => r.object === b.id));
  const lt = text(renderBrandCard(buildBrandProfile(lone.id, common(data, index, data.rows)), ctxFor(data, index)));
  assert.ok(lt.includes('ยังไม่พบชื่อบริษัทในแหล่งทางการ — ไม่ได้แปลว่าไม่มีบริษัทแม่'));
  assert.ok(!/อิสระ/.test(lt));
  // Every coverage code of the sheet has natural Thai; counts never live in the label.
  for (const b of data.brands) assert.ok(COVERAGE_TH[b.coverage], b.coverage);
  assert.ok(Object.values(COVERAGE_TH).every(v => !/\d/.test(v)));
  assert.equal(coverageLabel('full_something_new'), 'ครบตามแหล่งทางการ');
});

test('missing stays missing: no point, province only, conflict — each says so, never 0 or a guessed place', () => {
  const {data, index} = load();
  const ctx = ctxFor(data, index, 'all');
  const row = pred => data.rows.find(pred);
  const t = r => text(renderStore(buildStoreDetail(r, common(data, index, data.rows)), ctx));
  assert.ok(t(row(r => !hasPoint(r) && r.area)).includes('แหล่งไม่เผยแพร่พิกัด'));
  assert.ok(t(row(r => r.admin === 'province')).includes('แหล่งระบุได้แค่จังหวัด จึงไม่อยู่ในสีของเขต/อำเภอใด'));
  const c = t(row(r => r.admin === 'conflict'));
  assert.ok(c.includes('จังหวัดในชุดข้อมูลไม่ตรงกับที่อยู่ จึงยังไม่ระบุพื้นที่') && c.includes('ไม่ระบุจังหวัด'));
  assert.ok(t(row(r => r.venue && r.pointRole === 'host_registry_reference_point')).includes('ตำแหน่งอ้างอิงของศูนย์การค้าในทะเบียน CityMETER ไม่ใช่ทางเข้าสาขา'));
  // Vocabularies cover every code the data uses.
  for (const r of data.rows) {
    assert.ok(SOURCE_TYPE_TH[r.sourceType], r.sourceType);
    assert.ok(STATUS_RAW_TH[r.statusRaw], r.statusRaw);
    assert.ok(ADMIN_TH[r.admin], r.admin);
    if (r.pointRole) assert.ok(POINT_ROLE_TH[r.pointRole], r.pointRole);
  }
  // A district with no listed branch is a measured zero of this dataset, offered with where the filters match.
  const rows = filterRows(data.rows, {});
  const z = text(renderArea(buildAreaProfile(rows, '1001', index, data.groups, data.venues), () => '#000', ctxFor(data, index)));
  assert.ok(z.includes('ไม่พบสาขาฟิตเนสและสตูดิโอในเขตพระนคร'));
  assert.ok(z.includes('ไม่มีแบรนด์ใดในชุดข้อมูลที่หน้าทางการระบุสาขาในพื้นที่นี้ ณ วันตรวจ'));
  assert.ok(z.includes('ตัวกรองเดียวกันพบ 352 สาขาในพื้นที่อื่น'));
  assert.deepEqual(unplacedOf(rows), {noArea: 40, noProvince: 29, conflict: 1, total: 70});
});

test('charts: districts by count, district × format matrix with equal cells, brands by count', () => {
  const {data, index} = load();
  const rows = filterRows(data.rows, {});
  const m = buildChartModel(rows, index, data.groups);
  assert.equal(m.areas.length, 20);
  assert.equal(m.totalAreas, 76);
  assert.equal(m.placedRows, 282);
  for (let i = 1; i < m.areas.length; i++) assert.ok(m.areas[i - 1].count >= m.areas[i].count);
  const mx = areaMatrix(m);
  assert.equal(mx.cells.length, 12 * data.groups.length);
  for (const a of mx.areas) assert.equal(mx.cells.filter(c => c.areaId === a.id).reduce((s, c) => s + c.count, 0), a.count, 'cells add up to the district');
  const br = brandRanking(rows);
  assert.equal(br.total, 122, 'brands with at least one listed branch');
  assert.deepEqual(br.brands.slice(0, 3).map(b => [b.brand.name, b.count]), [['Jetts', 64], ['Fitness First', 32], ['Anytime Fitness', 25]]);
  assert.equal(br.brands.reduce((s, b) => s + b.count, 0) <= rows.length, true);
});

test('breadcrumb follows production: ประเทศไทย › จังหวัด › เขต/อำเภอ (› ศูนย์การค้า) with /D/ deep links and no dataset parameter', () => {
  const {data, index} = load();
  const area = index.byId.get('1039');
  const crumbs = buildBreadcrumb({province: 'BKK', area});
  assert.equal(breadcrumbText(crumbs), 'ประเทศไทย › กรุงเทพมหานคร › เขตวัฒนา');
  assert.equal(crumbs.at(-1).current, true);
  assert.equal(crumbs[2].href, 'https://landometer.com/v3/citymeter/BKK/D/1039');
  assert.equal(productionHref(crumbs), 'https://landometer.com/v3/citymeter/BKK/D/1039');
  const v = data.venues.find(x => x.name === 'Fifty Fifth Thonglor');
  const vc = buildBreadcrumb({area, venue: v});
  assert.equal(breadcrumbText(vc), 'ประเทศไทย › กรุงเทพมหานคร › เขตวัฒนา › Fifty Fifth Thonglor');
  assert.equal(productionHref(vc), 'https://landometer.com/v3/citymeter/BKK/D/1039', 'a venue has no production route of its own here');
  const html = renderBreadcrumb(vc);
  assert.ok(html.includes('aria-current="location"') && html.includes('crumb-ellipsis'), 'four levels fold on narrow screens');
  assert.equal(breadcrumbText(buildBreadcrumb({area: index.byId.get('8301')})), 'ประเทศไทย › ภูเก็ต › อำเภอเมืองภูเก็ต');
  assert.equal(productionLink(), 'https://landometer.com/v3/citymeter');
  assert.equal(productionLink({province: 'PKT'}), 'https://landometer.com/v3/citymeter/PKT');
  assert.equal(productionLink({province: 'PKT', area: '8301'}), 'https://landometer.com/v3/citymeter/PKT/D/8301');
});

test('formats bind to LDS series by stable id with the series shape cue; no star (it would read as a rating)', () => {
  const {data} = load();
  assert.deepEqual(CUES, ['circle', 'square', 'triangle', 'diamond', 'cross', 'star', 'hexagon', 'ring', 'dash', 'plus']);
  assert.deepEqual(GROUP_SERIES, {gym: 2, ems: 3, training: 9, pilates: 1, boutique: 4, combat: 5, yoga: 7, climb: 10, special: 8});
  assert.ok(!Object.values(GROUP_SERIES).includes(6));
  assert.equal(new Set(Object.values(GROUP_SERIES)).size, 9, 'one series per format');
  for (const g of data.groups) assert.equal(g.series, seriesOf(g.id));
  for (const name of CUES) assert.ok(CUE_PATHS[name].startsWith('M'));
  assert.match(cueMarkup(8), /class="cue-shape category-8".*data-cue="ring".*aria-hidden="true"/);
});

test('lists are stable and neutral: by brand, then branch name (no size or popularity data exists)', () => {
  const {data} = load();
  const rows = data.rows.filter(r => r.area === '1039').sort(listOrder);
  assert.deepEqual([...rows].reverse().sort(listOrder).map(r => r.id), rows.map(r => r.id), 'deterministic');
  for (let i = 1; i < rows.length; i++) assert.ok(new Intl.Collator('th').compare(rows[i - 1].brand.name, rows[i].brand.name) <= 0);
});

test('filter chips escape user text, name the status and offer one clear-all', () => {
  const html = renderFilterChips({search: '<b>ยิม</b>', status: 'announced', group: 'pilates', province: 'BKK', brand: ''},
    {group: {pilates: 'พิลาทิส/บาร์เร่'}, province: {BKK: 'กรุงเทพมหานคร'}, brand: {}});
  assert.ok(!html.includes('<b>'));
  assert.ok(text(html).includes('ประกาศเปิด') && text(html).includes('พิลาทิส/บาร์เร่') && text(html).includes('กรุงเทพมหานคร'));
  assert.equal((html.match(/data-id="all"/g) || []).length, 1);
});

test('shares print whole percentages; a non-zero part never prints as 0%', () => {
  assert.equal(pct(56, 147), '38%');
  assert.equal(pct(1, 352), '<1%');
  assert.equal(pct(0, 10), '0%');
  assert.equal(pct(3, 0), '—');
});

test('brand Ahas: one district above a tie is named in the headline; equal districts read as spread; a one-branch “most” is not shown', () => {
  const {data, index} = load();
  const ctx = ctxFor(data, index);
  const render = name => {
    const rows = filterRows(data.rows, {brand: data.brands.find(b => b.name === name).id});
    const insight = summarizeAreaInsight(rows, index);
    const focus = insight.areaIds.length ? rows.filter(r => insight.areaIds.includes(r.area)) : rows;
    return text(renderOverview({insight, summary: summarize(focus), overview: buildOverview(rows, index, {groups: data.groups}), focusMode: insight.areaIds.length ? 'auto' : 'none', province: '', ctx}));
  };
  const j = render('Jetts');
  assert.ok(j.includes('16% ของสาขาในกรุงเทพมหานครที่ระบุเขตได้ อยู่ในเขตปทุมวัน'), j.slice(0, 200));
  assert.ok(j.includes('นอกกรุงเทพมหานครมากที่สุด: อำเภอปากเกร็ด นนทบุรี 3 สาขา'));
  const ff = render('Fitness First');
  assert.ok(ff.includes('25% ของสาขาในกรุงเทพมหานครที่ระบุเขตได้ อยู่ใน 2 เขตนี้') && ff.includes('ปทุมวัน · วัฒนา'), 'two districts tied above the rest are both named');
  // Fitness24Seven: one branch in each of 7 Bangkok districts and one outside — spread, and the outside 1 says nothing.
  const f7 = render('Fitness24Seven');
  assert.ok(f7.includes('7 เขตในกรุงเทพมหานคร มีสาขาเขตละ 1 สาขาเท่ากัน') && f7.includes('สาขากระจาย ไม่กระจุกในเขตใด'), f7.slice(0, 200));
  assert.ok(!f7.includes('นอกกรุงเทพมหานครมากที่สุด'), 'a top outside count of 1 says nothing');
  assert.ok(!/\d+% ของสาขา/.test(f7.slice(0, 200)), 'no concentration share for a spread brand');
});

test('one list per building (owner 2026-10-29): venue-linked rows and rows whose points fall in its building, each once', () => {
  const {data, index} = load();
  const rows = filterRows(data.rows, {});
  const ctx = ctxFor(data, index);
  const v = data.venues.find(x => x.name === 'Summer Hill');
  const linked = rows.filter(r => r.venue?.id === v.id);
  const other = rows.find(r => hasPoint(r) && !r.venue);
  // The building's rows (js/app.js#buildingRows) already hold the linked row: it is listed once.
  const p = buildVenueProfile(v.id, {...common(data, index, rows), inside: [...linked, other], building: {key: 'osm:1', height: 30}});
  assert.equal(p.count, linked.length + 1);
  assert.deepEqual([p.linked, p.inBuilding], [linked.length, 1]);
  assert.deepEqual(p.rows.map(r => r.id).sort(), [...linked, other].map(r => r.id).sort());
  const t = text(renderVenue(p, ctx));
  assert.ok(t.includes('สาขาที่ผูกกับศูนย์การค้านี้ และที่จุดตกในอาคารเดียวกัน'), t.slice(0, 400));
  assert.ok(t.includes(other.name), 'the branch whose point falls in the building is in the same list');
  assert.equal((renderVenue(p, ctx).match(/class="outlet-list"/g) || []).length, 1, 'one list, not two');
  assert.ok(t.includes('และอาคาร OpenStreetMap ที่ตำแหน่งนั้นตก'), 'the boundary clause names the building join');
  // Without building rows the venue reads as before.
  const plain = text(renderVenue(buildVenueProfile(v.id, common(data, index, rows)), ctx));
  assert.ok(plain.includes('สาขาที่ชุดข้อมูลผูกกับศูนย์การค้านี้') && !plain.includes('อาคาร OpenStreetMap'));
  // A branch whose point falls in a venue's building links to the venue (one list for the building).
  const s = text(renderStore(buildStoreDetail(other, {...common(data, index, rows), building: {key: 'osm:1', others: 1, venue: {id: v.id, name: v.name}}}), ctx));
  assert.ok(s.includes(`จุดตกในอาคารเดียวกับ ${v.name} · อีก 1 สาขาในอาคารนี้`), s);
  const own = text(renderStore(buildStoreDetail(linked[0], {...common(data, index, rows), building: {key: 'osm:1', others: 1, venue: {id: v.id, name: v.name}}}), ctx));
  assert.ok(own.includes('อีก 1 สาขาในอาคารนี้') && !own.includes('จุดตกในอาคารเดียวกับ'), 'a venue-linked branch is not told it shares a building with its own venue');
  const bare = text(renderStore(buildStoreDetail(other, {...common(data, index, rows), building: {key: 'osm:2', others: 2, venue: null}}), ctx));
  assert.ok(bare.includes('จุดตกในอาคารเดียวกับอีก 2 สาขา'));
});

test('owner-confirmed location reads in the branch facts; a venue links to its page in CityMETER Shopping centers by registry id', () => {
  const {data, index} = load();
  const ctx = ctxFor(data, index);
  const r = data.rows.find(x => x.id === 'POS-FIT-8b70023548ef');
  const html = renderStore(buildStoreDetail(r, common(data, index, data.rows)), ctx);
  const t = text(html);
  assert.ok(t.includes('ตำแหน่งอ้างอิงของศูนย์การค้าในทะเบียน CityMETER ไม่ใช่ทางเข้าสาขา'));
  assert.ok(t.includes('เจ้าของข้อมูลยืนยัน 30 ต.ค. 2569 ว่าสาขาอยู่ใน Erawan Bangkok · จุดที่หน้าทางการเผยแพร่ห่าง 689 ม. จึงไม่ใช้'));
  // The note sits in the folded source facts, not on the face of the panel.
  assert.ok(html.indexOf('เจ้าของข้อมูลยืนยัน') > html.indexOf('<details class="source-details">'));
  const other = data.rows.find(x => x.venue && x.id !== r.id && x.pointRole === 'host_registry_reference_point');
  assert.ok(!text(renderStore(buildStoreDetail(other, common(data, index, data.rows)), ctx)).includes('เจ้าของข้อมูลยืนยัน'));
  const v = data.venues.find(x => x.scId === 'SC-001278');
  const venueHtml = renderVenue(buildVenueProfile(v.id, common(data, index, data.rows)), ctx);
  assert.ok(venueHtml.includes('href="https://montri-th.github.io/shoppingcenter/?venue=SC-001278"'));
  assert.ok(text(venueHtml).includes('ดูศูนย์นี้ใน CityMETER ศูนย์การค้า'));
});
