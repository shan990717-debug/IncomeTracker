-- tripaa — Supabase schema.
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent where possible).
--
-- Access model: a trip is visible only to its members. The creator becomes a
-- member automatically; others join with the trip's invite code via join_trip().
-- Row Level Security enforces this for reads, writes and realtime.

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  start_date    date,
  end_date      date,
  regions       text[] not null default '{}',
  dismissed_auto text[] not null default '{}',
  invite_code   text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_by    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at    timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id      uuid not null references public.trips on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  display_name text not null default '',
  joined_at    timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.saves (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips on delete cascade,
  title       text not null,
  name_local  text not null default '',
  url         text not null default '',
  platform    text not null default '',
  thumbnail   text not null default '',
  note        text not null default '',
  address     text not null default '',
  region      text not null default '',
  area        text not null default '',
  category    text not null default 'place',
  status      text not null default 'saved' check (status in ('saved', 'going', 'done')),
  day         date,
  rating      int  not null default 0,
  review      text not null default '',
  raw         text not null default '',
  ai          boolean not null default false,
  unsure      boolean not null default false,
  added_by    uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips on delete cascade,
  title        text not null,
  grp          text not null default 'other',
  note         text not null default '',
  link         text not null default '',
  due_date     date,
  done         boolean not null default false,
  auto_key     text,
  source_url   text not null default '',
  source_title text not null default '',
  added_by     uuid default auth.uid() references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists saves_trip_idx on public.saves (trip_id);
create index if not exists tasks_trip_idx on public.tasks (trip_id);
create index if not exists members_user_idx on public.trip_members (user_id);

-- ---------- helpers ----------

-- security definer so policies can check membership without recursing into RLS.
create or replace function public.is_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = t and user_id = auth.uid());
$$;

create or replace function public.my_display_name()
returns text language sql stable as $$
  select coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''), split_part(auth.jwt() ->> 'email', '@', 1), '旅伴');
$$;

-- Creator joins their own trip.
create or replace function public.add_creator_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into trip_members (trip_id, user_id, display_name)
  values (new.id, new.created_by, my_display_name())
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trips_add_creator on public.trips;
create trigger trips_add_creator after insert on public.trips
  for each row execute function public.add_creator_as_member();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before update on public.saves for each row execute function public.touch_updated_at();
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- Join with an invite code. Returns the trip id (null if the code is wrong).
create or replace function public.join_trip(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into t from trips where invite_code = lower(trim(code));
  if t is null then return null; end if;
  insert into trip_members (trip_id, user_id, display_name)
  values (t, auth.uid(), my_display_name())
  on conflict do nothing;
  return t;
end $$;

-- Rotate the invite code (e.g. if a link was shared too widely).
create or replace function public.reset_invite(t uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
begin
  if not is_member(t) then raise exception 'not a member'; end if;
  update trips set invite_code = c where id = t;
  return c;
end $$;

-- ---------- row level security ----------

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.saves enable row level security;
alter table public.tasks enable row level security;

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select using (is_member(id) or created_by = auth.uid());
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert with check (created_by = auth.uid());
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update using (is_member(id));
drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete using (created_by = auth.uid());

drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members for select using (is_member(trip_id));
drop policy if exists members_update_self on public.trip_members;
create policy members_update_self on public.trip_members for update using (user_id = auth.uid());
drop policy if exists members_leave on public.trip_members;
create policy members_leave on public.trip_members for delete using (user_id = auth.uid());

drop policy if exists saves_all on public.saves;
create policy saves_all on public.saves for all using (is_member(trip_id)) with check (is_member(trip_id));
drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all using (is_member(trip_id)) with check (is_member(trip_id));

-- ---------- place details (migration 002, included here for fresh installs) ----------

alter table public.saves add column if not exists subtype   text not null default '';
alter table public.saves add column if not exists country   text not null default '';
alter table public.saves add column if not exists lat       double precision;
alter table public.saves add column if not exists lng       double precision;
alter table public.saves add column if not exists geo       text not null default '';
alter table public.saves add column if not exists place_url text not null default '';

-- ---------- realtime (旅伴的修改即时出现) ----------

do $$ begin
  begin alter publication supabase_realtime add table public.saves; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.trips; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.trip_members; exception when duplicate_object then null; end;
end $$;
