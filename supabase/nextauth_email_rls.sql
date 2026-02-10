-- NextAuth email-scoped RLS setup (no Supabase Auth required)

-- A) Schema updates for people_roles
alter table public.people_roles
  add column if not exists user_id text;

update public.people_roles
set user_id = owner_email
where user_id is null;

alter table public.people_roles
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'people_roles_user_id_person_email_key'
      and conrelid = 'public.people_roles'::regclass
  ) then
    alter table public.people_roles
      add constraint people_roles_user_id_person_email_key unique (user_id, person_email);
  end if;
end
$$;

-- Helper function to scope a DB transaction to a user email.
create or replace function public.set_app_user_email(p_user_email text)
returns text
language sql
security definer
set search_path = public
as $$
  select set_config('app.user_email', p_user_email, true);
$$;

grant execute on function public.set_app_user_email(text) to anon, authenticated, service_role;

-- B) Enable RLS
alter table public.oauth_tokens enable row level security;
alter table public.people_roles enable row level security;
alter table public.weekly_reports enable row level security;

-- C) Email-based RLS policies
drop policy if exists oauth_tokens_select_own on public.oauth_tokens;
create policy oauth_tokens_select_own
on public.oauth_tokens
for select
using (user_id = current_setting('app.user_email', true));

drop policy if exists oauth_tokens_insert_own on public.oauth_tokens;
create policy oauth_tokens_insert_own
on public.oauth_tokens
for insert
with check (user_id = current_setting('app.user_email', true));

drop policy if exists oauth_tokens_update_own on public.oauth_tokens;
create policy oauth_tokens_update_own
on public.oauth_tokens
for update
using (user_id = current_setting('app.user_email', true))
with check (user_id = current_setting('app.user_email', true));

drop policy if exists oauth_tokens_delete_own on public.oauth_tokens;
create policy oauth_tokens_delete_own
on public.oauth_tokens
for delete
using (user_id = current_setting('app.user_email', true));

drop policy if exists people_roles_select_own on public.people_roles;
create policy people_roles_select_own
on public.people_roles
for select
using (user_id = current_setting('app.user_email', true));

drop policy if exists people_roles_insert_own on public.people_roles;
create policy people_roles_insert_own
on public.people_roles
for insert
with check (user_id = current_setting('app.user_email', true));

drop policy if exists people_roles_update_own on public.people_roles;
create policy people_roles_update_own
on public.people_roles
for update
using (user_id = current_setting('app.user_email', true))
with check (user_id = current_setting('app.user_email', true));

drop policy if exists people_roles_delete_own on public.people_roles;
create policy people_roles_delete_own
on public.people_roles
for delete
using (user_id = current_setting('app.user_email', true));

drop policy if exists weekly_reports_select_own on public.weekly_reports;
create policy weekly_reports_select_own
on public.weekly_reports
for select
using (user_id = current_setting('app.user_email', true));

drop policy if exists weekly_reports_insert_own on public.weekly_reports;
create policy weekly_reports_insert_own
on public.weekly_reports
for insert
with check (user_id = current_setting('app.user_email', true));

drop policy if exists weekly_reports_update_own on public.weekly_reports;
create policy weekly_reports_update_own
on public.weekly_reports
for update
using (user_id = current_setting('app.user_email', true))
with check (user_id = current_setting('app.user_email', true));

drop policy if exists weekly_reports_delete_own on public.weekly_reports;
create policy weekly_reports_delete_own
on public.weekly_reports
for delete
using (user_id = current_setting('app.user_email', true));
