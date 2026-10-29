/**
 * Comparison charts rendered as plain HTML — no chart vendor.
 *
 * Three views share the committed selection (scopeRows) and the map's membership:
 *  - count (URL view key `count`): branches per เขต/อำเภอ, bars in the map's count-class colour
 *  - mix: district × format, a numeric table with equal cells (count classes)
 *  - brands: branches per brand, bar in the brand's format series colour with its shape cue
 * District marks emit {type:'area', id}; brand marks emit {type:'brand', id}.
 */
import {buildChartModel, areaMatrix, brandRanking} from './chart-model.js';
import {buildCountClasses, classify} from './scales.js';
import {cueMarkup, seriesOf} from './cues.js';
import {areaWord} from './areas.js';
import {provinceByCode} from './model.js';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = n => NUMBER.format(n);
const place = a => `${areaWord(a.province)}${a.name}`;
const where = (a, national) => (national ? provinceByCode(a.province)?.th || '' : '');

function empty(element, message) {
  element.innerHTML = `<div class="chart-empty"><p>${esc(message)}</p></div>`;
}

function counts(element, model, select, selectedId, unit, national) {
  const classes = buildCountClasses(model.counts, 5, {unit: unit.one});
  const max = Math.max(1, ...model.areas.map(a => a.count));
  const rows = model.areas.map((a, i) => {
    const cls = classify(a.count, classes);
    const pressed = a.id === selectedId;
    return `<li><button type="button" class="bar-row${pressed ? ' is-selected' : ''}" data-area="${esc(a.id)}" aria-pressed="${pressed}"
      aria-label="อันดับ ${i + 1} ${esc(place(a))} ${esc(where(a, national))}: ${num(a.count)} ${esc(unit.one)} ${num(a.brands)} แบรนด์ กดเพื่อดูพื้นที่นี้">
      <span class="bar-rank data-number" aria-hidden="true">${i + 1}</span>
      <span class="bar-label">${esc(place(a))}<small>${esc([where(a, national), `${num(a.brands)} แบรนด์`].filter(Boolean).join(' · '))}</small></span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${Math.max(2, Math.round((a.count / max) * 100))}%;background:${cls.fill}"></span></span>
      <span class="bar-value" aria-hidden="true"><b class="data-number">${num(a.count)}</b><small>${esc(unit.one)}</small></span>
    </button></li>`;
  }).join('');
  const w = national ? 'เขต/อำเภอ' : areaWord(model.areas[0]?.province);
  element.innerHTML = `<p class="chart-caption">${esc(unit.one)}ต่อ${esc(w)} · ${num(model.areas.length)} จาก ${num(model.totalAreas)} ${esc(w)}ที่พบ · สีเดียวกับแผนที่ · ${num(model.totalRows - model.placedRows)} ${esc(unit.one)}ที่ระบุได้แค่จังหวัดหรือไม่ระบุไม่อยู่ในกราฟนี้</p><ol class="chart-bars">${rows}</ol>`;
  element.querySelectorAll('[data-area]').forEach(b => b.addEventListener('click', () => select({type: 'area', id: b.dataset.area})));
}

function matrix(element, model, select, selectedId, unit) {
  const m = areaMatrix(model, {areaLimit: 12});
  const classes = buildCountClasses(m.cells.map(c => c.count), 5, {unit: unit.one});
  const head = m.groups.map(g => `<th scope="col" title="${esc(g.th)}"><span class="matrix-col">${cueMarkup(g.series)}<span>${esc(g.short || g.th)}</span></span></th>`).join('');
  const body = m.areas.map(a => {
    const pressed = a.id === selectedId;
    const cells = m.groups.map(g => {
      const cell = m.cells.find(c => c.areaId === a.id && c.group === g.index);
      const cls = classify(cell.count, classes);
      // measured_zero: lowest class fill + the theme's dataState.zero outline (EVID-05 treatment), never a blank cell.
      const style = cls.state === 'measured_zero' ? `background:${cls.fill};color:${cls.ink};box-shadow:inset 0 0 0 2px var(--data-zero-outline)` : `background:${cls.fill};color:${cls.ink}`;
      return `<td><button type="button" class="matrix-cell is-${cls.state}" data-area="${esc(a.id)}" style="${style}"
        aria-label="${esc(place(a))} × ${esc(g.th)}: ${num(cell.count)} ${esc(unit.one)} กดเพื่อดูพื้นที่นี้" title="${esc(place(a))} × ${esc(g.th)} — ${num(cell.count)} จาก ${num(cell.total)} ${esc(unit.one)}"><span class="data-number">${num(cell.count)}</span></button></td>`;
    }).join('');
    return `<tr${pressed ? ' class="is-selected"' : ''}><th scope="row"><button type="button" class="matrix-row" data-area="${esc(a.id)}" aria-pressed="${pressed}">${esc(a.name)}<small class="data-number">${num(a.count)}</small></button></th>${cells}</tr>`;
  }).join('');
  const legend = classes.classes.map(c => `<span class="legend-step"><i style="background:${c.fill}" aria-hidden="true"></i>${esc(c.label)}</span>`).join('');
  const columns = `<colgroup><col class="matrix-head-col">${m.groups.map(() => '<col class="matrix-cell-col">').join('')}</colgroup>`;
  element.innerHTML = `<p class="chart-caption">${num(m.areas.length)} เขต/อำเภอที่มี${esc(unit.one)}มากที่สุด × ${num(m.groups.length)} รูปแบบ · ตัวเลข = ${esc(unit.one)} · ทุกช่องขนาดเท่ากัน</p>
    <div class="matrix-scroll"><table class="matrix" style="--matrix-columns:${m.groups.length}">${columns}<thead><tr><th scope="col" class="matrix-corner">พื้นที่ · ${esc(unit.one)}</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <p class="chart-legend"><span class="legend-title">ระดับสี (${esc(unit.one)}ในช่อง):</span>${legend}<span class="legend-step"><i class="legend-zero" aria-hidden="true"></i>0 = ไม่พบในตัวกรองนี้</span></p>`;
  element.querySelectorAll('[data-area]').forEach(b => b.addEventListener('click', () => select({type: 'area', id: b.dataset.area})));
}

function brands(element, rows, select, selectedBrand, unit, groups) {
  const r = brandRanking(rows, {limit: 20});
  const max = Math.max(1, ...r.brands.map(b => b.count));
  const groupName = id => groups.find(g => g.id === id)?.th || '';
  const list = r.brands.map((b, i) => {
    const pressed = b.brand.id === selectedBrand;
    const series = seriesOf(b.brand.group);
    return `<li><button type="button" class="bar-row${pressed ? ' is-selected' : ''}" data-brand="${esc(b.brand.id)}" aria-pressed="${pressed}"
      aria-label="อันดับ ${i + 1} ${esc(b.brand.name)} ${esc(groupName(b.brand.group))}: ${num(b.count)} ${esc(unit.one)} กดเพื่อดูเฉพาะแบรนด์นี้">
      <span class="bar-rank data-number" aria-hidden="true">${i + 1}</span>
      <span class="bar-label">${cueMarkup(series)}${esc(b.brand.name)}<small>${esc(groupName(b.brand.group))}</small></span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill category-${series}" style="width:${Math.max(2, Math.round((b.count / max) * 100))}%"></span></span>
      <span class="bar-value" aria-hidden="true"><b class="data-number">${num(b.count)}</b><small>${esc(unit.one)}</small></span>
    </button></li>`;
  }).join('');
  element.innerHTML = `<p class="chart-caption">${esc(unit.one)}ต่อแบรนด์ · ${num(r.brands.length)} จาก ${num(r.total)} แบรนด์ที่พบ · สีและรูปทรง = รูปแบบ · รวม${esc(unit.one)}ที่ระบุได้แค่จังหวัดด้วย</p><ol class="chart-bars">${list}</ol>`;
  element.querySelectorAll('[data-brand]').forEach(b => b.addEventListener('click', () => select({type: 'brand', id: b.dataset.brand})));
}

/** Render one view into #elementId. Returns an idempotent disposer. */
export function renderInsightChart({elementId, view = 'count', rows = [], index, groups, theme, selectedAreaId = '', selectedBrand = '', unit, national = true} = {}, onSelect = () => {}) {
  const element = document.getElementById(elementId);
  if (!element) return () => {};
  const select = typeof onSelect === 'function' ? onSelect : () => {};
  element.replaceChildren();
  if (theme) element.dataset.chartTheme = theme;
  const labels = {count: 'เขต/อำเภอเรียงตามจำนวนสาขา', mix: 'รูปแบบในแต่ละเขต/อำเภอ', brands: 'แบรนด์เรียงตามจำนวนสาขา'};
  element.setAttribute('aria-label', labels[view] || labels.count);
  if (!Array.isArray(rows) || !rows.length) { empty(element, `ไม่พบ${unit.one}ตามตัวกรอง`); return () => element.replaceChildren(); }
  try {
    if (view === 'brands') brands(element, rows, select, selectedBrand, unit, groups);
    else {
      const model = buildChartModel(rows, index, groups);
      if (!model.areas.length) { empty(element, 'ยังไม่มีเขต/อำเภอที่ระบุได้ในตัวกรองนี้'); return () => element.replaceChildren(); }
      if (view === 'mix') matrix(element, model, select, selectedAreaId, unit);
      else counts(element, model, select, selectedAreaId, unit, national);
    }
  } catch (error) {
    console.error('CityMETER chart could not render:', error);
    empty(element, 'แสดงกราฟไม่ได้ในขณะนี้ โปรดดูข้อมูลเดียวกันในตาราง');
  }
  return () => element.replaceChildren();
}
