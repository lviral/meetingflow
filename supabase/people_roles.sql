create extension if not exists "pgcrypto";

create table if not exists public.people_roles (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  person_email text not null,
  role text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (owner_email, person_email)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists people_roles_set_updated_at on public.people_roles;
create trigger people_roles_set_updated_at
before update on public.people_roles
for each row
execute function public.set_updated_at();

alter table public.people_roles enable row level security;

drop policy if exists people_roles_select_own on public.people_roles;
create policy people_roles_select_own
on public.people_roles
for select
using (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists people_roles_insert_own on public.people_roles;
create policy people_roles_insert_own
on public.people_roles
for insert
with check (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists people_roles_update_own on public.people_roles;
create policy people_roles_update_own
on public.people_roles
for update
using (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
