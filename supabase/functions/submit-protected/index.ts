/**
 * submit-protected — Cloudflare Turnstile + IP/WhatsApp rate limit + moderated insert.
 * Types: listing | review | gate (captcha+rate only, no DB insert).
 * Defensive only. Env: TURNSTILE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Never returns raw DB error messages to the client.
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
  // Reflect allowlisted Origin only — never "*"
  const allow = origin && isAllowedOrigin(origin) ? origin : "https://buracodeluis.vercel.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  headers: Record<string, string>,
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
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

const RATE_MAX = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
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

/** Floor window start for the current hourly bucket (UTC). */
function windowStart(now = Date.now()): string {
  const ms = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  return new Date(ms).toISOString();
}

/**
 * Rate-limit key in submit_rate_limits.ip column (IP or "whatsapp:digits").
 * Returns generic error codes only — never DB messages.
 */
async function checkAndBumpRate(
  admin: ReturnType<typeof createClient>,
  key: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const win = windowStart();
  const { data: existing, error: selErr } = await admin
    .from("submit_rate_limits")
    .select("count")
    .eq("ip", key)
    .eq("bucket", RATE_BUCKET)
    .eq("window_start", win)
    .maybeSingle();

  if (selErr) {
    console.error("rate select", selErr);
    return { ok: false, status: 500, error: "rate_check_failed" };
  }

  const prev = Number(existing?.count ?? 0);
  if (prev >= RATE_MAX) {
    return { ok: false, status: 429, error: "rate_limited" };
  }

  const nextCount = prev + 1;
  const { error: upErr } = await admin.from("submit_rate_limits").upsert(
    {
      ip: key,
      bucket: RATE_BUCKET,
      window_start: win,
      count: nextCount,
    },
    { onConflict: "ip,bucket,window_start" },
  );

  if (upErr) {
    console.error("rate upsert", upErr);
    return { ok: false, status: 500, error: "rate_update_failed" };
  }
  return { ok: true };
}

/** Prefer payload.whatsapp; fall back to contact/contacto digits when valid. */
function whatsappRateKey(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const wa =
    normalizeWhatsapp(payload.whatsapp) ||
    normalizeWhatsapp(payload.contact) ||
    normalizeWhatsapp(payload.contacto);
  return wa ? `whatsapp:${wa}` : null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return jsonResponse(headers, 405, { ok: false, error: "method_not_allowed" });
  }

  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse(headers, 403, { ok: false, error: "origin_denied" });
  }

  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!turnstileSecret || !supabaseUrl || !serviceKey) {
    console.error("missing env secrets");
    return jsonResponse(headers, 500, { ok: false, error: "server_misconfigured" });
  }

  let body: {
    type?: string;
    turnstileToken?: string;
    payload?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(headers, 400, { ok: false, error: "invalid_json" });
  }

  const type = body?.type;
  const token = String(body?.turnstileToken || "").trim();
  const payload = body?.payload && typeof body.payload === "object"
    ? body.payload
    : null;

  if (type !== "listing" && type !== "review" && type !== "gate") {
    return jsonResponse(headers, 400, { ok: false, error: "bad_type" });
  }
  if (!token) {
    return jsonResponse(headers, 400, { ok: false, error: "captcha_required" });
  }
  // gate may send empty payload {}; listing/review require a payload object
  if (type !== "gate" && !payload) {
    return jsonResponse(headers, 400, { ok: false, error: "missing_payload" });
  }

  const ip = clientIp(req);

  const captchaOk = await verifyTurnstile(token, ip, turnstileSecret);
  if (!captchaOk) {
    return jsonResponse(headers, 403, { ok: false, error: "captcha_failed" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ipRate = await checkAndBumpRate(admin, ip);
  if (!ipRate.ok) {
    return jsonResponse(headers, ipRate.status, { ok: false, error: ipRate.error });
  }

  const waKey = whatsappRateKey(payload);
  if (waKey) {
    const waRate = await checkAndBumpRate(admin, waKey);
    if (!waRate.ok) {
      return jsonResponse(headers, waRate.status, { ok: false, error: waRate.error });
    }
  }

  // Captcha + rate limit only (WhatsApp / contact flows that leave the browser)
  if (type === "gate") {
    return jsonResponse(headers, 200, { ok: true });
  }

  if (type === "listing") {
    const row = pickCols(payload!, LISTING_COLS);
    row.status = "pending";
    const wa = normalizeWhatsapp(row.whatsapp);
    if (!wa) {
      return jsonResponse(headers, 400, { ok: false, error: "bad_whatsapp" });
    }
    row.whatsapp = wa;
    if (!row.title || !row.contact_name || !row.kind) {
      return jsonResponse(headers, 400, { ok: false, error: "incomplete_listing" });
    }
    const { error: insErr } = await admin.from("listings").insert(row);
    if (insErr) {
      console.error("listing insert", insErr);
      return jsonResponse(headers, 500, { ok: false, error: "insert_failed" });
    }
    return jsonResponse(headers, 200, { ok: true });
  }

  // review
  const row = pickCols(payload!, REVIEW_COLS);
  row.status = "pending";
  const stars = Number(row.stars);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return jsonResponse(headers, 400, { ok: false, error: "bad_stars" });
  }
  row.stars = stars;
  if (!row.name || !row.contact || !row.comment) {
    return jsonResponse(headers, 400, { ok: false, error: "incomplete_review" });
  }
  const { error: revErr } = await admin.from("reviews").insert(row);
  if (revErr) {
    console.error("review insert", revErr);
    return jsonResponse(headers, 500, { ok: false, error: "insert_failed" });
  }
  return jsonResponse(headers, 200, { ok: true });
});
