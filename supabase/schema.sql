  -- IKPM database setup
  -- Run this whole file in Supabase: Dashboard → SQL Editor → New query → paste → Run.
  -- Safe to run again on an existing database: it adds what is missing and
  -- refreshes functions and policies.

  -- Start clean: remove ANY existing policies on our tables (e.g. leftovers from
  -- earlier experiments like "Enable read access for all users"). Postgres ORs
  -- policies together, so one extra policy would let users see rows they
  -- shouldn't. The correct policies are all recreated further down this file.
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
  --    stage 'new'  → unclaimed, shown on the Leads tab
  --    other stages → owned by `assigned_to`, shown on that person's Sales board
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
    added_by      uuid references auth.users (id),
    added_by_name text not null,
    created_at    timestamptz not null default now(),
    constraint company_needs_name check (type <> 'Company' or length(trim(coalesce(company_name, ''))) > 0)
  );

  -- Columns added after the first version (no-ops on a fresh database).
  alter table public.leads alter column added_by drop not null;  -- system leads have no user
  alter table public.leads alter column added_by drop default;   -- set by the trigger below

  alter table public.leads add column if not exists added_by_role text
    check (added_by_role in ('system', 'admin', 'operations', 'sales', 'finance'));
  update public.leads l
    set added_by_role = coalesce((select p.role from public.profiles p where p.id = l.added_by), 'system')
  where added_by_role is null;
  alter table public.leads alter column added_by_role set not null;

  alter table public.leads add column if not exists stage text not null default 'new'
    check (stage in ('new', 'follow_up', 'call', 'meeting', 'inspection', 'proposal', 'closed'));
  alter table public.leads add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
  alter table public.leads add column if not exists assigned_to_name text;
  alter table public.leads add column if not exists next_action_at timestamptz;
  alter table public.leads add column if not exists closed_reason text
    check (closed_reason in ('wrong_lead', 'already_working'));
  alter table public.leads add column if not exists updated_at timestamptz not null default now();

  alter table public.leads drop constraint if exists closed_needs_reason;
  alter table public.leads add constraint closed_needs_reason
    check ((stage = 'closed') = (closed_reason is not null));

  create index if not exists leads_created_at_idx on public.leads (created_at desc);
  create index if not exists leads_added_by_idx on public.leads (added_by);
  create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
  create index if not exists leads_stage_idx on public.leads (stage);

  -- New leads always start unclaimed, and "Added By" is always the signed-in user —
  -- set by the database, not the browser. Inserts made with the secret key
  -- (no signed-in user) are recorded as "System".
  create or replace function public.set_lead_added_by()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    new.stage := 'new';
    new.assigned_to := null;
    new.assigned_to_name := null;
    new.next_action_at := null;
    new.closed_reason := null;
    new.created_at := now();
    new.updated_at := now();

    new.added_by := auth.uid();
    if new.added_by is null then
      new.added_by_name := coalesce(nullif(trim(new.added_by_name), ''), 'System');
      new.added_by_role := 'system';
    else
      select coalesce(p.full_name, u.email), p.role
        into new.added_by_name, new.added_by_role
        from auth.users u
        left join public.profiles p on p.id = u.id
      where u.id = auth.uid();
    end if;
    return new;
  end;
  $$;

  -- A lead is shared with the whole sales team only if the system added it
  -- (no user) or an admin added it. Checks the adder's CURRENT role, so a lead
  -- added by a sales person is never shared, whatever was stored at insert time.
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

  drop trigger if exists leads_set_added_by on public.leads;
  create trigger leads_set_added_by
    before insert on public.leads
    for each row execute function public.set_lead_added_by();

  -- Only admin and sales can see or add leads. Leads are never edited or deleted
  -- directly from the app; stage changes go through log_lead_activity() below.
  --   Admin: all leads.
  --   Sales: their own pipeline (leads they claimed via Log Contact), plus new
  --          unclaimed leads they added themselves or that admin/system added.
  --          Never another sales person's pipeline.
  --   Operations / finance: no access.
  alter table public.leads enable row level security;

  drop policy if exists "Staff can view leads" on public.leads;
  create policy "Staff can view leads"
    on public.leads for select
    to authenticated
    using (
      public.my_role() = 'admin'
      or (
        public.my_role() = 'sales'
        and (
          -- Sales board: only leads they claimed.
          assigned_to = auth.uid()
          -- Leads tab: unclaimed new leads they added, or added by admin/system.
          or (stage = 'new' and assigned_to is null
              and (added_by = auth.uid() or public.is_team_lead(added_by)))
        )
      )
    );

  drop policy if exists "Staff can add leads" on public.leads;
  create policy "Staff can add leads"
    on public.leads for insert
    to authenticated
    with check (public.my_role() in ('admin', 'sales'));

  -------------------------------------------------------------------------------
  -- 3. Lead activity log (every Log Contact / pipeline step)
  -------------------------------------------------------------------------------
  -- An older, incompatible lead_activities table (without `kind`) is replaced
  -- when it is empty. If it has rows, stop so no data is lost.
  do $$
  declare
    v_rows bigint;
  begin
    if to_regclass('public.lead_activities') is not null
      and not exists (select 1 from information_schema.columns
                        where table_schema = 'public' and table_name = 'lead_activities' and column_name = 'kind') then
      execute 'select count(*) from public.lead_activities' into v_rows;
      if v_rows > 0 then
        raise exception 'public.lead_activities is an older table with % rows. To keep it, run: alter table public.lead_activities rename to lead_activities_old; alter index public.lead_activities_pkey rename to lead_activities_old_pkey; — then run this file again.', v_rows;
      end if;
      drop table public.lead_activities cascade;
    end if;
  end;
  $$;

  create table if not exists public.lead_activities (
    id              uuid primary key default gen_random_uuid(),
    lead_id         uuid not null references public.leads (id) on delete cascade,
    kind            text not null check (kind in
                      ('follow_up', 'call', 'meeting', 'inspection', 'proposal', 'wrong_lead', 'already_working')),
    scheduled_at    timestamptz,
    notes           text,
    created_by      uuid references auth.users (id),
    created_by_name text not null,
    created_at      timestamptz not null default now()
  );

  create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

  -- Final check: these should be the ONLY policies (4 rows) after running this file:
  --   select tablename, policyname from pg_policies where schemaname = 'public';

  -- You can read the history of any lead you can see. Writes only via the function below.
  alter table public.lead_activities enable row level security;

  drop policy if exists "View activity of visible leads" on public.lead_activities;
  create policy "View activity of visible leads"
    on public.lead_activities for select
    to authenticated
    using (exists (select 1 from public.leads l where l.id = lead_id));

  -- Log a contact/step on a lead and move it to the matching stage.
  -- The first person to log contact on an unclaimed lead becomes its owner:
  -- it leaves the Leads tab and only they (and admin) can see it.
  --   follow_up / call / meeting / inspection → that stage (date & time required)
  --   proposal                                → proposal stage (date optional)
  --   already_working                         → closed (note required)
  --   wrong_lead                              → closed, NOT claimed: admin only (note required)
  create or replace function public.log_lead_activity(
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
    v_uid     uuid := auth.uid();
    v_role    text := public.my_role();
    v_name    text;
    v_notes   text := nullif(trim(coalesce(p_notes, '')), '');
    v_closing boolean := p_kind in ('wrong_lead', 'already_working');
    v_lead    public.leads%rowtype;
  begin
    if v_uid is null or coalesce(v_role, '') not in ('admin', 'sales') then
      raise exception 'Only admin and sales can log contact' using errcode = '42501';
    end if;
    if coalesce(p_kind, '') not in ('follow_up', 'call', 'meeting', 'inspection', 'proposal', 'wrong_lead', 'already_working') then
      raise exception 'Unknown activity type' using errcode = '22023';
    end if;
    if p_kind in ('follow_up', 'call', 'meeting', 'inspection') and p_scheduled_at is null then
      raise exception 'Choose a date and time' using errcode = '22023';
    end if;
    if v_closing and v_notes is null then
      raise exception 'Add a note explaining why' using errcode = '22023';
    end if;

    -- Lock the row so two sales people can't claim the same lead at once.
    select * into v_lead from public.leads where id = p_lead_id for update;
    if not found then
      raise exception 'Lead not found' using errcode = 'P0002';
    end if;

    if v_role = 'sales' and not coalesce(
        v_lead.assigned_to = v_uid
        or (v_lead.stage = 'new' and v_lead.assigned_to is null
            and (v_lead.added_by = v_uid or public.is_team_lead(v_lead.added_by))),
        false) then
      raise exception 'This lead belongs to another sales person' using errcode = '42501';
    end if;

    select full_name into v_name from public.profiles where id = v_uid;

    insert into public.lead_activities (lead_id, kind, scheduled_at, notes, created_by, created_by_name)
    values (p_lead_id, p_kind, case when v_closing then null else p_scheduled_at end, v_notes, v_uid, v_name);

    update public.leads
      set stage            = case when v_closing then 'closed' else p_kind end,
          closed_reason    = case when v_closing then p_kind end,
          next_action_at   = case when v_closing then null else p_scheduled_at end,
          -- Logging contact claims an unclaimed lead — except "wrong lead", which
          -- stays unowned so only admin sees it (under Closed on the Sales page).
          assigned_to      = case when p_kind = 'wrong_lead' then assigned_to else coalesce(assigned_to, v_uid) end,
          assigned_to_name = case when p_kind <> 'wrong_lead' and assigned_to is null then v_name else assigned_to_name end,
          updated_at       = now()
    where id = p_lead_id;
  end;
  $$;

  revoke all on function public.log_lead_activity(uuid, text, timestamptz, text) from public, anon;
  grant execute on function public.log_lead_activity(uuid, text, timestamptz, text) to authenticated;

  -------------------------------------------------------------------------------
  -- 4. FIRST ADMIN (run once, separately, after creating your own user in
  --    Authentication → Users). Replace the name and email, then run:
  -------------------------------------------------------------------------------
  -- insert into public.profiles (id, full_name, email, role)
  -- select id, 'Your Name', email, 'admin' from auth.users where email = 'you@example.com';
