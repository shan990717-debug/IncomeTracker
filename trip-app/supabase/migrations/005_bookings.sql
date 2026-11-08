-- tripaa migration 005: 订单 (flights / hotels / trains) + 必去推荐 cache.
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips on delete cascade,
  kind        text not null default 'other',   -- flight | hotel | train | other
  title       text not null default '',        -- hotel name / short label
  number      text not null default '',        -- flight / train number, e.g. KE 672, KTX 101
  ref         text not null default '',        -- 订单号 / booking reference
  start_date  date,                            -- depart / check-in
  start_time  text not null default '',        -- 'HH:MM' local time
  end_date    date,                            -- arrive / check-out
  end_time    text not null default '',
  from_place  jsonb,                           -- { name, code, address, lat, lng }
  to_place    jsonb,
  place       jsonb,                           -- hotel location
  seats       text not null default '',
  note        text not null default '',
  for_all     boolean not null default true,   -- everyone on the trip (else just owner)
  owner_id    uuid default auth.uid() references auth.users on delete set null,
  added_by    uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists bookings_trip_idx on public.bookings (trip_id);

alter table public.bookings enable row level security;
drop policy if exists bookings_all on public.bookings;
create policy bookings_all on public.bookings for all using (is_member(trip_id)) with check (is_member(trip_id));

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();

-- 必去推荐: AI's list of must-see places and classic routes, generated once per city per trip and shared.
create table if not exists public.must_lists (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips on delete cascade,
  city        text not null,
  data        jsonb not null default '{}',     -- { places: [...], routes: [...] }
  created_at  timestamptz not null default now(),
  unique (trip_id, city)
);

alter table public.must_lists enable row level security;
drop policy if exists must_lists_all on public.must_lists;
create policy must_lists_all on public.must_lists for all using (is_member(trip_id)) with check (is_member(trip_id));

do $$ begin
  begin alter publication supabase_realtime add table public.bookings; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.must_lists; exception when duplicate_object then null; when undefined_object then null; end;
end $$;
