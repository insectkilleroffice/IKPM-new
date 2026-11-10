-- IKPM database setup
-- Run this whole file in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again: it creates what is missing and refreshes functions and policies.
--
-- Tables
--   profiles         staff accounts (name, email, role)
--   leads            every lead; `stage` says where it is
--                      new                         → Leads tab (unclaimed)
--                      follow_up / call / meeting /
--                      inspection / proposal       → owner's Sales board
--                      closed (wrong lead)         → admin only
--   lead_activities  history of every Log Contact step
--
-- Who can do what (this sales app only lets `sales` sign in; admin uses the
-- separate admin app on the same Supabase project)
--   admin   sees and moves everything
--   sales   Leads tab: new leads they added + leads added by admin/system
--           Sales tab: only leads they claimed; can move them only while in
--           Follow-up. Meeting / Inspection / Proposal are locked (admin only).
--   others  no access to leads

-------------------------------------------------------------------------------
-- 0. Remove any old policies on our tables (Postgres ORs policies together, so
--    a leftover one would leak rows). The correct ones are recreated below.
-------------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public' and tablename in ('profiles', 'leads', 'lead_activities')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-------------------------------------------------------------------------------
-- 1. Staff profiles
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

-- Everyone sees their own profile; admins see all. Profiles are only created
-- in the Supabase dashboard (see section 4), never from the app.
create policy "View own profile or admin views all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');

-------------------------------------------------------------------------------
-- 2. Leads
-------------------------------------------------------------------------------
create sequence if not exists public.lead_number_seq start 1001;

create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique default ('LD-' || nextval('public.lead_number_seq')),
  type             text not null check (type in ('Residential', 'Company')),
  name             text not null check (length(trim(name)) > 0),
  company_name     text,
  phone            text not null check (length(trim(phone)) > 0),
  email            text,
  source           text not null check (length(trim(source)) > 0),
  added_by         uuid references auth.users (id),            -- null = System
  added_by_name    text not null,
  stage            text not null default 'new'
                     check (stage in ('new', 'follow_up', 'call', 'meeting', 'inspection', 'proposal', 'closed')),
  assigned_to      uuid references public.profiles (id) on delete set null,
  assigned_to_name text,
  next_action_at   timestamptz,                                -- date of the next task
  closed_reason    text check (closed_reason in ('wrong_lead', 'already_working')), -- already_working: old data only
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint company_needs_name check (type <> 'Company' or length(trim(coalesce(company_name, ''))) > 0),
  constraint closed_needs_reason check ((stage = 'closed') = (closed_reason is not null))
);

-- Clean-up of earlier versions (no-ops on a fresh database).
alter table public.leads drop column if exists added_by_role;
alter table public.leads alter column added_by drop not null;
alter table public.leads alter column added_by drop default;

create index if not exists leads_created_at_idx  on public.leads (created_at desc);
create index if not exists leads_added_by_idx    on public.leads (added_by);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists leads_stage_idx       on public.leads (stage);

-- New leads always start unclaimed, and "Added By" is always the signed-in user,
-- set here rather than by the browser. Inserts with the secret key (no signed-in
-- user) are recorded as "System".
create or replace function public.set_lead_added_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.stage            := 'new';
  new.assigned_to      := null;
  new.assigned_to_name := null;
  new.next_action_at   := null;
  new.closed_reason    := null;
  new.created_at       := now();
  new.updated_at       := now();
  new.added_by         := auth.uid();

  if new.added_by is null then
    new.added_by_name := coalesce(nullif(trim(new.added_by_name), ''), 'System');
  else
    select coalesce(p.full_name, u.email)
      into new.added_by_name
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = new.added_by;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_set_added_by on public.leads;
create trigger leads_set_added_by
  before insert on public.leads
  for each row execute function public.set_lead_added_by();

-- Shared with the whole sales team = added by the system or by an admin.
create or replace function public.is_team_lead(p_added_by uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_added_by is null
      or exists (select 1 from public.profiles where id = p_added_by and role = 'admin');
$$;

alter table public.leads enable row level security;

create policy "Staff can view leads"
  on public.leads for select
  to authenticated
  using (
    public.my_role() = 'admin'
    or (
      public.my_role() = 'sales'
      and (
        assigned_to = auth.uid()                                   -- their Sales board
        or (stage = 'new' and assigned_to is null                  -- Leads tab
            and (added_by = auth.uid() or public.is_team_lead(added_by)))
      )
    )
  );

create policy "Staff can add leads"
  on public.leads for insert
  to authenticated
  with check (public.my_role() in ('admin', 'sales'));

-- No update/delete policies: leads only change through log_lead_activity().

-------------------------------------------------------------------------------
-- 3. Lead history + Log Contact
-------------------------------------------------------------------------------
create table if not exists public.lead_activities (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads (id) on delete cascade,
  kind            text not null check (kind in
                    ('follow_up', 'call', 'meeting', 'inspection', 'proposal', 'wrong_lead', 'already_working')),
  scheduled_at    timestamptz,
  notes           text,
  created_by      uuid references auth.users (id),
  created_by_name text not null,                               -- "Moved by"
  created_at      timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

alter table public.lead_activities enable row level security;

-- You can read the history of any lead you can see. Writes only via the function below.
create policy "View activity of visible leads"
  on public.lead_activities for select
  to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));

-- Log a step on a lead and move it to that stage.
--   follow_up / call / meeting / inspection → date & time required
--   proposal                                → date optional
--   wrong_lead                              → note required; only on a new lead;
--                                             goes to admin only (not claimed)
-- Logging on a new lead claims it for the person logging.
-- Sales can only move leads that are New or in Follow-up.
drop function if exists public.log_lead_activity(uuid, text, timestamptz, text);
create function public.log_lead_activity(
  p_lead_id      uuid,
  p_kind         text,
  p_scheduled_at timestamptz default null,
  p_notes        text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_role  text := public.my_role();
  v_name  text;
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_wrong boolean := p_kind = 'wrong_lead';
  v_lead  public.leads%rowtype;
begin
  if v_uid is null or coalesce(v_role, '') not in ('admin', 'sales') then
    raise exception 'Only admin and sales can log contact' using errcode = '42501';
  end if;
  if coalesce(p_kind, '') not in ('follow_up', 'call', 'meeting', 'inspection', 'proposal', 'wrong_lead') then
    raise exception 'Unknown activity type' using errcode = '22023';
  end if;
  if p_kind in ('follow_up', 'call', 'meeting', 'inspection') and p_scheduled_at is null then
    raise exception 'Choose a date and time' using errcode = '22023';
  end if;
  if v_wrong and v_notes is null then
    raise exception 'Add a note explaining why' using errcode = '22023';
  end if;

  -- Lock the row so two people can't claim the same lead at once.
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if v_wrong and v_lead.stage <> 'new' then
    raise exception 'Only new leads can be marked as wrong lead' using errcode = '22023';
  end if;

  if v_role = 'sales' then
    if not coalesce(
         v_lead.assigned_to = v_uid
         or (v_lead.stage = 'new' and v_lead.assigned_to is null
             and (v_lead.added_by = v_uid or public.is_team_lead(v_lead.added_by))),
         false) then
      raise exception 'This lead belongs to another sales person' using errcode = '42501';
    end if;
    if v_lead.stage not in ('new', 'follow_up') then
      raise exception 'Only admin can move a lead out of Meeting, Inspection or Proposal' using errcode = '42501';
    end if;
  end if;

  select full_name into v_name from public.profiles where id = v_uid;

  insert into public.lead_activities (lead_id, kind, scheduled_at, notes, created_by, created_by_name)
  values (p_lead_id, p_kind, case when v_wrong then null else p_scheduled_at end, v_notes, v_uid, v_name);

  update public.leads
     set stage            = case when v_wrong then 'closed' else p_kind end,
         closed_reason    = case when v_wrong then 'wrong_lead' end,
         next_action_at   = case when v_wrong then null else p_scheduled_at end,
         assigned_to      = case when v_wrong then assigned_to else coalesce(assigned_to, v_uid) end,
         assigned_to_name = case when not v_wrong and assigned_to is null then v_name else assigned_to_name end,
         updated_at       = now()
   where id = p_lead_id;
end;
$$;

revoke all on function public.log_lead_activity(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.log_lead_activity(uuid, text, timestamptz, text) to authenticated;

-- Check: after running, this should list exactly 4 policies.
--   select tablename, policyname from pg_policies where schemaname = 'public';

-------------------------------------------------------------------------------
-- 4. ADDING STAFF (run separately, once per person)
--    a) Authentication → Users → Add user → Create new user
--       (enter email + password, tick "Auto Confirm User").
--    b) Then run this with their name, email and role
--       (admin, sales, operations or finance):
-------------------------------------------------------------------------------
-- insert into public.profiles (id, full_name, email, role)
-- select id, 'Full Name', email, 'sales' from auth.users where email = 'person@example.com';
--
-- Change someone's role:
-- update public.profiles set role = 'admin' where email = 'person@example.com';
