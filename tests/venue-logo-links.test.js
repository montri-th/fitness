/**
 * Owner 2026-11-24 07:53 (asked on CityMETER · Shopping Center, D64/D65 there): venue logos another CityMETER demo verified
 * for the same venue id (data/venue-logo-links.json, scripts/attach-family-venue-logos.py, kit citymeter-logos VenuePool).
 * data/fitness.json and data/venue-logos.json stay as built.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {configureLogos, venueLogo, venueLogoMarkup} from '../js/logos.js';

const ROOT = new URL('../', import.meta.url);
const bytes = path => readFileSync(new URL(path, ROOT));
const read = path => JSON.parse(bytes(path).toString('utf8'));
const sha = buf => createHash('sha256').update(buf).digest('hex');
const links = read('data/venue-logo-links.json');
const registry = read('data/venue-logos.json');
const venues = read('data/fitness.json').venues;

test('the kit is the same bytes as its record and its rules hold', () => {
  const kit = read('scripts/logo-kit/kit.json');
  for (const [path, hash] of Object.entries(kit.files)) assert.equal(sha(bytes(path)), hash, `${path} differs from citymeter-logos ${kit.version}`);
  assert.equal(links.meta.kit, `citymeter-logos ${kit.version}`);
  const run = spawnSync('python3', ['-I', new URL('test_logo_kit.py', import.meta.url).pathname], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test('the links are bound to the files they were built from', () => {
  assert.equal(links.meta.inputs.fitnessSha256, sha(bytes('data/fitness.json')), 'data/fitness.json changed: run scripts/attach-family-venue-logos.py again');
  assert.equal(links.meta.inputs.registrySha256, sha(bytes('data/venue-logos.json')), 'data/venue-logos.json changed: run scripts/attach-family-venue-logos.py again');
});

test('every link fills a venue without its own logo, with a verified file', () => {
  const own = new Set(registry.logos.map(r => r.key));
  const bySc = new Map(venues.filter(v => v.scId).map(v => [v.scId, v]));
  const keys = new Set(links.logos.map(r => r.key));
  for (const [sc, key] of Object.entries(links.venues)) {
    assert.ok(bySc.has(sc), `${sc} is not a venue of this dataset`);
    assert.ok(!own.has(bySc.get(sc).logo), `${sc} has its own logo`);
    assert.ok(keys.has(key), `${sc}: ${key}`);
  }
  for (const r of links.logos) {
    assert.match(r.file, /^assets\/venue-logos-family\/[a-f0-9]{20}\.(svg|png|jpg|webp)$/);
    assert.equal(sha(bytes(r.file)), r.sha256, r.file);
    assert.ok(['#E5E9E6', '#FFFFFF', '#182327'].includes(r.background), r.key);
  }
  assert.deepEqual(readdirSync(new URL('assets/venue-logos-family/', ROOT)).sort(), [...new Set(links.logos.map(r => r.file.split('/').pop()))].sort());
});

test('the registry wins; Seacon Square takes the logo Camera Shops verified; without the file nothing changes', () => {
  const seacon = venues.find(v => v.scId === 'SC-001360');
  const withOwn = venues.find(v => registry.logos.some(r => r.key === v.logo));
  configureLogos({venueLogos: registry, venueLinks: {...links, venues: {...links.venues, [withOwn.scId]: links.logos[0].key}}});
  assert.equal(venueLogo(withOwn).key, withOwn.logo, 'a venue with its own logo keeps it');
  assert.equal(venueLogo(seacon)?.from, 'camera');
  assert.match(venueLogoMarkup(seacon, {size: 'lg', decorative: false}), /assets\/venue-logos-family\/[a-f0-9]{20}\.\w+"/);
  configureLogos({venueLogos: registry});
  assert.equal(venueLogo(seacon), null);
});
