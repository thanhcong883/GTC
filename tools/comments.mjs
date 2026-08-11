#!/usr/bin/env node
/* Moderation tool. Not deployed — see .vercelignore.
 *
 *   node tools/comments.mjs list day20
 *   node tools/comments.mjs delete day20 <comment-id>
 *
 * Reads ADMIN_TOKEN from .env.local, so the secret never appears in a command
 * line or shell history.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://gtc883.vercel.app";

function env() {
  const f = path.join(ROOT, ".env.local");
  if (!fs.existsSync(f)) {
    console.error("No .env.local found. Run `vercel env pull` first.");
    process.exit(1);
  }
  return Object.fromEntries(
    fs.readFileSync(f, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}

const [cmd, page, id] = process.argv.slice(2);

if (cmd === "list") {
  if (!page) { console.error("usage: node tools/comments.mjs list <page>"); process.exit(1); }
  const r = await fetch(`${SITE}/api/comments?page=${encodeURIComponent(page)}`);
  const { comments = [] } = await r.json();
  if (!comments.length) { console.log(`No comments on ${page}.`); process.exit(0); }
  console.log(`\n${comments.length} comment(s) on ${page}\n${"-".repeat(72)}`);
  for (const c of comments) {
    console.log(`${c.id}`);
    console.log(`  ${c.author}  ·  ${new Date(c.createdAt).toLocaleString()}`);
    if (c.anchor) console.log(`  on: "${c.anchor.exact.slice(0, 70)}"`);
    console.log(`  ${c.body.replace(/\n/g, "\n  ")}\n`);
  }
  process.exit(0);
}

if (cmd === "delete") {
  if (!page || !id) {
    console.error("usage: node tools/comments.mjs delete <page> <comment-id>");
    process.exit(1);
  }
  const token = env().ADMIN_TOKEN;
  if (!token) { console.error("ADMIN_TOKEN missing from .env.local"); process.exit(1); }

  const r = await fetch(
    `${SITE}/api/comments?page=${encodeURIComponent(page)}&id=${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { "x-admin-token": token } }
  );
  const d = await r.json();
  console.log(r.ok ? `Deleted ${d.deleted}` : `Failed (${r.status}): ${d.error}`);
  process.exit(r.ok ? 0 : 1);
}

console.log("usage:\n  node tools/comments.mjs list <page>\n  node tools/comments.mjs delete <page> <id>");
