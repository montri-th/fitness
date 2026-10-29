import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON, frameFiles, sha256} from './helpers.js';
import {hasPoint, filterRows, provinces, unitWords, STATUS_TH} from '../js/model.js';

const raw = () => load().raw;

test('fitness.json decodes to the 378 rows of the research master, nothing dropped, ids unique', () => {
  const {raw, data} = load();
  assert.equal(raw.meta.rows, 378);
  assert.equal(raw.meta.sheetStatus, 'research_master', 'the source sheet is a research master: the demo says so in its handoff');
  for (const k of ['key', 'name', 'brand', 'group', 'segment', 'status', 'statusRaw', 'source', 'url', 'statusUrl', 'checked', 'province', 'district', 'admin', 'how', 'words', 'venue']) {
    assert.equal(raw.cols[k].length, 378, `column ${k} is complete`);
  }
  assert.equal(data.rows.length, 378);
  assert.equal(data.dropped, 0, 'every placed row resolves to a production district');
  assert.equal(new Set(data.rows.map(r => r.id)).size, data.rows.length, 'row keys are unique');
  assert.ok(data.rows.every(r => /^POS-FIT-[0-9a-f]{12}$/.test(r.id)), 'the sheet’s own outlet ids');
});

test('the build reconciles with the sheet’s own headline figures (00_README) and its coverage tab', () => {
  const {raw, data} = load();
  // Snapshot values (regression fixtures, never UI constants).
  assert.deepEqual(raw.meta.readmeCheck, {brands: 126, rows: 378, listed: 352, points: 28, companies: 44, relationships: 48});
  assert.equal(data.brands.length, 126);
  assert.equal(data.companies.size, 44);
  assert.equal(data.relationships.length, 48);
  const counts = {};
  const add = k => { counts[k] = (counts[k] || 0) + 1; };
  for (const r of data.rows) { add(`status.${r.status}`); add(`admin.${r.admin}`); if (r.how) add(`address.${r.how}`); }
  for (const [k, v] of Object.entries(counts)) assert.equal(raw.meta.counts[k], v, k);
  assert.deepEqual({listed: counts['status.listed'], announced: counts['status.announced'], closed: counts['status.closed'], review: counts['status.review']},
    {listed: 352, announced: 19, closed: 2, review: 5});
  // Every brand's rows by status are its own rows (01_BRANDS ↔ 02_STORES by brand id).
  for (const b of data.brands) {
    const mine = data.rows.filter(r => r.brand?.id === b.id);
    for (const s of ['listed', 'announced', 'closed', 'review']) assert.equal(mine.filter(r => r.status === s).length, b.rows[s], `${b.name} ${s}`);
    assert.equal(b.logo, 'collected', '01_BRANDS logo_status: every brand has a checked logo (16_BRAND_LOGOS)');
  }
  assert.match(raw.meta.logos.brands, /16_BRAND_LOGOS/);
});

test('counting unit: the default counts listed branches (“สาขา”); other statuses are counted apart as “รายการ”', () => {
  const {data, listed} = load();
  assert.equal(filterRows(data.rows, {}).length, 352, 'the default unit is listed rows');
  assert.equal(listed.length, 352);
  assert.equal(filterRows(data.rows, {status: 'announced'}).length, 19);
  assert.equal(filterRows(data.rows, {status: 'all'}).length, 378);
  assert.equal(unitWords().one, 'สาขา');
  assert.equal(unitWords('listed').one, 'สาขา');
  for (const s of ['announced', 'closed', 'review', 'all']) assert.equal(unitWords(s).one, 'รายการ', s);
  assert.deepEqual(Object.keys(STATUS_TH), ['listed', 'announced', 'closed', 'review']);
  // Raw statuses map to one of the four, and the map is the published one.
  for (const r of data.rows) assert.equal(raw().meta.statusMap[r.statusRaw], r.status, r.id);
});
test('membership: a placed row sits in an existing production district of its own province; the rest stop at province or none', () => {
  const {data, index} = load();
  const codes = new Set(provinces().map(p => p.code));
  assert.equal(codes.size, 77);
  for (const r of data.rows) {
    if (r.area) {
      const a = index.byId.get(r.area);
      assert.ok(a, `area ${r.area}`);
      assert.equal(r.province, a.province, `${r.id} province`);
      assert.ok(['point', 'host', 'address'].includes(r.admin), `${r.id} admin ${r.admin}`);
      if (r.admin === 'address') assert.ok(['marker', 'pair', 'mueang', 'trailing'].includes(r.how), `${r.id} how ${r.how}`);
      else assert.equal(r.how, '');
    } else if (r.province) assert.equal(r.admin, 'province', r.id);
    else assert.ok(['none', 'conflict'].includes(r.admin), r.id);
    if (r.province) assert.ok(codes.has(r.province), r.province);
  }
  // A province disagreement is placed nowhere and reported in the build receipt.
  const conflicts = data.rows.filter(r => r.admin === 'conflict');
  assert.deepEqual(conflicts.map(r => r.id), raw().meta.conflicts.map(c => c.outlet));
  assert.ok(conflicts.every(r => !r.area && !r.province));
  // Snapshot fixture: listed rows by placement.
  const listed = filterRows(data.rows, {});
  assert.equal(listed.filter(r => r.area).length, 282);
  assert.equal(listed.filter(r => r.province && !r.area).length, 40);
  assert.equal(listed.filter(r => !r.province).length, 30);
});

test('points are the source’s own point or the CityMETER venue registry point, inside Thailand, never invented', () => {
  const {data} = load();
  const withPoint = data.rows.filter(hasPoint);
  assert.equal(withPoint.length, 157);
  // 129 rows without a source point + Physique 57 Erawan, whose source point the owner superseded (meta.ownerConfirmedHost)
  assert.equal(withPoint.filter(r => r.pointRole === 'host_registry_reference_point').length, 130);
  for (const r of withPoint) {
    assert.ok(r.longitude > 97 && r.longitude < 106 && r.latitude > 5 && r.latitude < 21, `${r.id} inside Thailand`);
    assert.ok(r.pointRole, `${r.id} keeps the role of its point`);
    if (r.pointRole === 'host_registry_reference_point') {
      assert.ok(r.venue, `${r.id} has its venue`);
      assert.deepEqual([r.longitude, r.latitude], [r.venue.longitude, r.venue.latitude], 'the venue point, unchanged');
    }
  }
  assert.ok(data.rows.filter(r => !hasPoint(r)).every(r => r.longitude === null && r.latitude === null), 'no (0, 0) stand-ins');
  // A row with its own point inside a district was placed by that point.
  assert.ok(data.rows.filter(r => r.admin === 'point').every(r => hasPoint(r) && r.pointRole !== 'host_registry_reference_point'));
});

test('owner map audit (2026-10-30): a branch confirmed inside its venue is drawn at the venue registry point, the source point kept as a count', () => {
  const {data, raw} = load();
  const audit = raw.meta.ownerConfirmedHost;
  assert.equal(audit.rows.length, 1);
  assert.deepEqual(audit.rows[0], {outlet: 'POS-FIT-8b70023548ef', venue: 'SC-001278', on: '2026-10-30', sourcePointM: 689});
  const r = data.rows.find(x => x.id === 'POS-FIT-8b70023548ef');
  assert.equal(r.venue.scId, 'SC-001278');
  assert.equal(r.admin, 'host');
  assert.equal(r.pointRole, 'host_registry_reference_point');
  assert.deepEqual([r.latitude, r.longitude], [r.venue.latitude, r.venue.longitude]);
  assert.deepEqual(r.ownerHost, {on: '2026-10-30', sourcePointM: 689});
  assert.ok(!raw.points.some(([i]) => raw.cols.key[i] === r.id), 'the superseded source point is not published as a drawn point');
  // The 00_README cross-check still counts the published source points (28); 27 are drawn.
  assert.equal(raw.meta.counts['points.source'], 28);
  assert.equal(raw.points.length, 27);
  assert.equal(raw.meta.counts['points.ownerConfirmedHost'], 1);
  assert.ok(data.rows.filter(x => x.ownerHost).length === 1);
});

test('venues: CityMETER Shopping Center registry records by id; a point decides the district, no point means no district', () => {
  const {data, index, raw} = load();
  assert.equal(data.venues.length, 128);
  assert.equal(raw.venues.filter(v => v.from === '07').length, 7, 'the sheet’s own 07_SHOPPING_CENTERS');
  assert.equal(raw.venues.filter(v => v.from === 'registry').length, 121, 'the pinned registry snapshot (meta.registry)');
  for (const v of data.venues) {
    assert.match(v.scId, /^(SC-(SM-)?[A-Z]?\d{4,6}|VN-[0-9a-f]{14})$/, 'the registry id');
    // The CityMETER venue uuid is the venue id when the registry has one; otherwise the registry id stands in.
    assert.ok(/^[0-9a-f-]{36}$/.test(v.id) || v.id === v.scId, `${v.name}: id`);
    if (Number.isFinite(v.latitude)) {
      assert.equal(v.role, 'host_registry_reference_point_not_shopfront_or_entrance');
      assert.equal(index.byId.get(v.district)?.name, v.districtTh, `${v.name}: the district its point falls in`);
    } else {
      assert.equal(v.role, 'registry_identity_without_reference_point');
      assert.equal(v.district, '', `${v.name}: no point, no district`);
    }
  }
  assert.equal(data.venues.filter(v => !Number.isFinite(v.latitude)).length, 13);
  assert.equal(data.rows.filter(r => r.venue).length, 147);
  // Only accepted links are drawn; held candidates and unmatched rows carry no venue.
  assert.deepEqual(raw.meta.venueLinks, {acceptedNoPoint: 14, acceptedWithPoint: 133, accepted_identity_and_located_in: 147,
    candidate_name_or_numbering_review: 8, candidate_parent_component_review: 4, candidate_registry_duplicate_review: 7, not_matched: 212});
});

test('companies and relationships join by id only; every id resolves', () => {
  const {data} = load();
  const brandIds = new Set(data.brands.map(b => b.id));
  for (const r of data.relationships) {
    assert.ok(data.companies.has(r.company), `${r.id} company`);
    assert.ok(r.objectType === 'brand' ? brandIds.has(r.object) : data.companies.has(r.object), `${r.id} object`);
    assert.ok(!r.url || /^https:\/\//.test(r.url));
  }
  for (const c of data.companies.values()) assert.equal(c.verification, 'source_named_not_registry_certified', 'company names are as the sources state them');
  assert.equal(data.brands.filter(b => data.relationships.some(r => r.object === b.id)).length, 36);
});

test('publication hygiene: no phone, address, map link, notes or README text; links are https and never a private document', () => {
  const {raw} = load();
  for (const f of ['address', 'public_business_phone', 'map_url', 'notes', 'coverage_note', 'README text']) assert.ok(raw.meta.excludedFields.includes(f), f);
  const text = JSON.stringify(raw);
  for (const k of ['phone', 'address', 'map_url', 'notes', 'latitude', 'longitude']) assert.ok(!Object.keys(raw.cols).includes(k), k);
  assert.ok(!/(docs|drive)\.google\.com/.test(text), 'no Google document link');
  assert.ok(!/google\.[a-z.]+\/maps|maps\.app\.goo\.gl/.test(text), 'no map links');
  assert.ok(raw.urls.every(u => /^https:\/\//.test(u)), 'source links are https');
  assert.ok(!/\b0\d{1,2}[- ]?\d{3}[- ]?\d{4}\b/.test(text), 'no telephone-like numbers');
  assert.ok(!('readme' in raw.meta) && !text.includes('coverageNote') && !text.includes('sisters'), 'no researcher text');
  assert.ok(raw.brands.every(b => !('notes' in b)));
});

test('boundaries: 928 districts and 77 provinces from production; per-province frames match the index; receipts bound by hash', () => {
  const {index, indexJSON, provincesGeo, raw} = load();
  assert.equal(index.areas.length, 928);
  assert.equal(index.provinces.length, 77);
  assert.equal(provincesGeo.features.length, 77);
  assert.ok(index.areas.every(a => a.km2 > 0 && Array.isArray(a.label) && Array.isArray(a.bbox)), 'production area, label and bbox for every district');
  const files = frameFiles();
  assert.equal(files.length, 77);
  let areas = 0;
  for (const f of files) {
    const code = f.replace('.json', ''), frame = readJSON(`data/frames/${f}`), p = index.provinceById.get(code);
    assert.ok(p, code);
    assert.equal(frame.metadata.province ?? code, code);
    assert.equal(frame.areas.features.length, p.areaTotal, `${code} districts`);
    for (const ft of frame.areas.features) {
      assert.equal(index.byId.get(String(ft.id ?? ft.properties.id))?.province, code);
      assert.ok(['Polygon', 'MultiPolygon'].includes(ft.geometry.type));
    }
    areas += frame.areas.features.length;
  }
  assert.equal(areas, 928);
  const receipts = readJSON('data/boundary-receipts.json');
  assert.equal(Object.keys(receipts.base).length, 78, 'the country list + 77 province base-info responses');
  assert.equal(indexJSON.metadata.receipts, 78);
  for (const r of [...Object.values(receipts.base), ...Object.values(receipts.geometry)]) {
    assert.match(r.sha256, /^[a-f0-9]{64}$/);
    assert.match(r.url, /^https:\/\/landometer\.com\/api\/v2\/citymeter-v3\/base\/info\//);
    assert.equal(r.status, 200);
  }
  // Same recipe as scripts/build-receipts.py: sha256(json.dumps({file: receipt}, sort_keys=True)) with Python's default separators.
  const py = v => (Array.isArray(v) ? `[${v.map(py).join(', ')}]` : v && typeof v === 'object'
    ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}: ${py(v[k])}`).join(', ')}}` : JSON.stringify(v));
  assert.equal(sha256(Buffer.from(py(receipts.base))), receipts.baseSha256);
  assert.equal(receipts.baseSha256, indexJSON.metadata.receiptsSha256);
  assert.equal(receipts.baseSha256, raw.meta.boundaries.receiptsSha256);
  assert.equal(sha256(Buffer.from(py(receipts.geometry))), receipts.geometrySha256);
});
