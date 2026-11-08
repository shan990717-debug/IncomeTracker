-- tripaa migration 003: 须知 (tips from posts) and 推荐/避雷 on places.
-- Run once in Supabase → SQL Editor (safe to re-run).

-- 👍 / 👎 on places
alter table public.saves add column if not exists verdict        text not null default 'recommend'; -- 'recommend' | 'avoid'
alter table public.saves add column if not exists verdict_reason text not null default '';

-- 须知: practical tips (transport, entry, bookings…), one row per tip, merged across posts
create table if not exists public.tips (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips on delete cascade,
  title            text not null,
  type             text not null default 'other',  -- transport | entry | booking | connect | money | avoid | other
  points           text[] not null default '{}',   -- 2–4 key facts
  country          text not null default '',
  cities           text[] not null default '{}',   -- empty = whole country
  needs_all_cities boolean not null default false,  -- true for routes, e.g. KTX 首尔→釜山
  nationalities    text[] not null default '{}',   -- passports it applies to; empty = everyone
  is_action        boolean not null default true,   -- something to do (has a checkbox) vs plain knowledge
  personal         boolean not null default false,  -- each traveller does it themselves (K-ETA, eSIM)
  offset_days      int,                             -- do it N days before departure (negative = before)
  offset_from_post boolean not null default false,  -- the post said so (vs AI suggestion)
  sources          jsonb not null default '[]',     -- [{ url, title, platform }]
  done_by          uuid[] not null default '{}',    -- who ticked it; for shared tips any tick = done
  added_by         uuid default auth.uid() references auth.users on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tips_trip_idx on public.tips (trip_id);

alter table public.tips enable row level security;
drop policy if exists tips_all on public.tips;
create policy tips_all on public.tips for all using (is_member(trip_id)) with check (is_member(trip_id));

drop trigger if exists tips_touch on public.tips;
create trigger tips_touch before update on public.tips for each row execute function public.touch_updated_at();

-- Tick / untick for the current user atomically, so two people ticking at
-- once don't overwrite each other. Runs with the caller's rights (RLS applies).
create or replace function public.toggle_tip(t uuid)
returns uuid[] language plpgsql as $$
declare result uuid[];
begin
  update tips
     set done_by = case when auth.uid() = any(done_by) then array_remove(done_by, auth.uid())
                        else array_append(done_by, auth.uid()) end
   where id = t
  returning done_by into result;
  return result;
end $$;

do $$ begin
  begin alter publication supabase_realtime add table public.tips; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

notify pgrst, 'reload schema';
