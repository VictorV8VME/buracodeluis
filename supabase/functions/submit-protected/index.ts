/**
 * submit-protected — Cloudflare Turnstile + IP rate limit + moderated insert.
 * Defensive only. Env: TURNSTILE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = new Set([
  "https://buracodeluis.vercel.app",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Local dev: http://localhost:* or http://127.0.0.1:*
  try {
    const u = new URL(origin);
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && isAllowedOrigin(origin) ? origin : "https://buracodeluis.vercel.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim().slice(0, 64);
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return "unknown";
}

const LISTING_COLS = new Set([
  "kind",
  "title",
  "description",
  "rubro",
  "category",
  "zone",
  "city",
  "price_label",
  "price_min_label",
  "contact_name",
  "whatsapp",
  "lat",
  "lng",
  "ends_at",
]);

const REVIEW_COLS = new Set([
  "name",
  "contact",
  "stars",
  "comment",
  "city",
  "rubro",
  "listing_id",
]);

const RATE_MAX = 8;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_BUCKET = "submit";

function pickCols(
  payload: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(payload || {})) {
    if (allowed.has(key) && key !== "status") {
      out[key] = payload[key];
    }
  }
  return out;
}

function normalizeWhatsapp(w: unknown): string | null {
  const digits = String(w ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

async function verifyTurnstile(
  token: string,
  ip: string,
  secret: string,
): Promise<boolean> {
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data?.success);
}

/** Floor window start for the current 10-minute bucket (UTC). */
function windowStart(now = Date.now()): string {
  const ms = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  return new Date(ms).toISOString();
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ ok: false, error: "origin_denied" }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!turnstileSecret || !supabaseUrl || !serviceKey) {
    console.error("missing env secrets");
    return new Response(JSON.stringify({ ok: false, error: "server_misconfigured" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  let body: {
    type?: string;
    turnstileToken?: string;
    payload?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const type = body?.type;
  const token = String(body?.turnstileToken || "").trim();
  const payload = body?.payload && typeof body.payload === "object"
    ? body.payload
    : null;

  if (type !== "listing" && type !== "review") {
    return new Response(JSON.stringify({ ok: false, error: "bad_type" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "captcha_required" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  if (!payload) {
    return new Response(JSON.stringify({ ok: false, error: "missing_payload" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const ip = clientIp(req);

  const captchaOk = await verifyTurnstile(token, ip, turnstileSecret);
  if (!captchaOk) {
    return new Response(JSON.stringify({ ok: false, error: "captcha_failed" }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const win = windowStart();
  const { data: existing, error: selErr } = await admin
    .from("submit_rate_limits")
    .select("count")
    .eq("ip", ip)
    .eq("bucket", RATE_BUCKET)
    .eq("window_start", win)
    .maybeSingle();

  if (selErr) {
    console.error("rate select", selErr);
    return new Response(JSON.stringify({ ok: false, error: "rate_check_failed" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const prev = Number(existing?.count ?? 0);
  if (prev >= RATE_MAX) {
    return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
      status: 429,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const nextCount = prev + 1;
  const { error: upErr } = await admin.from("submit_rate_limits").upsert(
    {
      ip,
      bucket: RATE_BUCKET,
      window_start: win,
      count: nextCount,
    },
    { onConflict: "ip,bucket,window_start" },
  );

  if (upErr) {
    console.error("rate upsert", upErr);
    return new Response(JSON.stringify({ ok: false, error: "rate_update_failed" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (type === "listing") {
    const row = pickCols(payload, LISTING_COLS);
    row.status = "pending";
    const wa = normalizeWhatsapp(row.whatsapp);
    if (!wa) {
      return new Response(JSON.stringify({ ok: false, error: "bad_whatsapp" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    row.whatsapp = wa;
    if (!row.title || !row.contact_name || !row.kind) {
      return new Response(JSON.stringify({ ok: false, error: "incomplete_listing" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const { error: insErr } = await admin.from("listings").insert(row);
    if (insErr) {
      console.error("listing insert", insErr);
      return new Response(JSON.stringify({ ok: false, error: "insert_failed" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // review
  const row = pickCols(payload, REVIEW_COLS);
  row.status = "pending";
  const stars = Number(row.stars);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return new Response(JSON.stringify({ ok: false, error: "bad_stars" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  row.stars = stars;
  if (!row.name || !row.contact || !row.comment) {
    return new Response(JSON.stringify({ ok: false, error: "incomplete_review" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  const { error: revErr } = await admin.from("reviews").insert(row);
  if (revErr) {
    console.error("review insert", revErr);
    return new Response(JSON.stringify({ ok: false, error: "insert_failed" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
});
