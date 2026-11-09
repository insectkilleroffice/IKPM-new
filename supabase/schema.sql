-- IKPM database setup
-- Run this whole file in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again; it only creates what is missing and refreshes functions/policies.

-------------------------------------------------------------------------------
-- 1. Staff profiles (name, email, role)
-------------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) > 0),
  email      text not null,
  role       text not null check (role in ('admin', 'operations', 'sales', 'finance')),
  created_at timestamptz not null default now()
);

-- Role of the signed-in user (null if they have no profile).
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;

-- Everyone sees their own profile; admins see all. Profiles are only
-- created/changed by the server (secret key), never directly from the browser.
drop policy if exists "View own profile or admin views all" on public.profiles;
create policy "View own profile or admin views all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');

-------------------------------------------------------------------------------
-- 2. Leads
-------------------------------------------------------------------------------
create sequence if not exists public.lead_number_seq start 1001;

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default ('LD-' || nextval('public.lead_number_seq')),
  type          text not null check (type in ('Residential', 'Company')),
  name          text not null check (length(trim(name)) > 0),
  company_name  text,
  phone         text not null check (length(trim(phone)) > 0),
  email         text,
  source        text not null check (length(trim(source)) > 0),
  added_by      uuid not null default auth.uid() references auth.users (id),
  added_by_name text not null,
  created_at    timestamptz not null default now(),
  constraint company_needs_name check (type <> 'Company' or length(trim(coalesce(company_name, ''))) > 0)
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- "Added By" is always the signed-in user — set by the database, not the browser.
create or replace function public.set_lead_added_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.added_by := auth.uid();
  select coalesce(p.full_name, u.email)
    into new.added_by_name
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = auth.uid();
  return new;
end;
$$;

drop trigger if exists leads_set_added_by on public.leads;
create trigger leads_set_added_by
  before insert on public.leads
  for each row execute function public.set_lead_added_by();

-- Only staff with a role can see or add leads. No edits or deletes from the app.
alter table public.leads enable row level security;

drop policy if exists "Staff can view leads" on public.leads;
create policy "Staff can view leads"
  on public.leads for select
  to authenticated
  using (public.my_role() is not null);

drop policy if exists "Staff can add leads" on public.leads;
create policy "Staff can add leads"
  on public.leads for insert
  to authenticated
  with check (public.my_role() is not null);

-------------------------------------------------------------------------------
-- 3. FIRST ADMIN (run once, separately, after creating your own user in
--    Authentication → Users). Replace the name and email, then run:
-------------------------------------------------------------------------------
-- insert into public.profiles (id, full_name, email, role)
-- select id, 'Your Name', email, 'admin' from auth.users where email = 'you@example.com';
