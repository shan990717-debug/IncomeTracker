-- tripaa migration 002: place details for sorting by area / distance.
-- Run once in Supabase → SQL Editor (safe to re-run).

alter table public.saves add column if not exists subtype   text not null default '';
alter table public.saves add column if not exists country   text not null default '';
alter table public.saves add column if not exists lat       double precision;
alter table public.saves add column if not exists lng       double precision;
alter table public.saves add column if not exists geo       text not null default '';   -- 'kakao' | 'osm' | 'manual' | ''
alter table public.saves add column if not exists place_url text not null default '';   -- Kakao place page

-- Make PostgREST pick up the new columns right away.
notify pgrst, 'reload schema';
