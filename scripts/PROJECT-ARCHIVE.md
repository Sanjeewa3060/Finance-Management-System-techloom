# Save Techloom before migration

## Complete backup button

Profile → Security → Data backup now includes **Download complete backup**. It uses a separate persistent worker; pushing the frontend does not provision that worker. Ordinary Vercel functions do not bundle the required PostgreSQL executable. Do not expose database or service keys using any `VITE_` variable.

Deploy a checkout of the Techloom branch on a private Node host with PostgreSQL client tools, Git and enough private disk space for the dump, uploaded files and ZIP. Run `npm ci --include=dev` then `node scripts/backup-worker.mjs`. Keep `origin/techloom` fetched and up to date so the exported source matches the deployment. Run one worker process for this configuration. The worker listens on loopback port 8787; use an HTTPS reverse proxy. Configure download timeouts for large files, disable request/query/body logging on this host (download URLs contain short-lived tokens), and prevent public access to its filesystem. Temporary files expire after one hour while running; clean the worker's private temporary directory after a restart.

In addition to the export variables below, set these **only on the worker**:

- `BACKUP_ALLOWED_ORIGIN`: exact HTTPS origin of your Techloom app, without a path.
- `BACKUP_ADMIN_EMAIL`: authorized backup administrator's email.
- `BACKUP_ADMIN_PASSWORD_HASH`: bcrypt hash of a strong, dedicated backup access password, created locally with bcryptjs. These are separate export credentials, not a browser role or a record in the publicly exposed application database. Rotate them if access changes. Never store plaintext in the repo.
- `BACKUP_WORKER_PORT`: optional, defaults to 8787.

In the frontend deployment, set `VITE_BACKUP_WORKER_URL` to the worker's HTTPS origin and rebuild. This URL is public; it contains no credentials. An unconfigured button explains setup instead of producing a partial JSON backup. The user enters export credentials, watches progress, and downloads the ZIP when ready. The service limits credential attempts, permits one running export, expires download tokens, and marks failed exports as failures. With a reverse proxy the rate limit groups requests by the proxy's address; keep this worker limited to the admin app. For multi-instance/public infrastructure use a shared rate limiter and durable job queue instead.

Verify with a real small export and test a restore before relying on it. Source files, Auth/financial data, password hashes and private uploads make this ZIP highly sensitive. Keep an encrypted offline copy. Never pause the old project merely because the button appeared.

Run `node scripts/export-project-archive.mjs` from this repository using Node.js and PostgreSQL client tools. Use a pg_dump version compatible with the source server. The output goes to a new folder in the Windows temporary directory unless an unused destination path is supplied as the argument. Move the completed archive folder to a durable, private backup location.

Supply these environment variables locally (never paste secrets into chat or commit them):

- `BACKUP_PROJECT_REF`: the current Techloom Supabase project reference.
- `BACKUP_SUPABASE_URL`: its HTTPS project URL.
- `BACKUP_DATABASE_URL`: its direct or session-pooler PostgreSQL connection string, not a transaction-pooler URL.
- `BACKUP_SERVICE_ROLE_KEY`: its server-only service-role key, used to download private storage objects.
- `PG_DUMP_PATH`: optional absolute path to pg_dump.exe.

Fetch origin/techloom first. Avoid edits/uploads while exporting. This script only reads the source database and Storage; it never pauses, deletes, or updates the source project.

The output contains a database dump (including schema and data accessible to the database role), actual storage files, bucket configuration, original object paths, a Techloom source ZIP, and SHA-256 checksums. `manifest.json` must say `complete: true`. Any failed download stops the export and leaves it marked incomplete. The files include sensitive account and financial information; store privately, preferably on an encrypted drive.

This is a migration archive, not a one-click restore. Supabase project settings, credentials, deployed Edge Function code/secrets, browser-only settings, and externally hosted files must be saved separately. Auth data in the database is sensitive. Managed schemas need selective restoration, and old project storage URLs need rewriting. Test restoration into the new project before pausing the original. Do not run the existing JSON backup as a substitute for this export.
