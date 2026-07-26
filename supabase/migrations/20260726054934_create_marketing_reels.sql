create table public.marketing_reels (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  ugc_video_id uuid not null references public.marketing_ugc_videos (id) on delete restrict,
  cta_text text not null check (char_length(cta_text) between 1 and 120),
  duration_seconds integer not null check (duration_seconds > 0),
  video_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_reels_creator_created_idx
  on public.marketing_reels (creator_id, created_at desc);

create trigger set_marketing_reels_updated_at
before update on public.marketing_reels
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.marketing_reels to authenticated;

alter table public.marketing_reels enable row level security;

create policy "Creators manage their own marketing reels"
on public.marketing_reels for all
to authenticated
using ((select auth.uid()) = creator_id)
with check ((select auth.uid()) = creator_id);
