-- IKPM leads table
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- Human-friendly lead numbers: LD-1001, LD-1002, …
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
  select coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), u.email)
    into new.added_by_name
    from auth.users u
   where u.id = auth.uid();
  return new;
end;
$$;

drop trigger if exists leads_set_added_by on public.leads;
create trigger leads_set_added_by
  before insert on public.leads
  for each row execute function public.set_lead_added_by();

-- Security: only signed-in staff can see or add leads. No edits or deletes from the app.
alter table public.leads enable row level security;

drop policy if exists "Staff can view leads" on public.leads;
create policy "Staff can view leads"
  on public.leads for select
  to authenticated
  using (true);

drop policy if exists "Staff can add leads" on public.leads;
create policy "Staff can add leads"
  on public.leads for insert
  to authenticated
  with check (auth.uid() is not null);
