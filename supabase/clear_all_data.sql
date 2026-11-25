-- DANGER: Deletes all operational data. Keeps admin_accounts.
-- Run in Supabase SQL Editor only when you intend to reset the system.

delete from public.transactions;

-- Optional tables (skip lines if the table does not exist in your project)
-- delete from public.recurring_entries;
-- delete from public.department_budgets;
-- delete from public.department_targets;
-- delete from public.notifications;
-- delete from public.audit_logs;
-- delete from public.sensitive_events;
-- delete from public.transaction_edit_history;
-- delete from public.password_reset_tokens;
-- delete from public.login_attempts;
-- delete from public.company_users;

delete from public.categories;
delete from public.departments;
delete from public.company_profiles;

-- Then run supabase/seed_categories.sql to restore default categories.
