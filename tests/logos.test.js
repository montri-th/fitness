import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {configureLogos, brandLogo, brandLogoMarkup, venueLogoMarkup, logoCoverage, publicURL} from '../js/logos.js';
import {aiModeURL, mapsSearchURL, streetViewURL, branchLabel, contextActions, actionBar} from '../js/ask.js';

const json = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(new URL(`../${p}`, import.meta.url))).digest('hex');
const EXT = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg'};

test('brand logos: one checked file per brand, bytes as recorded, public links only, backing from the allowed set', () => {
  const reg = json('data/brand-logos.json'), data = json('data/fitness.json');
  const ids = new Set(data.brands.map(b => b.id));
  assert.equal(reg.logos.length, ids.size);
  assert.deepEqual(new Set(reg.logos.map(r => r.brand)), ids, 'every brand of the dataset, no other');
  for (const r of reg.logos) {
    assert.ok(existsSync(new URL(`../${r.file}`, import.meta.url)), r.file);
    assert.equal(sha(r.file), r.sha256, `${r.name}: file bytes`);
    assert.equal(r.file.split('.').pop(), EXT[r.mime], `${r.name}: extension matches the type`);
    assert.ok(['#FFFFFF', '#182327', '#7B877D'].includes(r.backing), r.backing);
    assert.match(r.original.sha256, /^[a-f0-9]{64}$/);
    // A display file that is not the original says what was done to it.
    if (r.sha256 !== r.original.sha256) assert.ok(r.transformations.length, `${r.name}: derived file without a recorded operation`);
    for (const t of r.transformations) assert.ok(!/recolou?r|trace|upscal/i.test(t.operation), t.operation);
    assert.ok(publicURL(r.sourcePage), `${r.name}: public https source page`);
    if (r.surfaceNote) assert.match(r.surfaceNote, /library surface/);
  }
  const text = readFileSync(new URL('../data/brand-logos.json', import.meta.url), 'utf8');
  assert.ok(!/drive\.google|docs\.google|googleusercontent|logo_file_url|folder/i.test(text), 'no Drive or sheet links, no internal fields');
  // The folder holds exactly the registry's files.
  assert.deepEqual(readdirSync(new URL('../assets/brand-logos/', import.meta.url)).sort(), reg.logos.map(r => r.file.split('/').pop()).sort());
});

test('venue logos: registry snapshot files, original bytes or a recorded display downscale, each used by a venue of the dataset', () => {
  const reg = json('data/venue-logos.json'), data = json('data/fitness.json');
  const used = new Set(data.venues.map(v => v.logo).filter(Boolean));
  assert.deepEqual(new Set(reg.logos.map(l => l.key)), used);
  for (const l of reg.logos) {
    assert.equal(sha(l.file), l.sha256, l.key);
    assert.match(l.original.sha256, /^[a-f0-9]{64}$/);
    if (l.sha256 === l.original.sha256) assert.deepEqual(l.transformations, [], `${l.key}: original bytes`);
    else {
      assert.equal(l.transformations.length, 1, `${l.key}: one recorded operation`);
      assert.equal(l.transformations[0].source_sha256, l.original.sha256);
      assert.ok(Math.max(l.width, l.height) <= 384 && l.mime === 'image/webp', `${l.key}: display derivative`);
    }
    assert.ok(l.mime === 'image/svg+xml' || (Math.max(l.width, l.height) <= 512 && l.bytes <= 64 * 1024), `${l.key}: display-sized`);
  }
  // The folder holds exactly the registry's files.
  assert.deepEqual(readdirSync(new URL('../assets/venue-logos/', import.meta.url)).sort(), reg.logos.map(l => l.file.split('/').pop()).sort());
  assert.ok(!/drive\.google|docs\.google/.test(JSON.stringify(reg)));
});

test('logo chips: the name stays next to the logo; invalid records are dropped, never shown', () => {
  const reg = json('data/brand-logos.json');
  const r = configureLogos({brandLogos: reg, venueLogos: {logos: [{key: 'bad', file: 'https://evil.example/x.png', mime: 'image/png', sha256: 'x', width: 1, height: 1}]}});
  assert.equal(r.brands, reg.logos.length);
  assert.equal(r.venues, 0);
  assert.equal(r.issues.length, 1);
  const b = reg.logos[0];
  const deco = brandLogoMarkup(b.brand);
  assert.ok(deco.includes('aria-hidden="true"') && deco.includes('alt=""') && deco.includes(`--logo-bg:${b.backing}`) && deco.includes('loading="lazy"'));
  assert.ok(brandLogoMarkup(b.brand, {decorative: false}).includes(`alt="โลโก้ ${b.name}"`));
  assert.equal(brandLogoMarkup('BR-FIT-000000000000'), '');
  assert.equal(venueLogoMarkup({logo: 'bad', name: 'x'}), '');
  assert.equal(logoCoverage(json('data/fitness.json').brands).complete, false, 'an invalid record is reported');
  configureLogos({brandLogos: reg, venueLogos: json('data/venue-logos.json')});
  assert.equal(logoCoverage(json('data/fitness.json').brands).complete, true);
  assert.equal(brandLogo(b.brand).ratio, b.width / b.height);
});

test('contextual actions: Google AI Mode, Maps and Street View built from public names; Street View only with a point', () => {
  assert.equal(aiModeURL('a b'), 'https://www.google.com/search?udm=50&q=a%20b');
  assert.equal(mapsSearchURL('Jetts ปทุมวัน'), 'https://www.google.com/maps/search/?api=1&query=Jetts%20%E0%B8%9B%E0%B8%97%E0%B8%B8%E0%B8%A1%E0%B8%A7%E0%B8%B1%E0%B8%99');
  assert.equal(streetViewURL(13.745084, 100.540676), 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=13.745084,100.540676');
  assert.equal(streetViewURL(null, 100), '');
  const brand = {name: 'Jetts'};
  assert.equal(branchLabel({name: 'Jetts - Black Gaysorn Village (BTS Chid Lom)', brand}), 'Black Gaysorn Village (BTS Chid Lom)');
  assert.equal(branchLabel({name: 'Central Phuket Festival EN - Jetts Thailand Fitness 24 Hours', brand}), 'Central Phuket Festival');
  assert.equal(branchLabel({name: 'Jetts', brand}), '');
  const row = {name: 'Jetts - Black Gaysorn Village (BTS Chid Lom)', brand, venue: {name: 'Gaysorn Village'}};
  const store = contextActions({kind: 'store', row, area: {place: 'เขตปทุมวัน', province: 'กรุงเทพมหานคร'}, point: {lat: 13.745084, lon: 100.540676, role: 'host'}});
  assert.deepEqual(store.map(a => a.id), ['ai', 'maps', 'streetview']);
  assert.ok(decodeURIComponent(store[0].href).includes('Jetts สาขา Black Gaysorn Village (BTS Chid Lom) (Gaysorn Village)'));
  assert.equal(store[2].label, 'Street View ใกล้อาคาร');
  assert.match(store[2].note, /ไม่ใช่ทางเข้าร้าน/);
  assert.deepEqual(contextActions({kind: 'store', row}).map(a => a.id), ['ai', 'maps'], 'no point, no Street View');
  for (const kind of ['venue', 'area', 'brand', 'overview']) assert.ok(contextActions({kind, venue: {name: 'X'}, area: {place: 'เขตX', province: 'Y'}, brand}).length, kind);
  const bar = actionBar({kind: 'overview'});
  assert.ok(bar.includes('rel="noopener noreferrer"') && bar.includes('target="_blank"') && bar.includes('ผลลัพธ์ไม่ใช่ข้อมูล CityMETER'));
  assert.equal(actionBar({kind: 'store'}), '', 'nothing applies → no bar');
});
