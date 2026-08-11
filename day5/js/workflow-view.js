/* workflow-view.js
   Drill-down for one workflow, opened from a row in "Did it work?".

   The reliability table compares workflows; this answers the follow-up about a
   single one — what it cost, when, on which models, and how often it failed.
   The daily series is derived from the model matrix using this workflow's own
   model mix, so it always sums back to the total shown in the table. */

import { workflowSeries, workflowDetail, failedRuns, recentRuns, credits, stamp, ticks, axisLabel, LAST_DAY } from './data.js';

const MODEL_SLOT = { 'Gemini 3.0 Flash': 0, 'GPT-5 mini': 1, 'Gemini 3.5 Flash': 2, 'Gemini 2.5 Flash': 3 };

let current = null;      // the workflow being shown
let runFilter = 'failed'; // 'failed' | 'all'

export function initWorkflowView(router) {
  const view = document.getElementById('view-workflow');
  if (!view) return;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  function open(name) {
    current = name;
    const d = workflowDetail(name);
    const to = new Date(LAST_DAY);
    const from = new Date(LAST_DAY); from.setDate(from.getDate() - 29);
    const series = workflowSeries(name, from, to);
    const { top, values: tickValues } = ticks(Math.max(...series.map((p) => p.total), 1));
    const slot = MODEL_SLOT[d.mix[0].model.name] ?? 0;

    set('wf-name', d.name);
    set('wf-sub', `${d.runs.toLocaleString('en-US')} runs · ${d.note}`);
    set('wf-spend', credits(d.spend));
    set('wf-perrun', credits(d.perRun));
    set('wf-persuccess', credits(d.perSuccess));
    set('wf-success', `${((1 - d.rate) * 100).toFixed(1)}%`);
    set('wf-failed', d.failed
      ? `${d.failed} failed · ${credits(d.wasted)} wasted`
      : 'no failures in this window');

    const where = document.getElementById('wf-where');
    if (where) {
      where.hidden = !d.where;
      if (d.where) where.innerHTML =
        `<b>${d.failed} of ${d.runs.toLocaleString('en-US')} runs failed at ${d.where}</b>,
         costing ${credits(d.wasted)} — a failure is billed for the nodes that ran before it stopped.`;
    }

    // daily spend for this workflow, coloured by the model it mostly runs on
    const at = (v) => ((v / top) * 100).toFixed(2);
    document.getElementById('wf-grid').innerHTML =
      tickValues.map((v) => `<span style="bottom:${at(v)}%"></span>`).join('');
    document.getElementById('wf-yax').innerHTML =
      tickValues.map((v) => `<span style="bottom:${at(v)}%">${axisLabel(v)}</span>`).join('');
    document.getElementById('wf-cols').innerHTML = series.map((p) => `
      <div class="colw" tabindex="0" style="max-width:34px">
        <div class="col${p.total ? '' : ' zero'}" style="height:${(p.total / top * 100).toFixed(2)}%;background:var(--m${slot})"></div>
        <span class="tip" role="tooltip"><b>${p.label}</b><br>${credits(p.total)} credits</span>
      </div>`).join('');
    const step = Math.max(1, Math.round(series.length / 6));
    const last = series.length - 1;
    document.getElementById('wf-xax').innerHTML = series.map((p, i) => {
      if (i % step !== 0 && i !== last) return '';
      const at = `left:${(((i + 0.5) / series.length) * 100).toFixed(2)}%`;
      if (i === 0) return `<span class="xl xl-start" style="${at}">${p.label}</span>`;
      if (i === last) return `<span class="xl xl-end" style="${at}">${p.label}</span>`;
      return `<span class="xl" style="${at}">${p.label}</span>`;
    }).join('');

    // which models this workflow actually spends on
    document.getElementById('wf-mix').innerHTML = d.mix.map((m) => {
      const s = MODEL_SLOT[m.model.name];
      return `
        <div class="hb"><div class="top">
          <span class="nm">${m.model.name}</span>
          <span class="vl">${credits(m.spend)}</span></div>
          <div class="tr"><div class="fi" style="width:${(m.spend / d.spend * 100).toFixed(1)}%;background:var(--m${s})"></div></div>
          <div class="sub">${(m.spend / d.spend * 100).toFixed(1)}% of this workflow · ${credits(m.model.price)} per call</div>
        </div>`;
    }).join('');

    renderRuns();

    // go() is a no-op if we are already on this route, which is what we want:
    // the content above has been re-rendered for the newly picked workflow.
    router.go('workflow');
  }

  /** The runs table — the list "26 failures" expands into. */
  function renderRuns() {
    const body = document.getElementById('wf-runs');
    const note = document.getElementById('wf-runsnote');
    if (!body || !current) return;

    const failed = failedRuns(current);

    if (runFilter === 'failed') {
      body.innerHTML = failed.length
        ? failed.map((r) => `
            <tr>
              <td><span class="st bd"><i></i>Failed</span></td>
              <td><span class="rn">${r.subject}</span>
                <small class="dim errline">${r.error}</small></td>
              <td class="mono">${r.node}</td>
              <td class="num mono">${credits(r.cost)}</td>
              <td class="num mono dim">${stamp(r.when)}</td>
            </tr>`).join('')
        : `<tr><td colspan="5" class="emptyrow">No failed runs in this window.</td></tr>`;
      note.textContent = failed.length
        ? `All ${failed.length} failures in the window, newest first. Each was billed ${credits(failed[0].cost)} for the nodes that ran before it stopped — ${credits(failed.reduce((a, r) => a + r.cost, 0))} in total.`
        : 'Nothing failed here in the last 30 days.';
    } else {
      body.innerHTML = recentRuns(current).map((r) => `
        <tr>
          <td><span class="st ok"><i></i>Completed</span></td>
          <td><span class="rn">${r.subject}</span></td>
          <td class="mono dim">ran to completion</td>
          <td class="num mono">${credits(r.cost)}</td>
          <td class="num mono dim">${stamp(r.when)}</td>
        </tr>`).join('');
      note.textContent = 'A sample of recent successful runs. Listing every run would repeat what the totals already say.';
    }

    document.querySelectorAll('[data-runs]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.runs === runFilter)));
  }

  document.querySelectorAll('[data-runs]').forEach((btn) =>
    btn.addEventListener('click', () => { runFilter = btn.dataset.runs; renderRuns(); }));

  // rows in the reliability table become the entry point
  document.getElementById('rel-body')?.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-workflow]');
    if (row) open(row.dataset.workflow);
  });
  document.getElementById('rel-body')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('tr[data-workflow]');
    if (row) { e.preventDefault(); open(row.dataset.workflow); }
  });

  // handed back so any other panel can open a workflow too
  return open;
}
