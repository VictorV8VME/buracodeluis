# Edge Function: `submit-protected`

Defensive submit path for listings and reviews: Cloudflare Turnstile verification + IP rate limit (8 / 10 min) + insert as `pending` via service role.

**Parent / Victor deploys — do not push or deploy from the coding agent unless asked.**

## Prerequisites

1. Apply SQL in Dashboard → SQL Editor:
   - `supabase/submit-rate-limits.sql` (creates `submit_rate_limits`, drops anon insert policies)
2. Cloudflare Turnstile widget created; **site key** is public in `index.html` (`SITE.turnstileSiteKey`).
3. Secret key stored locally only at `.secrets/turnstile-secret.txt` (mode 600, gitignored). Never commit it.

## Secrets (Dashboard)

Supabase Dashboard → **Edge Functions** → **Secrets** (or Project Settings → Edge Functions):

| Name | Value |
|------|--------|
| `TURNSTILE_SECRET_KEY` | contents of `.secrets/turnstile-secret.txt` |
| `SUPABASE_URL` | usually auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | usually auto-injected (service role) |

If CLI deploy does not inject URL/service role, set them explicitly to the project values.

## Deploy (CLI)

```bash
# from repo root, logged in to the right project
supabase functions deploy submit-protected --project-ref kslhlktxlgtgoquhjhnz
```

Or link first:

```bash
supabase link --project-ref kslhlktxlgtgoquhjhnz
supabase functions deploy submit-protected
```

Set secret via CLI (optional):

```bash
supabase secrets set TURNSTILE_SECRET_KEY="$(cat .secrets/turnstile-secret.txt)"
```

## Deploy (Dashboard)

1. Edge Functions → Create / upload `submit-protected` with `index.ts`
2. Add secrets as above
3. Confirm URL matches front:  
   `https://kslhlktxlgtgoquhjhnz.supabase.co/functions/v1/submit-protected`

## Request shape

`POST` JSON:

```json
{
  "type": "listing" | "review",
  "turnstileToken": "<token>",
  "payload": { }
}
```

Success: `{ "ok": true }`. Rate limit: HTTP 429. Captcha fail: 403.

CORS allowlist: `https://buracodeluis.vercel.app` and `http://localhost:*` / `http://127.0.0.1:*` (Origin reflected).

## Front

`index.html` posts here with Turnstile token; honeypot + client cooldown remain as extra filters only.
