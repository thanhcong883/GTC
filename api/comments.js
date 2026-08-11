import { Redis } from "@upstash/redis";

/* Vercel provisions KV_REST_API_* ; the SDK's fromEnv() looks for
   UPSTASH_REDIS_REST_* , so credentials are passed explicitly. */
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const PAGE_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_AUTHOR = 40;
const MAX_BODY = 2000;
const MAX_QUOTE = 400;
const MAX_CONTEXT = 120;
const KEEP = 500; // hard cap on stored comments per page
const SERVE = 200; // most recent returned to the client

const RATE_WINDOW = 60; // seconds
const RATE_MAX = 5; // posts per window per IP

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || "unknown";
}

/* Strip C0/C1 control characters but keep newline and tab. Comments are stored
   and served as plain text; nothing here emits HTML, and the client renders
   with textContent, so a comment can never become markup on the page. */
const CONTROL = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]",
  "g"
);

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL, "").trim().slice(0, max);
}

function readAnchor(raw) {
  if (!raw || typeof raw !== "object") return null;
  const exact = clean(raw.exact, MAX_QUOTE);
  if (!exact) return null;
  return {
    exact,
    prefix: clean(raw.prefix, MAX_CONTEXT),
    suffix: clean(raw.suffix, MAX_CONTEXT)
  };
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const page = url.searchParams.get("page") || "";
      if (!PAGE_RE.test(page)) return json({ error: "bad page id" }, 400);

      const rows = await redis.lrange(`c:${page}`, 0, SERVE - 1);
      const comments = rows
        .map((r) => (typeof r === "string" ? safeParse(r) : r))
        .filter(Boolean);
      return json({ comments });
    }

    if (request.method === "POST") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "bad json" }, 400);
      }

      const page = clean(payload.page, 32);
      if (!PAGE_RE.test(page)) return json({ error: "bad page id" }, 400);

      const author = clean(payload.author, MAX_AUTHOR) || "Ẩn danh";
      const body = clean(payload.body, MAX_BODY);
      if (!body) return json({ error: "empty comment" }, 400);

      /* Open posting was a deliberate choice, so this rate limit is the only
         thing between the page and a flood. */
      const ip = clientIp(request);
      const rateKey = `rl:${ip}`;
      const hits = await redis.incr(rateKey);
      if (hits === 1) await redis.expire(rateKey, RATE_WINDOW);
      if (hits > RATE_MAX) {
        const ttl = await redis.ttl(rateKey);
        return json(
          { error: "rate limited", retryAfter: ttl > 0 ? ttl : RATE_WINDOW },
          429
        );
      }

      const comment = {
        id: crypto.randomUUID(),
        page,
        author,
        body,
        anchor: readAnchor(payload.anchor),
        createdAt: new Date().toISOString()
      };

      await redis.lpush(`c:${page}`, JSON.stringify(comment));
      await redis.ltrim(`c:${page}`, 0, KEEP - 1);
      return json({ comment }, 201);
    }

    /* Deletion is for the site owner. Without ADMIN_TOKEN set in the project
       environment this route stays closed, rather than open by default. */
    if (request.method === "DELETE") {
      const secret = process.env.ADMIN_TOKEN;
      if (!secret) return json({ error: "deletion not configured" }, 501);
      if (request.headers.get("x-admin-token") !== secret)
        return json({ error: "forbidden" }, 403);

      const page = url.searchParams.get("page") || "";
      const id = url.searchParams.get("id") || "";
      if (!PAGE_RE.test(page) || !id) return json({ error: "bad request" }, 400);

      const rows = await redis.lrange(`c:${page}`, 0, KEEP - 1);
      const target = rows.find((r) => {
        const c = typeof r === "string" ? safeParse(r) : r;
        return c && c.id === id;
      });
      if (!target) return json({ error: "not found" }, 404);

      await redis.lrem(`c:${page}`, 1, target);
      return json({ deleted: id });
    }

    return json({ error: "method not allowed" }, 405);
  }
};
