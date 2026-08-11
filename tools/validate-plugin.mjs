#!/usr/bin/env node
/* The publish gates from the Day 20 page, as code. Not deployed.
 *
 *   node tools/validate-plugin.mjs day20/plugin/acme-crm.plugin.yaml
 *
 * The page claims a registry would reject a manifest with a dangling reference
 * or an undeclared egress destination. A claim like that should be executable,
 * or the sample quietly rots until a reader finds the hole first.
 */
import fs from "node:fs";
import { parse } from "yaml";
import { createHash } from "node:crypto";

const file = process.argv[2] || "day20/plugin/acme-crm.plugin.yaml";
const doc = parse(fs.readFileSync(file, "utf8"));
const spec = doc.spec || {};
const tools = spec.tools || [];
const ids = new Set(tools.map((t) => t.id));

const failures = [];
const gate = (name, ok, detail) => { if (!ok) failures.push({ name, detail }); };

/* ---- references resolve ------------------------------------------------- */
for (const r of spec.ui?.resources || []) {
  for (const t of r.tools || []) {
    gate("ui-resource-tool-exists", ids.has(t),
      `ui resource ${r.uri} references undefined tool ${t}`);
  }
}
for (const t of tools) {
  const undo = t.effect?.reversibility?.undo_tool;
  if (undo) {
    gate("undo-tool-exists", ids.has(undo),
      `${t.id}: undo_tool ${undo} is not defined in this plugin`);
  }
}

/* ---- every tool declares what a reviewer must see ----------------------- */
for (const t of tools) {
  gate("output-schema", !!t.output_schema, `${t.id}: missing output_schema`);
  gate("effect-declared", Array.isArray(t.effect?.classes) && t.effect.classes.length,
    `${t.id}: effect.classes missing or empty`);

  const writes = (t.effect?.classes || []).some((c) => c !== "read");
  if (writes) {
    gate("reversibility-declared", !!t.effect?.reversibility,
      `${t.id}: a non-read effect must declare reversibility`);
    gate("idempotency", !!t.execution?.idempotency,
      `${t.id}: a write needs an idempotency strategy`);
    gate("no-silent-write-fallback",
      t.availability?.on_unavailable !== "cached_read",
      `${t.id}: a write must not fall back to a cached read`);
  }
  if (t.effect?.reversibility?.mode === "irreversible") {
    gate("no-retry-on-irreversible",
      (t.execution?.retry_policy?.max_attempts ?? 1) === 1,
      `${t.id}: irreversible effects must not auto-retry`);
    gate("approval-required", t.approval?.policy === "always",
      `${t.id}: irreversible effects require approval.policy: always`);
    gate("host-rendered-surface", t.approval?.surface === "host_rendered",
      `${t.id}: approval surface must be host_rendered, never the plugin's UI`);
  }
}

/* ---- schema hygiene ----------------------------------------------------- */
for (const t of tools) {
  const s = t.input_schema || {};
  gate("closed-input-schema", s.additionalProperties === false,
    `${t.id}: input_schema must set additionalProperties: false`);
  for (const r of s.required || []) {
    gate("required-is-declared", !!(s.properties || {})[r],
      `${t.id}: required field "${r}" has no property definition`);
  }
  for (const sys of spec.runtime_envelope?.system_supplied || []) {
    gate("no-system-field-in-schema", !(s.properties || {})[sys],
      `${t.id}: "${sys}" is system-supplied and must not appear in input_schema`);
  }
}

/* ---- egress is declared once, at the top ------------------------------- */
const declaredHosts = new Set(spec.egress?.destinations || []);
const declaredClasses = new Set(spec.egress?.data_classes || []);
for (const t of tools) {
  for (const d of t.effect?.destinations || []) {
    gate("destination-declared", declaredHosts.has(d),
      `${t.id}: destination ${d} is not in spec.egress.destinations`);
  }
  for (const c of t.effect?.data_classes || []) {
    gate("data-class-declared", declaredClasses.has(c),
      `${t.id}: data class ${c} is not in spec.egress.data_classes`);
  }
}
const csp = spec.ui?.requested_csp_origins || {};
for (const host of [
  ...(csp.connect_src || []),
  ...(csp.script_src || []),
  ...(csp.img_src || []),
  ...(csp.frame_src || [])
]) {
  gate("ui-origin-declared", declaredHosts.has(host),
    `UI CSP origin ${host} is a second egress surface and must be declared in spec.egress`);
}

/* ---- the approval SLA cannot outlive the task --------------------------
   ttlMs is set by the server per task, so publish time cannot read the real
   value. What is checkable here is that the publisher committed to a floor and
   that the SLA fits inside it. PAL still re-checks the actual ttlMs at runtime. */
const hours = (d) => (/^PT([0-9]+)H$/.exec(d || "") || [])[1];
for (const t of tools) {
  const sla = t.availability?.approval_deadline;
  if (!sla || !t.execution?.task_support) continue;
  const floor = t.execution?.guaranteed_min_task_ttl;
  gate("approval-sla-declared", !!hours(sla),
    `${t.id}: approval_deadline must be an ISO duration such as PT4H`);
  gate("task-ttl-floor-declared", !!floor,
    `${t.id}: task_support with an approval deadline requires guaranteed_min_task_ttl`);
  if (hours(sla) && hours(floor)) {
    gate("approval-sla-fits-ttl", Number(hours(sla)) <= Number(hours(floor)),
      `${t.id}: approval_deadline ${sla} exceeds guaranteed_min_task_ttl ${floor}`);
  }
}

/* ---- report -------------------------------------------------------------
   A reviewer can fetch the manifest but not this validator, so the claim that
   the gates are executable has to travel as evidence: a signed-shaped report
   carrying the manifest digest and the result of every gate. */
const ALL_GATES = [
  "ui-resource-tool-exists", "undo-tool-exists", "output-schema", "effect-declared",
  "reversibility-declared", "idempotency", "no-silent-write-fallback",
  "no-retry-on-irreversible", "approval-required", "host-rendered-surface",
  "closed-input-schema", "required-is-declared", "no-system-field-in-schema",
  "destination-declared", "data-class-declared", "ui-origin-declared",
  "approval-sla-declared", "task-ttl-floor-declared", "approval-sla-fits-ttl"
];

const reportPath = process.argv.includes("--report")
  ? process.argv[process.argv.indexOf("--report") + 1]
  : null;

if (reportPath) {
  const raw = fs.readFileSync(file);
  const digest = createHash("sha256").update(raw).digest("hex");
  const failed = new Set(failures.map((f) => f.name));
  fs.writeFileSync(reportPath, JSON.stringify({
    manifest: file.split("/").pop(),
    manifest_sha256: digest,
    manifest_bytes: raw.length,
    validator: "tools/validate-plugin.mjs",
    plugin: { id: doc.metadata?.id, version: doc.metadata?.version },
    tools: [...ids],
    gates: ALL_GATES.map((g) => ({
      gate: g,
      result: failed.has(g) ? "fail" : "pass",
      details: (byGateOf(failures, g) || undefined)
    })),
    result: failures.length ? "rejected" : "accepted",
    note: "Regenerate with: node tools/validate-plugin.mjs <manifest> --report <path>"
  }, null, 2) + "\n");
  console.log(`  report written: ${reportPath}`);
  console.log(`  manifest sha256: ${digest}`);
}

function byGateOf(list, name) {
  const d = list.filter((f) => f.name === name).map((f) => f.detail);
  return d.length ? d : null;
}

const total = tools.length;
console.log(`\n${file}`);
console.log(`${total} tool(s): ${[...ids].join(", ")}\n${"-".repeat(72)}`);

if (!failures.length) {
  console.log(`  PASS  all ${ALL_GATES.length} publish gates satisfied`);
  process.exit(0);
}
const byGate = {};
for (const f of failures) (byGate[f.name] ||= []).push(f.detail);
for (const [name, details] of Object.entries(byGate)) {
  console.log(`  FAIL  ${name}`);
  for (const d of details) console.log(`          ${d}`);
}
console.log(`\n  ${failures.length} failure(s)\n`);
process.exit(1);
