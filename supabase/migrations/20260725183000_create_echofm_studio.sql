create extension if not exists pgcrypto;

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled series',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.music_tracks (
  id text primary key,
  title text not null,
  mood text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series (id) on delete cascade,
  title text not null default 'Untitled episode',
  script text not null default '',
  voice text,
  music_track_id text references public.music_tracks (id),
  narration_paths text[] not null default '{}',
  thumbnail_path text,
  thumbnail_prompt text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists episodes_series_created_idx on public.episodes (series_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_series_updated_at on public.series;
create trigger set_series_updated_at before update on public.series
for each row execute function public.set_updated_at();

drop trigger if exists set_episodes_updated_at on public.episodes;
create trigger set_episodes_updated_at before update on public.episodes
for each row execute function public.set_updated_at();

alter table public.series enable row level security;
alter table public.music_tracks enable row level security;
alter table public.episodes enable row level security;

create policy "Creators manage their own series"
on public.series for all
to authenticated
using ((select auth.uid()) = creator_id)
with check ((select auth.uid()) = creator_id);

create policy "Everyone can browse soundtrack options"
on public.music_tracks for select
to authenticated
using (true);

create policy "Creators manage their own episodes"
on public.episodes for all
to authenticated
using (
  exists (
    select 1 from public.series
    where series.id = episodes.series_id
      and series.creator_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.series
    where series.id = episodes.series_id
      and series.creator_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public)
values ('episode-audio', 'episode-audio', false), ('episode-images', 'episode-images', false)
on conflict (id) do update set public = false;

create policy "Creators read their private generated audio"
on storage.objects for select to authenticated
using (
  bucket_id = 'episode-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators upload their private generated audio"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'episode-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators update their private generated audio"
on storage.objects for update to authenticated
using (
  bucket_id = 'episode-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'episode-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators delete their private generated audio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'episode-audio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators read their private generated images"
on storage.objects for select to authenticated
using (
  bucket_id = 'episode-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators upload their private generated images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'episode-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators update their private generated images"
on storage.objects for update to authenticated
using (
  bucket_id = 'episode-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'episode-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Creators delete their private generated images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'episode-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

insert into public.music_tracks (id, title, mood, duration_seconds)
values
  ('night-drive', 'Night Drive', 'Cinematic · 2:18', 138),
  ('soft-focus', 'Soft Focus', 'Warm · 1:42', 102),
  ('midnight-rain', 'Midnight Rain', 'Atmospheric · 2:05', 125),
  ('golden-hour', 'Golden Hour', 'Uplifting · 1:56', 116),
  ('quiet-tension', 'Quiet Tension', 'Suspense · 1:48', 108),
  ('city-lights', 'City Lights', 'Lo-fi · 2:12', 132)
on conflict (id) do nothing;
