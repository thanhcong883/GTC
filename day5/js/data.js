/* data.js
   Every number the interface shows comes from here, so no figure is invented
   inside a view. The whole set reconciles: the daily matrix sums to the model
   totals, the model totals sum to the workflow totals, and those sum to spend.

   Billing rule, flat per LLM node call regardless of prompt or output length:
     Gemini 2.5 Flash    1.00   what Router nodes run on
     Gemini 3.0 Flash    2.00   pinned agents and gates
     GPT-5 mini          5.00   what a node left on Auto resolves to
     Gemini 3.5 Flash   10.00   what Mindie runs on
*/

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Workspace plan. Advanced: $149/mo. */
export const PLAN = {
  name: 'Advanced',
  allowance: 30000,
  storageGb: 25,
  storageUsedGb: 6.4,
  editorSeats: 5,
  userSeats: 20,
  renews: '1 Aug',
};

/* Models, in the fixed order used by every chart and legend. Colours are
   assigned by this order and never cycled — a model keeps its colour even when
   a filter removes the others. Palette validated for light and dark surfaces:
   lightness band, chroma floor, CVD separation and contrast all pass. */
export const MODELS = [
  { id: 'g30', name: 'Gemini 3.0 Flash', price: 2,  spend: 10400, calls: 5200 },
  { id: 'g5m', name: 'GPT-5 mini',       price: 5,  spend: 1800,  calls: 360 },
  { id: 'g35', name: 'Gemini 3.5 Flash', price: 10, spend: 1300,  calls: 130 },
  { id: 'g25', name: 'Gemini 2.5 Flash', price: 1,  spend: 720,   calls: 720 },
];

/** Total spend over the window. Equals the sum of MODELS[].spend. */
export const SPENT = MODELS.reduce((a, m) => a + m.spend, 0);   // 14,220
export const REMAINING = PLAN.allowance - SPENT;                // 15,780
export const RUNS = 4250;
export const RUNS_FAILED = 37;


/** What ran, and what it cost. Sums to SPENT. */
export const WORKFLOWS = [
  { name: 'EVAL-A-runner',       runs: 3100, spend: 6200, note: '1 agent node · 2.00 each' },
  { name: 'EVAL-B-lead-qual',    runs: 900,  spend: 3600, note: '600 complete, 300 stopped at the gate' },
  { name: 'Competitor Research', runs: 120,  spend: 3120, note: '8 nodes · 26.00 each' },
  { name: 'Mindie generation',   runs: 130,  spend: 1300, note: '10.00 per generation' },
];

/* Reliability. A failed run is still billed, so a failure has a price — but it
   is the price of the nodes that ran before it stopped, not the run's average.
   Averaging would overstate a workflow that fails early and understate one that
   fails late, so where each one fails is recorded rather than inferred. */
const FAILURES = {
  'EVAL-A-runner':       { failed: 8,  costEach: 2,  where: 'the single agent node' },
  'EVAL-B-lead-qual':    { failed: 26, costEach: 2,  where: 'the gate, on unresolved variable refs' },
  'Competitor Research': { failed: 3,  costEach: 21, where: 'the email stage, after the loop had run' },
  'Mindie generation':   { failed: 0,  costEach: 0,  where: null },
};

export const RELIABILITY = WORKFLOWS.map((w) => {
  const f = FAILURES[w.name];
  return {
    name: w.name,
    runs: w.runs,
    failed: f.failed,
    where: f.where,
    rate: f.failed / w.runs,
    perRun: w.spend / w.runs,
    /** The figure that matters when comparing workflows: credits per run that worked. */
    perSuccess: w.spend / (w.runs - f.failed),
    wasted: f.failed * f.costEach,
  };
});

export const WASTED = RELIABILITY.reduce((a, r) => a + r.wasted, 0);

/** Spend by workspace member. Sums to SPENT. Five editor seats are in use. */
export const MEMBERS = [
  { name: 'Công Giang Thành', role: 'Owner',  spend: 6840, you: true },
  { name: 'Trần Minh Anh',    role: 'Editor', spend: 3270 },
  { name: 'Lê Quốc Bảo',      role: 'Editor', spend: 2130 },
  { name: 'Phạm Thu Hà',      role: 'Editor', spend: 1280 },
  { name: 'Đỗ Nam Khánh',     role: 'Editor', spend: 700 },
];

/** Agents and workflows the composer can run, with what one run costs. */
export const RUNNABLE = [
  { name: 'VietDesk Support Assistant', kind: 'Agent',    model: 'Gemini 3.0 Flash', cost: 2 },
  { name: 'EVAL-A-runner',              kind: 'Workflow', model: 'Gemini 3.0 Flash', cost: 2 },
  { name: 'EVAL-B-lead-qual',           kind: 'Workflow', model: 'Gemini 3.0 Flash', cost: 5 },
  { name: 'Competitor Research',        kind: 'Workflow', model: 'Mixed · 8 nodes',  cost: 26 },
  { name: 'Refund Resolver',            kind: 'Agent',    model: 'GPT-5 mini',       cost: 5 },
];

export const SPEND_END = new Date(2026, 6, 21);

/* Daily spend for the 30 days ending SPEND_END, split by model in MODELS order.
   Row sums are the daily totals; column sums are MODELS[].spend. Both exact. */
export const DAILY_BY_MODEL = [
  [ 470,   58,   41,   23], [ 432,   65,   49,   31], [ 300,   45,   40,   21],
  [ 445,   60,   52,   31], [ 454,   58,   62,   33], [ 126,    3,    9,   10],
  [ 120,    3,   10,   10], [ 375,   56,   39,   27], [ 474,   70,   51,   31],
  [ 480,   63,   51,   31], [ 414,   48,   43,   23], [ 207,    4,   14,   17],
  [ 121,    4,   13,   12], [ 173,    4,   12,   14], [ 326,   39,   29,   15],
  [ 309,   33,   31,   17], [ 466,   61,   49,   33], [ 327,   43,   30,   17],
  [ 422,   58,   46,   29], [ 120,    3,   10,   11], [ 111,    3,    9,   11],
  [ 355,   52,   43,   20], [ 541,  287,  158,   54], [ 477,   49,   43,   22],
  [ 357,   42,   34,   23], [ 357,   44,   38,   24], [ 164,    5,   16,   18],
  [ 156,    4,   11,   11], [ 416,   48,   48,   23], [ 905,  488,  219,   78],
];

/* Shape of a working day, applied to every date to derive its 24 hourly
   buckets. Overnight is near-idle; the two humps are the morning and afternoon
   blocks, which is what a scheduled workload actually looks like. The buckets
   for a day always sum back to that day's recorded total. */
const HOUR_CURVE = [0.20, 0.15, 0.10, 0.10, 0.15, 0.30, 0.70, 1.40,
                    2.60, 3.40, 3.80, 3.50, 2.40, 2.90, 3.60, 3.90,
                    3.50, 2.80, 1.90, 1.30, 0.90, 0.60, 0.40, 0.30];
const CURVE_SUM = HOUR_CURVE.reduce((a, b) => a + b, 0);

/** The window the Usage view may look at. */
export const MAX_RANGE = 31;
export const FIRST_DAY = (() => { const d = new Date(SPEND_END); d.setDate(d.getDate() - 29); return d; })();
export const LAST_DAY = SPEND_END;

/** "2026-07-21" — the value format the date inputs use. */
export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayIndex = (d) => Math.round((d - FIRST_DAY) / 86400000);

/**
 * Daily rows between two dates, inclusive.
 * @returns {{label: string, date: Date, byModel: number[], total: number}[]}
 */
export function daySeries(from, to) {
  const a = Math.max(0, dayIndex(from));
  const b = Math.min(DAILY_BY_MODEL.length - 1, dayIndex(to));
  const out = [];
  for (let i = a; i <= b; i++) {
    const date = new Date(FIRST_DAY);
    date.setDate(FIRST_DAY.getDate() + i);
    const byModel = DAILY_BY_MODEL[i];
    out.push({ label: shortDate(date), date, byModel, total: byModel.reduce((x, y) => x + y, 0) });
  }
  return out;
}

/**
 * Hourly buckets across the same window — 24 per day, so the axis spans the
 * whole range rather than a single unnamed day.
 * @returns {{label: string, date: Date, hour: number, byModel: number[], total: number}[]}
 */
export function hourSeries(from, to) {
  const out = [];
  for (const day of daySeries(from, to)) {
    let acc = 0;
    for (let h = 0; h < 24; h++) {
      const share = HOUR_CURVE[h] / CURVE_SUM;
      const v = h === 23 ? day.total - acc : Math.round(day.total * share);
      acc += v;
      out.push({
        label: `${day.label} ${String(h).padStart(2, '0')}:00`,
        date: day.date, hour: h,
        byModel: day.byModel.map((m) => m * share),
        total: v,
      });
    }
  }
  return out;
}

/* Each workflow runs a known mix of models, so its daily spend is *derived*
   from the model matrix rather than invented. The mix below reconciles twice:
   each row sums to that workflow's total, and each column sums to that model's.

     workflow              g3.0   g5m   g3.5  g2.5   total
     EVAL-A-runner         6200     0      0     0    6200
     EVAL-B-lead-qual      3000     0      0   600    3600
     Competitor Research   1200  1800      0   120    3120
     Mindie generation        0     0   1300     0    1300
                          10400  1800   1300   720   14220                    */
const WORKFLOW_MIX = {
  'EVAL-A-runner':       [6200, 0, 0, 0],
  'EVAL-B-lead-qual':    [3000, 0, 0, 600],
  'Competitor Research': [1200, 1800, 0, 120],
  'Mindie generation':   [0, 0, 1300, 0],
};

/** A workflow's share of each model's spend, used to split the daily matrix. */
const mixShare = (name) => {
  const totals = [10400, 1800, 1300, 720];
  return WORKFLOW_MIX[name].map((v, i) => (totals[i] ? v / totals[i] : 0));
};

/**
 * Daily spend for one workflow over a window, derived from the model matrix.
 * Rounding drift is pushed onto the last day so the series still sums to the
 * workflow's recorded total.
 * @returns {{label: string, date: Date, total: number}[]}
 */
export function workflowSeries(name, from, to) {
  const share = mixShare(name);
  const rows = daySeries(from, to);
  const raw = rows.map((r) => r.byModel.reduce((a, v, i) => a + v * share[i], 0));
  const target = WORKFLOW_MIX[name].reduce((a, b) => a + b, 0)
    * (raw.reduce((a, b) => a + b, 0) / (mixShare(name).reduce((a, s, i) => a + s * [10400, 1800, 1300, 720][i], 0) || 1));
  let acc = 0;
  return rows.map((r, i) => {
    const v = i === rows.length - 1 ? Math.round(target - acc) : Math.round(raw[i]);
    acc += v;
    return { label: r.label, date: r.date, total: Math.max(0, v) };
  });
}

/** One workflow's full profile, for the drill-down view. */
export function workflowDetail(name) {
  const wf = WORKFLOWS.find((w) => w.name === name);
  const rel = RELIABILITY.find((r) => r.name === name);
  const mix = WORKFLOW_MIX[name].map((spend, i) => ({ model: MODELS[i], spend }))
    .filter((m) => m.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  return { ...wf, ...rel, mix };
}

/* Individual runs, so "26 failures" can be opened and read rather than trusted.
   Only what a failure needs is recorded: which node stopped it, what it said,
   and what it still cost. Successful runs are sampled — listing 3,100 of them
   would say nothing the totals do not already say. */
const FAILURE_DETAIL = {
  'EVAL-A-runner': {
    node: 'Agent · VietDesk reply',
    error: 'Model returned an empty completion',
    cost: 2,
    subjects: ['Team plan seats', 'refund window', 'student discount', 'SLA question',
               'data residency', 'injection probe', 'seat upgrade', 'billing export'],
  },
  'EVAL-B-lead-qual': {
    node: 'Gate · qualify',
    error: 'Unresolved variable reference: @monthly_budget_usd',
    cost: 2,
    burst: { from: 13, span: 5 },   // broke 13 days ago, fixed five days later
    subjects: ['Nordwind Logistics', 'Meridian Systems', 'Solo Freelance Studio', 'Vertex Labs',
               'Halden & Co', 'Brightpath', 'Nordwind Logistics', 'Kessler Group',
               'Ironwood Media', 'Larkspur Health', 'Ostrom Retail', 'Vantage Foods',
               'Nordwind Logistics', 'Pinehurst Legal', 'Calder Systems', 'Wren Analytics',
               'Ashby Freight', 'Delphi Studio', 'Nordwind Logistics', 'Marlow Interiors',
               'Ferro Metals', 'Quill Press', 'Sable Energy', 'Tarn Robotics',
               'Umber Design', 'Vireo Travel'],
  },
  'Competitor Research': {
    node: 'Agent · Format email delivery',
    error: 'Upstream node output exceeded the context window',
    cost: 21,
    subjects: ['Notion', 'Airtable', 'Coda'],
  },
  'Mindie generation': { node: null, error: null, cost: 0, subjects: [] },
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Every failed run of a workflow, newest first — this is what "26 failures"
 * expands into.
 * @returns {{subject: string, when: Date, node: string, error: string, cost: number}[]}
 */
export function failedRuns(name) {
  const d = FAILURE_DETAIL[name];
  if (!d || !d.subjects.length) return [];
  return d.subjects.map((subject, i) => {
    const when = new Date(LAST_DAY);
    // Failures cluster the way real ones do: EVAL-B's gate broke for five days
    // and was then fixed, while the other two fail occasionally at random. A
    // burst is a story the timeline can show; an even sprinkle is just noise.
    const daysBack = d.burst
      ? d.burst.from - Math.floor(i / Math.ceil(d.subjects.length / d.burst.span))
      : [2, 7, 11, 16, 19, 23, 26, 28][i % 8];
    when.setDate(when.getDate() - daysBack);
    when.setHours(9 + ((i * 5) % 9), (i * 17) % 60, 0, 0);
    return { subject, when, node: d.node, error: d.error, cost: d.cost };
  });
}

/** A short sample of successful runs, for context beside the failures. */
export function recentRuns(name, n = 6) {
  const d = FAILURE_DETAIL[name];
  const wf = WORKFLOWS.find((w) => w.name === name);
  const per = wf.spend / wf.runs;
  const pool = d.subjects.length ? d.subjects : ['workflow draft', 'agent revision', 'node rename'];
  return Array.from({ length: n }, (_, i) => {
    const when = new Date(LAST_DAY);
    when.setDate(when.getDate() - Math.floor(i / 2));
    when.setHours(17 - i, 45 - (i * 7) % 45, 0, 0);
    return { subject: pool[(i * 3 + 1) % pool.length], when, cost: per, ok: true };
  });
}

/**
 * Failures per calendar day, across every workflow — what the timeline marks.
 * @returns {Map<string, number>} keyed by shortDate, e.g. "Jul 21" -> 3
 */
export function failuresByDay() {
  const out = new Map();
  for (const w of WORKFLOWS) {
    for (const r of failedRuns(w.name)) {
      const k = shortDate(r.when);
      out.set(k, (out.get(k) || 0) + 1);
    }
  }
  return out;
}

/** "Jul 21 · 14:02" */
export const stamp = (d) => `${shortDate(d)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/**
 * Axis ticks that land on readable numbers.
 *
 * Splitting the top into a fixed four gave values like 0 / 8 / 15 / 23 / 30 —
 * 7.5 rounded twice, and an axis whose own labels are rounded is an axis that
 * misplaces its gridlines. Instead the top is divided into whatever count of
 * 3, 4 or 5 yields a clean step.
 *
 * @param {number} max  the largest value to fit
 * @returns {{top: number, values: number[]}}
 */
export function ticks(max) {
  const pow = 10 ** Math.floor(Math.log10(max || 1));
  let top = 10 * pow;
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (step * pow >= max) { top = step * pow; break; }
  }
  const isNice = (v) => {
    const p = 10 ** Math.floor(Math.log10(v));
    return [1, 2, 2.5, 5, 10].includes(Math.round((v / p) * 10) / 10);
  };
  const count = [4, 5, 3].find((n) => isNice(top / n)) || 4;
  return { top, values: Array.from({ length: count + 1 }, (_, i) => (top / count) * i) };
}

/** Credits are a currency: two decimals under 1,000, thousands separators above. */
export const credits = (n) =>
  n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toFixed(2);

/** Axis labels drop the decimals a currency needs — "500", not "500.00". */
export const axisLabel = (n) =>
  Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(2);

/** "Jul 21" */
export const shortDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
