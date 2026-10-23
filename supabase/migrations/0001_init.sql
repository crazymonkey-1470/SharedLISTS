-- Our Shared Lists: initial schema
-- Run once in the Supabase SQL editor (or with `supabase db push`).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_id_idx on public.household_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- 32 hex chars from the built-in CSPRNG-backed gen_random_uuid()
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index invites_household_id_idx on public.invites (household_id);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position int not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- lets items/events reference (list, household) together so they can't cross households
  unique (id, household_id)
);
create index lists_household_id_idx on public.lists (household_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  done boolean not null default false,
  done_at timestamptz,
  added_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (list_id, household_id) references public.lists (id, household_id) on delete cascade
);
create index items_household_id_idx on public.items (household_id);
create index items_list_id_idx on public.items (list_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  repeat_until date,
  list_id uuid,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  -- deleting the list only clears list_id (Postgres 15+ column list)
  foreign key (list_id, household_id) references public.lists (id, household_id) on delete set null (list_id)
);
create index events_household_starts_idx on public.events (household_id, starts_at);
create index events_list_id_idx on public.events (list_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.shares_household(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_household(name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if coalesce(btrim(create_household.name), '') = '' then
    raise exception 'Household name is required' using errcode = '22023';
  end if;

  insert into public.households (name, created_by)
  values (btrim(create_household.name), uid)
  returning id into hid;

  insert into public.household_members (household_id, user_id, role)
  values (hid, uid, 'owner');

  return hid;
end;
$$;

create or replace function public.accept_invite(token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.invites%rowtype;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into inv from public.invites i where i.token = accept_invite.token;
  if not found then
    raise exception 'This invite link is not valid' using errcode = 'P0002';
  end if;
  if inv.revoked then
    raise exception 'This invite link has been revoked' using errcode = '22023';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invite link has expired' using errcode = '22023';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, 'member')
  on conflict (household_id, user_id) do nothing;

  return inv.household_id;
end;
$$;

revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_owner(uuid) from public, anon;
revoke execute on function public.shares_household(uuid) from public, anon;
revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.shares_household(uuid) to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;
alter table public.lists enable row level security;
alter table public.items enable row level security;
alter table public.events enable row level security;

-- profiles: see yourself and anyone you share a household with; edit only yourself
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household(id));
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- households: created only via create_household(); members read, owners rename
create policy "households_select" on public.households for select to authenticated
  using (public.is_member(id));
create policy "households_update_owner" on public.households for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- household_members: joined only via create_household()/accept_invite();
-- members see each other, owners remove (non-owner) members
create policy "members_select" on public.household_members for select to authenticated
  using (public.is_member(household_id));
create policy "members_delete_owner" on public.household_members for delete to authenticated
  using (public.is_owner(household_id) and role = 'member');

-- invites: owners only
create policy "invites_select_owner" on public.invites for select to authenticated
  using (public.is_owner(household_id));
create policy "invites_insert_owner" on public.invites for insert to authenticated
  with check (public.is_owner(household_id) and created_by = auth.uid());
create policy "invites_update_owner" on public.invites for update to authenticated
  using (public.is_owner(household_id)) with check (public.is_owner(household_id));
create policy "invites_delete_owner" on public.invites for delete to authenticated
  using (public.is_owner(household_id));

-- lists
create policy "lists_select" on public.lists for select to authenticated
  using (public.is_member(household_id));
create policy "lists_insert" on public.lists for insert to authenticated
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy "lists_update" on public.lists for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "lists_delete" on public.lists for delete to authenticated
  using (public.is_member(household_id));

-- items
create policy "items_select" on public.items for select to authenticated
  using (public.is_member(household_id));
create policy "items_insert" on public.items for insert to authenticated
  with check (public.is_member(household_id) and added_by = auth.uid());
create policy "items_update" on public.items for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "items_delete" on public.items for delete to authenticated
  using (public.is_member(household_id));

-- events
create policy "events_select" on public.events for select to authenticated
  using (public.is_member(household_id));
create policy "events_insert" on public.events for insert to authenticated
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy "events_update" on public.events for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "events_delete" on public.events for delete to authenticated
  using (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.lists, public.items, public.events;
