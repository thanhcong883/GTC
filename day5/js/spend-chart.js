/* spend-chart.js
   Two charts on the Usage view, driven by one date range.

   - Total spend, by day or by hour. By hour spans the whole selected range
     rather than one unnamed day, so a bar always says which date it belongs to.
   - The same chart again for a single model, chosen from a dropdown.

   Both are plain HTML. Inside an SVG viewBox the axis text scales with the
   drawing and goes unreadable at small sizes; flex columns keep text at its
   real size at every width.

   Colour follows the entity, never its rank: slot 0 is always Gemini 3.0 Flash,
   whatever is selected. */

import {
  daySeries, hourSeries, credits, MODELS, RUNS, MAX_RANGE,
  FIRST_DAY, LAST_DAY, iso, ticks, axisLabel, failuresByDay, shortDate,
} from './data.js';

let from = new Date(LAST_DAY); from.setDate(from.getDate() - 29);
let to = new Date(LAST_DAY);
let grain = 'day';    // 'day' | 'hour'
let model = 0;        // index into MODELS, for the lower chart

/** Bars get thinner and tighter as the count grows; below ~40 they get room. */
function spacing(count) {
  if (count > 200) return { gap: 1, max: 'none' };
  if (count > 90) return { gap: 2, max: 'none' };
  if (count > 40) return { gap: 4, max: 'none' };
  return { gap: 8, max: '34px' };
}

/**
 * Draw one chart into a plot frame.
 * @param {object} nodes   {plot, axis, grid, yax}
 * @param {object[]} series
 * @param {(p:object)=>number} pick   value to draw
 * @param {string} colour  a CSS colour or var()
 */
function draw(nodes, series, pick, colour, annotate = false) {
  const { plot, axis, grid, yax } = nodes;
  const { top, values: tickValues } = ticks(Math.max(...series.map(pick), 1));
  const { gap, max } = spacing(series.length);
  const at = (v) => ((v / top) * 100).toFixed(2);

  if (grid) grid.innerHTML = tickValues.map((v) => `<span style="bottom:${at(v)}%"></span>`).join('');
  if (yax) yax.innerHTML = tickValues.map((v) =>
    `<span style="bottom:${at(v)}%">${axisLabel(v)}</span>`).join('');

  // Annotations only on the lead chart — every chart wearing them would be noise.
  const values = series.map(pick);
  const mean = values.reduce((a, b) => a + b, 0) / series.length;
  const peakIndex = values.indexOf(Math.max(...values));
  const fails = annotate ? failuresByDay() : new Map();

  if (annotate && grid) {
    grid.innerHTML += `<span class="meanline" style="bottom:${((mean / top) * 100).toFixed(2)}%">
      <b>avg ${axisLabel(Math.round(mean))}</b></span>`;
  }

  plot.style.gap = `${gap}px`;
  plot.innerHTML = series.map((p, i) => {
    const v = pick(p);
    const failed = annotate && p.date ? (fails.get(shortDate(p.date)) || 0) : 0;
    const isPeak = annotate && i === peakIndex;
    return `<div class="colw" tabindex="0" style="max-width:${max};--i:${i}">
      ${isPeak ? `<span class="peak"><b>${axisLabel(v)}</b><i></i></span>` : ''}
      <div class="col${v ? '' : ' zero'}${isPeak ? ' ispeak' : ''}" style="height:${(v / top * 100).toFixed(2)}%;background:${colour}"></div>
      ${failed ? `<span class="failtick" title="${failed} failed run${failed > 1 ? 's' : ''}"></span>` : ''}
      <span class="tip" role="tooltip"><b>${p.label}</b><br>${credits(v)} credits${
        failed ? `<br><span class="tipbad">${failed} failed run${failed > 1 ? 's' : ''}</span>` : ''}</span>
    </div>`;
  }).join('');

  // Labels are positioned, not packed into equal cells — an equal cell clips
  // "Jun 22" to "Jun 2" and the axis starts lying about its own dates.
  const wanted = series.length > 100 ? 8 : 6;
  const step = Math.max(1, Math.round(series.length / wanted));
  const last = series.length - 1;
  axis.innerHTML = series.map((p, i) => {
    if (i % step !== 0 && i !== last) return '';
    const at = `left:${(((i + 0.5) / series.length) * 100).toFixed(2)}%`;
    if (i === 0) return `<span class="xl xl-start" style="${at}">${p.label}</span>`;
    if (i === last) return `<span class="xl xl-end" style="${at}">${p.label}</span>`;
    return `<span class="xl" style="${at}">${p.label}</span>`;
  }).join('');
}

export function initSpendChart() {
  const main = {
    plot: document.getElementById('cols'), axis: document.getElementById('xax'),
    grid: document.getElementById('grid'), yax: document.getElementById('yax'),
  };
  const sub = {
    plot: document.getElementById('m-cols'), axis: document.getElementById('m-xax'),
    grid: document.getElementById('m-grid'), yax: document.getElementById('m-yax'),
  };
  if (!main.plot) return;

  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');
  const picker = document.getElementById('model-pick');
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  function series() {
    return grain === 'day' ? daySeries(from, to) : hourSeries(from, to);
  }

  function render() {
    const s = series();
    const total = s.reduce((a, p) => a + p.total, 0);
    const peak = s.reduce((b, p) => (p.total > b.total ? p : b), s[0]);
    const days = daySeries(from, to).length;

    draw(main, s, (p) => p.total, 'var(--grad-brand)', true);
    setText('t-spent', credits(total));
    setText('t-days', `${days} day${days > 1 ? 's' : ''}`);
    setText('t-avg', credits(total / days));
    setText('t-peak', credits(peak.total));
    setText('t-peakwhen', peak.label);
    setText('subline',
      `${s[0].label.split(' ').slice(0, 2).join(' ')} – ${peak && s[s.length - 1].label.split(' ').slice(0, 2).join(' ')} · by ${grain}`);

    if (sub.plot) {
      draw(sub, s, (p) => p.byModel[model], `var(--grad-m${model})`);
      const mTotal = s.reduce((a, p) => a + p.byModel[model], 0);
      setText('m-total', credits(mTotal));
      setText('m-share', `${(mTotal / total * 100).toFixed(1)}% of spend`);
      setText('m-calls', `${MODELS[model].calls.toLocaleString('en-US')} calls at ${MODELS[model].price.toFixed(2)}`);
    }
  }

  /* ── date range ─────────────────────────────────────────────────────── */
  function clampRange(changed) {
    if (to < from) { if (changed === 'from') to = new Date(from); else from = new Date(to); }
    const span = Math.round((to - from) / 86400000) + 1;
    if (span > MAX_RANGE) {
      if (changed === 'from') { to = new Date(from); to.setDate(to.getDate() + MAX_RANGE - 1); }
      else { from = new Date(to); from.setDate(from.getDate() - MAX_RANGE + 1); }
    }
    if (from < FIRST_DAY) from = new Date(FIRST_DAY);
    if (to > LAST_DAY) to = new Date(LAST_DAY);
    fromInput.value = iso(from);
    toInput.value = iso(to);
  }

  [fromInput, toInput].forEach((input, k) =>
    input?.addEventListener('change', () => {
      const v = new Date(input.value + 'T00:00:00');
      if (Number.isNaN(+v)) return;
      if (k === 0) from = v; else to = v;
      clampRange(k === 0 ? 'from' : 'to');
      render();
    })
  );

  document.querySelectorAll('[data-range]').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-range]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      to = new Date(LAST_DAY);
      from = new Date(LAST_DAY);
      from.setDate(from.getDate() - (Number(btn.dataset.range) - 1));
      clampRange('from');
      render();
    })
  );

  document.querySelectorAll('[data-grain]').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-grain]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      grain = btn.dataset.grain;
      render();
    })
  );

  /* ── model picker for the lower chart ───────────────────────────────── */
  if (picker) {
    picker.innerHTML = MODELS.map((m, i) =>
      `<option value="${i}">${m.name}</option>`).join('');
    picker.value = String(model);
    picker.addEventListener('change', () => { model = Number(picker.value); render(); });
  }

  if (fromInput && toInput) {
    fromInput.min = toInput.min = iso(FIRST_DAY);
    fromInput.max = toInput.max = iso(LAST_DAY);
    fromInput.value = iso(from);
    toInput.value = iso(to);
  }

  render();

  const runs = document.getElementById('t-runs');
  if (runs) runs.textContent = RUNS.toLocaleString('en-US');
}
