# System backups setup

Daily and manual backups are stored on the **server** in Supabase Postgres, not as a browser-only download.

## Storage place

| What | Where |
|------|--------|
| Snapshots + history metadata | Table `public.system_backups` (JSONB `payload`) |
| Retention | ~90 days (app prunes older rows) |
| Schedule | Midnight **Asia/Colombo** |

## One-time SQL (required)

In the Supabase SQL Editor for the project used by production, run:

- [`system_backups.sql`](./system_backups.sql)

Or from the repo (with DB password configured):

```bash
npm run migrate:db
```

Until this runs, Profile → Security shows “Server backup storage is not configured yet” and automatic backups cannot persist.

## Fix: “new row violates row-level security policy”

If the UI says **Server storage is configured** but **Backup now** fails with:

```text
new row violates row-level security policy for table "system_backups"
```

then the table exists with **RLS still enabled** (common when created in the Dashboard, or with `auth.uid()` policies). This app uses **custom hashed-password auth + the anon key**, so `auth.uid()` is always null and inserts are denied.

**Paste and run this in the Supabase SQL Editor** (safe to re-run):

```sql
-- Drop every existing policy on system_backups
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'system_backups'
  loop
    execute format('drop policy if exists %I on public.system_backups', pol.policyname);
  end loop;
end $$;

alter table public.system_backups disable row level security;

grant select, insert, update, delete on public.system_backups to anon, authenticated, service_role;

notify pgrst, 'reload schema';
```

Same content lives in [`fix_system_backups_rls.sql`](./fix_system_backups_rls.sql). This matches other FMS tables (`sensitive_events`, `audit_logs`, `categories`, …). Service-role cron continues to work either way.

After it succeeds, click **Refresh history**, then **Backup now** again.

## Daily job (browser not required)

Configured in `vercel.json`:

```json
{ "path": "/api/cron-backup", "schedule": "30 18 * * *" }
```

`30 18 * * *` UTC = **00:00 Asia/Colombo**.

Set these **Vercel** environment variables:

| Variable | Required | Notes |
|----------|----------|--------|
| `SUPABASE_URL` or `VITE_SUPABASE_URL` | Yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Preferred | Bypass RLS; anon key also works with current grants |
| `CRON_SECRET` | Recommended | Cron / manual callers send `Authorization: Bearer <secret>` |

Fallback: when an **admin** has the app open, the client also creates today’s snapshot if it is missing (`ensureDailySystemBackup`).

## Manual backup

**Backup now** inserts a row into `system_backups`. Optionally check **Also download JSON** for a local copy. History rows can be downloaded anytime from the list.
