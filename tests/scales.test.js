import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './helpers.js';
import * as scales from '../js/scales.js';
import {COUNT_SCALE, LADDER, classColors, buildCountClasses, geometricBreaks, classify, inkFor, contrastRatio} from '../js/scales.js';

test('the count family is an exact 41-sample LUT with anchors at 0/20/40, same HEX on both themes; no other family is shipped', () => {
  assert.equal(COUNT_SCALE.lut.length, 41);
  assert.deepEqual([COUNT_SCALE.lut[0], COUNT_SCALE.lut[20], COUNT_SCALE.lut[40]], [...COUNT_SCALE.anchors]);
  assert.deepEqual([...COUNT_SCALE.anchors], ['#F4F0E7', '#7DBAC0', '#213E70']);
  assert.ok(COUNT_SCALE.lut.every(h => /^#[0-9A-F]{6}$/.test(h)));
  assert.equal(COUNT_SCALE.themePolicy, 'identical-light-values-on-both-themes');
  assert.equal(COUNT_SCALE.scaleVersion, '4ff5c1fb4be71ecd13c48685b38371b528bcd4ce369ce964a75354c2eb4d0980');
  assert.deepEqual([COUNT_SCALE.noData, COUNT_SCALE.zeroOutline], ['#D5DAD6', '#7D877F']);
  assert.equal(COUNT_SCALE.scaleId, 'count');
  assert.ok(!('DENSITY_SCALE' in scales), 'no per-area ratio is drawn: branches of a declared brand set are a total, never a density');
});

test('class colours are LUT[round(i·40/(n−1))] for n ∈ {3,5,7,9}; other n are refused', () => {
  for (const n of [3, 5, 7, 9]) assert.deepEqual(classColors(n), Array.from({length: n}, (_, i) => COUNT_SCALE.lut[Math.round((i * 40) / (n - 1))]));
  assert.throws(() => classColors(4), /3, 5, 7 or 9/);
});

test('theme.css carries the count classes once (no dark override of analytical values)', () => {
  const css = readFileSync(join(ROOT, 'assets/theme.css'), 'utf8');
  const [light, dark] = css.split(':root[data-theme="dark"]');
  classColors(5).forEach((hex, i) => assert.match(light, new RegExp(`--scale-count-${i + 1}: ${hex};`)));
  assert.ok(!/--scale-/.test(dark), 'no analytical token is redefined for dark');
  assert.match(light, /--data-no-data: #D5DAD6;/);
  assert.match(light, /--data-zero-outline: #7D877F;/);
});

test('geometric 1–2–5 breaks: each break is the largest ladder value ≤ the next one ÷ 2, whole numbers from 2', () => {
  assert.deepEqual(LADDER.slice(0, 4), [0.001, 0.002, 0.005, 0.01]);
  assert.deepEqual(geometricBreaks(21, 5, {integer: true}), [2, 5, 10], 'the national district maximum (เขตวัฒนา, 21 branches)');
  assert.deepEqual(geometricBreaks(186, 5, {integer: true}), [5, 10, 20, 50], 'the largest province total (Bangkok, 186 listed rows)');
  assert.deepEqual(geometricBreaks(3, 5, {integer: true}), [], 'a narrow integer range yields fewer classes');
  assert.deepEqual(geometricBreaks(0), []);
});

test('count classes: closed integer intervals from 1 to the observed maximum; zero is measured_zero; no data never takes a ramp colour', () => {
  const m = buildCountClasses([0, 1, 4, 21]);
  assert.equal(m.method, 'geometric-1-2-5');
  assert.deepEqual(m.classes.map(c => c.label), ['1', '2–4', '5–9', '10–21']);
  assert.equal(m.classes.at(-1).closed, true);
  assert.equal(m.classes.at(-1).upper, 21);
  // Four classes spread over the five LDS class colours (first and last kept).
  assert.deepEqual(m.classes.map(c => c.fill), [0, 1, 3, 4].map(i => classColors(5)[i]));
  assert.equal(classify(21, m).classIndex, 4, 'the maximum is inside the closed last class');
  assert.equal(classify(5, m).classIndex, 3, 'a breakpoint opens the next class');
  assert.equal(classify(1, m).classIndex, 0);
  assert.equal(classify(0, m).state, 'measured_zero');
  assert.equal(classify(0, m).fill, COUNT_SCALE.lut[0]);
  assert.equal(classify(0, m).outline, '#7D877F', 'measured zero = lowest fill + the zero outline (EVID-05)');
  assert.equal(classify(null, m).state, 'no_data');
  assert.equal(classify(null, m).fill, null);
  assert.equal(buildCountClasses([0, 0]).classCount, 0);
  const narrow = buildCountClasses([1, 3]);
  assert.deepEqual(narrow.classes.map(c => c.label), ['1–3']);
  assert.deepEqual(narrow.classes.map(c => c.fill), [classColors(5)[4]]);
});

test('label ink is the foundation pair with the higher contrast; numbers printed on fills (matrix cells) reach 4.5:1', () => {
  for (const hex of classColors(5)) {
    const ink = inkFor(hex), other = ink === '#182327' ? '#FFFFFF' : '#182327';
    assert.ok(contrastRatio(hex, ink) >= contrastRatio(hex, other));
    assert.ok(contrastRatio(hex, ink) >= 4.5, hex);
  }
});
