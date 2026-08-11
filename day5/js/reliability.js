/* reliability.js
   Did the work succeed, and what did the failures cost?

   A cost dashboard that never mentions failure is half a dashboard: a failed
   run is still billed, so every failure is a purchase of nothing. The column
   that earns its place is "per success" — credits per run that actually
   worked — because that is the number two workflows should be compared on. */

import { RELIABILITY, WASTED, SPENT, RUNS, RUNS_FAILED, credits } from './data.js';

export function initReliability() {
  const body = document.getElementById('rel-body');
  if (!body) return;

  const worst = RELIABILITY.reduce((a, r) => (r.wasted > a.wasted ? r : a), RELIABILITY[0]);
  const most = RELIABILITY.reduce((a, r) => (r.failed > a.failed ? r : a), RELIABILITY[0]);

  body.innerHTML = RELIABILITY.map((r) => {
    const ok = 1 - r.rate;
    const tone = r.rate === 0 ? 'ok' : r.rate < 0.01 ? 'ok' : r.rate < 0.05 ? 'sp' : 'bd';
    return `
      <tr data-workflow="${r.name}" tabindex="0" class="clickable">
        <td><span class="rn">${r.name}</span><span class="chev">›</span>${
          r.where ? `<small class="dim"> · fails at ${r.where}</small>` : ''}</td>
        <td class="num mono">${r.runs.toLocaleString('en-US')}</td>
        <td class="num"><span class="st ${tone}"><i></i>${(ok * 100).toFixed(1)}%</span></td>
        <td class="num mono">${credits(r.perRun)}</td>
        <td class="num mono strong">${credits(r.perSuccess)}</td>
        <td class="num mono">${r.wasted ? credits(r.wasted) : '—'}</td>
      </tr>`;
  }).join('');

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('rel-wasted', credits(WASTED));
  set('rel-share', `${(WASTED / SPENT * 100).toFixed(1)}% of spend`);
  set('rel-rate', `${((1 - RUNS_FAILED / RUNS) * 100).toFixed(1)}%`);
  set('rel-persuccess', credits(SPENT / (RUNS - RUNS_FAILED)));

  const line = document.getElementById('rel-insight');
  if (line) {
    line.innerHTML = `<b>${most.failed} failures of ${most.name}</b> cost
      ${credits(most.wasted)}; <b>${worst.failed} of ${worst.name}</b> cost
      ${credits(worst.wasted)}. Failure is priced by where it happens, not how often —
      an expensive workflow is expensive to get wrong.`;
  }
}
