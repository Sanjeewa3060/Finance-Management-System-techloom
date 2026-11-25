/** Map common Postgres/Supabase errors to actionable messages. */
export function formatSupabaseError(error) {
  const msg = String(error?.message ?? error ?? 'Unknown error')
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return (
      'Cannot reach the database. Check your internet connection, verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, ' +
      'then stop and restart the dev server (npm run dev).'
    )
  }
  if (msg.includes('other_direction') && (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('Could not find'))) {
    return (
      'The other_direction column is missing on transactions (required for Other +/- entries). ' +
      'Open Supabase → SQL Editor, run supabase/add_other_direction.sql, wait a few seconds, then refresh the app.'
    )
  }
  if (msg.includes('department_id') && msg.includes('company_profiles')) {
    return (
      'Your database still requires department_id on company_profiles (old schema). ' +
      'In Supabase SQL Editor, run: alter table public.company_profiles drop column if exists department_id; ' +
      'Then create the company again.'
    )
  }
  if (msg.includes('categories') && (msg.includes('does not exist') || msg.includes('schema cache'))) {
    return (
      'The categories table is missing in Supabase. Open SQL Editor and run supabase/all_features.sql ' +
      '(or at least the create table public.categories block), then try again.'
    )
  }
  if (msg.includes('categories') && msg.includes('unique')) {
    return 'This category name already exists for that entry type. Pick a different name or type.'
  }
  if (msg.includes('row-level security') && msg.includes('categories')) {
    return (
      'Row Level Security is blocking category saves. In Supabase SQL Editor run: ' +
      'alter table public.categories disable row level security; ' +
      '(Or run supabase/categories.sql)'
    )
  }
  if (msg.includes('row-level security') && msg.includes('system_backups')) {
    return (
      'Row Level Security is blocking backup inserts. This app uses the anon key (not Supabase Auth). ' +
      'Open Supabase → SQL Editor and run supabase/fix_system_backups_rls.sql, then try Backup now again.'
    )
  }
  if (
    msg.includes('Bucket not found') ||
    msg.includes('avatar_url') ||
    (msg.includes('avatars') && (msg.includes('storage') || msg.includes('bucket')))
  ) {
    return (
      'The avatars storage bucket is missing in Supabase. Open SQL Editor and run supabase/avatars.sql ' +
      '(creates the bucket and avatar_url columns), then try uploading again.'
    )
  }
  if (
    msg.includes('null value in column') &&
    msg.includes('"id"') &&
    (msg.includes('company_profiles') || msg.includes('departments'))
  ) {
    return (
      'Database id defaults are missing on the Techloom Supabase project (nhmtytoryyaxgsigtwox). ' +
      'Open SQL Editor and run: alter table public.company_profiles alter column id set default gen_random_uuid(); ' +
      'alter table public.departments alter column id set default gen_random_uuid();'
    )
  }
  if (
    msg.includes('null value in column') &&
    msg.includes('"is_active"') &&
    (msg.includes('company_profiles') || msg.includes('departments'))
  ) {
    return (
      'is_active has no database default on this Supabase project. ' +
      'Open project nhmtytoryyaxgsigtwox → SQL Editor and run: ' +
      'alter table public.company_profiles alter column is_active set default true; ' +
      'alter table public.departments alter column is_active set default true;'
    )
  }
  if (
    msg.includes('company_profiles') &&
    (msg.includes('is_active') || msg.includes('deleted_at')) &&
    (msg.includes('schema cache') || msg.includes('Could not find') || msg.includes('does not exist'))
  ) {
    return (
      'Account control columns are missing on company_profiles. Open Supabase project nhmtytoryyaxgsigtwox → SQL Editor and run ' +
      'supabase/fix_department_create.sql, then try again.'
    )
  }
  if (
    (msg.includes('email') || msg.includes('password') || msg.includes('is_active')) &&
    (msg.includes('column') || msg.includes('schema cache'))
  ) {
    return (
      'Branch login columns are missing on departments. Open Supabase SQL Editor and run supabase/department_accounts.sql, ' +
      'then try again.'
    )
  }
  return msg
}
