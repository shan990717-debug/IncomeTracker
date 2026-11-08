-- tripaa migration 004: 行程 (day plans).
-- Run once in Supabase → SQL Editor (safe to re-run).

-- Which day a place is planned for, and where it sits in that day.
alter table public.saves add column if not exists in_plan     boolean not null default false; -- picked for the trip (day may be null = 待安排)
alter table public.saves add column if not exists plan_day    date;
alter table public.saves add column if not exists plan_order  int;
alter table public.saves add column if not exists plan_time   text not null default '';      -- 'HH:MM' arrival
alter table public.saves add column if not exists plan_stay   int;                            -- minutes
alter table public.saves add column if not exists plan_meal   text not null default '';      -- 'lunch' | 'dinner' | ''
alter table public.saves add column if not exists plan_reason text not null default '';      -- why it's placed here (AI)
alter table public.saves add column if not exists visited     boolean not null default false; -- ticked during the trip

-- One row per trip day: start/end points, times, and the computed legs.
create table if not exists public.plan_days (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips on delete cascade,
  day         date not null,
  start_place jsonb,                                   -- { name, address, lat, lng }
  end_place   jsonb,
  start_time  text not null default '10:00',
  end_time    text not null default '21:00',
  lunch       text not null default '12:00-13:30',
  dinner      text not null default '18:00-19:30',
  legs        jsonb not null default '[]',             -- [{ from, to, km, minutes, mode }]
  summary     text not null default '',
  planned_at  timestamptz,
  updated_at  timestamptz not null default now(),
  unique (trip_id, day)
);

alter table public.plan_days enable row level security;
drop policy if exists plan_days_all on public.plan_days;
create policy plan_days_all on public.plan_days for all using (is_member(trip_id)) with check (is_member(trip_id));

drop trigger if exists plan_days_touch on public.plan_days;
create trigger plan_days_touch before update on public.plan_days for each row execute function public.touch_updated_at();

do $$ begin
  begin alter publication supabase_realtime add table public.plan_days; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

notify pgrst, 'reload schema';
