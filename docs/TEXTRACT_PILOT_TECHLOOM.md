# KAIONEX FMS — Amazon Textract pilot (Techloom)

Pilot OCR for **Add Entry → Scan / Upload Bill**. Analysis runs only in a Supabase Edge Function; the browser never receives AWS credentials.

**Branch:** `techloom` only.

## Architecture

```
Browser (Add Entry)
  → Supabase Storage `receipts` (proof upload, unchanged)
  → Edge Function `analyze-bill`
      → validates custom FMS session (`user_sessions`)
      → optional department access check
      → Amazon Textract AnalyzeExpense (eu-west-1 recommended)
      → returns normalized JSON (no transaction insert)
  → user reviews / corrects fields
  → user picks Entry Type manually
  → existing Save entry flow
```

## Secret names (values never committed)

Set these in the **Techloom Supabase project** → Project Settings → Edge Functions → Secrets:

| Secret name | Purpose |
|-------------|---------|
| `AWS_ACCESS_KEY_ID` | IAM user/key allowed to call Textract |
| `AWS_SECRET_ACCESS_KEY` | Matching secret |
| `AWS_REGION` | Use `eu-west-1` for this pilot |

Supabase also injects automatically (do not put in Vite):

| Secret name | Notes |
|-------------|--------|
| `SUPABASE_URL` | Auto |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto — used to validate `user_sessions` / department rows |

**Never** create `VITE_AWS_*` or put AWS keys in Vercel / `.env` frontend vars.

### IAM (AWS console)

Minimal actions for the pilot key:

- `textract:AnalyzeExpense`

Prefer a dedicated IAM user with that single action. Do not reuse root credentials.

## Deploy Edge Function (Techloom)

Prerequisites: [Supabase CLI](https://supabase.com/docs/guides/cli) logged in, linked to the **Techloom** project (not production-main if different).

```bash
# From repo root (techloom branch)
supabase login
supabase link --project-ref <TECHLOOM_PROJECT_REF>

# Set secrets (CLI prompts / flags — do not paste secrets into git)
supabase secrets set AWS_ACCESS_KEY_ID=...
supabase secrets set AWS_SECRET_ACCESS_KEY=...
supabase secrets set AWS_REGION=eu-west-1

# Deploy
supabase functions deploy analyze-bill --project-ref <TECHLOOM_PROJECT_REF>
```

Verify in Dashboard → Edge Functions → `analyze-bill`.

Frontend already calls:

`{VITE_SUPABASE_URL}/functions/v1/analyze-bill`

using the existing anon key plus custom headers:

- `x-fms-session-id`
- `x-fms-user-id`
- `x-fms-user-role`
- `x-fms-department-id` (optional)

No frontend env changes are required beyond the usual `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

## Local notes

1. Keep AWS keys only in Supabase secrets (or a local CLI `supabase secrets` for the linked project).
2. Do not add AWS vars to `.env` / `.env.local` for Vite.
3. Ensure `user_sessions` exists (`supabase/user_sessions.sql`) so scans can authenticate.
4. Ensure receipts bucket exists (`supabase/receipts.sql`) for proof storage (unchanged).
5. After deploy, sign in on Techloom FMS → Add Entry → **Scan / Upload Bill** with a JPEG/PNG.

## Limits (pilot)

| Rule | Value |
|------|--------|
| Types | `image/jpeg`, `image/png` only (no PDF yet for OCR) |
| Max size | 4.5 MB |
| Rate limit | 8 scans / user / 5 minutes (per Edge isolate) |
| Auto-save | Never — review + manual Save only |
| Entry type | Never set by OCR |

## Attach proof only

PDF / WebP / GIF remain available under **Attach proof only** (existing storage path). That mode does not call Textract.
